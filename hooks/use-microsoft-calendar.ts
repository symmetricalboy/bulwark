'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { microsoftCalendarClient } from '@/lib/microsoft/microsoft-calendar-client';
import { useCalendarStore } from '@/stores/calendar-store';
import { useAuthStore } from '@/stores/auth-store';
import { CalendarEvent } from '@/lib/jmap/types';
import { toast } from '@/stores/toast-store';
import { reconcileCalendarEvents } from '@/lib/google/sync-engine';
import type { MicrosoftAccountAppToggles } from '@/lib/microsoft/types';

export interface ConnectedMicrosoftAccount {
  id?: string;
  email: string;
  name?: string;
  expiresAt: number;
  apps?: MicrosoftAccountAppToggles;
}

export function useMicrosoftCalendar(dateRangeStart?: Date, dateRangeEnd?: Date) {
  const [accounts, setAccounts] = useState<ConnectedMicrosoftAccount[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const syncedCalendarIdsRef = useRef<Set<string>>(new Set());

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/microsoft/status');
      if (res.ok) {
        const data = await res.json();
        setConfigured(data.configured);
        setAccounts(data.accounts || []);
        return data.accounts || [];
      }
    } catch {
      // Ignore status errors
    }
    return [];
  }, []);

  const syncMicrosoftCalendarsAndEvents = useCallback(
    async (start?: Date, end?: Date) => {
      setIsSyncing(true);
      try {
        const accountGroups = await microsoftCalendarClient.getCalendarGroups();
        const separateCalendars = accountGroups
          .filter((g) => g.mode === 'separate')
          .flatMap((g) => g.calendars);
        const syncGroups = accountGroups.filter((g) => g.mode === 'sync');

        const store = useCalendarStore.getState();
        const existingMicrosoftById = new Map(
          store.calendars.filter((c) => c.id.startsWith('microsoft:')).map((c) => [c.id, c])
        );
        const nonMicrosoftCalendars = store.calendars.filter(
          (c) => !c.id.startsWith('microsoft:')
        );

        const mergedMicrosoftCalendars = separateCalendars.map((mc) => {
          const prev = existingMicrosoftById.get(mc.id);
          return prev ? { ...mc, isVisible: prev.isVisible } : mc;
        });

        useCalendarStore.setState({
          calendars: [...nonMicrosoftCalendars, ...mergedMicrosoftCalendars],
        });

        const rangeStart = start || new Date(new Date().setMonth(new Date().getMonth() - 1));
        const rangeEnd = end || new Date(new Date().setMonth(new Date().getMonth() + 2));

        const visibleSeparateCalendars = mergedMicrosoftCalendars.filter(
          (c) => c.isVisible !== false
        );
        const allMicrosoftEvents: CalendarEvent[] = [];

        await Promise.all(
          visibleSeparateCalendars.map(async (cal) => {
            const evs = await microsoftCalendarClient.getEvents(cal.id, rangeStart, rangeEnd);
            allMicrosoftEvents.push(...evs);
          })
        );

        const nonMicrosoftEvents = useCalendarStore
          .getState()
          .events.filter((e) => !e.id.startsWith('microsoft:'));

        // Handle two-way 'sync' mode accounts
        const jmapClient = useAuthStore.getState().client;
        const defaultCal =
          nonMicrosoftCalendars.find((c) => c.isDefault && !c.id.startsWith('google:')) ||
          nonMicrosoftCalendars.find((c) => !c.id.startsWith('google:'));

        if (syncGroups.length > 0 && jmapClient && defaultCal && jmapClient.supportsCalendars()) {
          let runningComailEvents = useCalendarStore
            .getState()
            .events.filter(
              (e) => !e.id.startsWith('google:') && !e.id.startsWith('microsoft:')
            );

          for (const group of syncGroups) {
            const primaryMsCal =
              group.calendars.find((c) => c.isDefault) || group.calendars[0];
            if (!primaryMsCal) continue;

            const msEvents = await microsoftCalendarClient.getEvents(
              primaryMsCal.id,
              rangeStart,
              rangeEnd
            );

            const syncRes = reconcileCalendarEvents({
              accountEmail: group.email,
              incomingEvents: msEvents,
              defaultCalendarId: defaultCal.id,
              currentEvents: runningComailEvents,
              onPushToGoogle: async (_email, evt) => {
                try {
                  await microsoftCalendarClient.createEvent(primaryMsCal.id, evt);
                } catch {
                  // Continue
                }
              },
            });
            runningComailEvents = syncRes.merged;
          }

          const googleEvents = useCalendarStore
            .getState()
            .events.filter((e) => e.id.startsWith('google:'));
          useCalendarStore.setState({
            events: [...runningComailEvents, ...googleEvents, ...allMicrosoftEvents],
          });
        } else {
          useCalendarStore.setState({
            events: [...nonMicrosoftEvents, ...allMicrosoftEvents],
          });
        }

        syncedCalendarIdsRef.current = new Set(separateCalendars.map((c) => c.id));
      } catch {
        // Ignore background sync failures
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    checkStatus().then((accs) => {
      if (!mounted) return;
      setIsLoading(false);
      if (accs.length > 0) {
        syncMicrosoftCalendarsAndEvents(dateRangeStart, dateRangeEnd);
      }
    });
    return () => {
      mounted = false;
    };
  }, [checkStatus, syncMicrosoftCalendarsAndEvents, dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    const handleChanged = () => {
      checkStatus().then((accs) => {
        if (accs.length > 0) {
          syncMicrosoftCalendarsAndEvents(dateRangeStart, dateRangeEnd);
        } else {
          const store = useCalendarStore.getState();
          useCalendarStore.setState({
            calendars: store.calendars.filter((c) => !c.id.startsWith('microsoft:')),
            events: store.events.filter((e) => !e.id.startsWith('microsoft:')),
          });
        }
      });
    };
    window.addEventListener('microsoft-accounts-changed', handleChanged);
    window.addEventListener('google-accounts-changed', handleChanged);
    window.addEventListener('microsoft-services-updated', handleChanged);
    return () => {
      window.removeEventListener('microsoft-accounts-changed', handleChanged);
      window.removeEventListener('google-accounts-changed', handleChanged);
      window.removeEventListener('microsoft-services-updated', handleChanged);
    };
  }, [checkStatus, syncMicrosoftCalendarsAndEvents, dateRangeStart, dateRangeEnd]);

  const connectAccount = useCallback((returnTo?: string) => {
    const target = returnTo || window.location.pathname;
    window.location.href = `/api/auth/microsoft/start?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const disconnectAccount = useCallback(async (email: string) => {
    try {
      const res = await fetch('/api/auth/microsoft/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);

        const prefix = `microsoft:${email}::`;
        const store = useCalendarStore.getState();
        useCalendarStore.setState({
          calendars: store.calendars.filter((c) => !c.id.startsWith(prefix)),
          events: store.events.filter((e) => !e.id.startsWith(prefix)),
        });
        toast.success(`Disconnected ${email}`);
      }
    } catch {
      toast.error('Failed to disconnect Microsoft account');
    }
  }, []);

  const calendars = useCalendarStore((s) =>
    s.calendars.filter((c) => c.id.startsWith('microsoft:'))
  );

  const status = {
    configured,
    connected: accounts.length > 0,
    email: accounts[0]?.email,
    name: accounts[0]?.name,
    accounts,
  };

  return {
    status,
    calendars,
    accounts,
    configured,
    isLoading,
    isSyncing,
    connectAccount,
    disconnectAccount,
    connectMicrosoft: () => connectAccount('/calendar'),
    disconnectMicrosoft: disconnectAccount,
    loadCalendars: () => syncMicrosoftCalendarsAndEvents(dateRangeStart, dateRangeEnd),
    refreshEvents: () => syncMicrosoftCalendarsAndEvents(dateRangeStart, dateRangeEnd),
    refresh: () => syncMicrosoftCalendarsAndEvents(dateRangeStart, dateRangeEnd),
    checkStatus,
  };
}
