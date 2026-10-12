"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Calendar, CalendarEvent } from '@/lib/jmap/types';
import {
  getGoogleStatus,
  disconnectGoogle as disconnectGoogleApi,
  fetchGoogleCalendars,
  fetchGoogleEvents,
  createGoogleEvent as createGoogleEventApi,
  updateGoogleEvent as updateGoogleEventApi,
  deleteGoogleEvent as deleteGoogleEventApi,
  type GoogleAccountStatus,
} from '@/lib/google/google-calendar-client';
import { setClientLookup, getClientByLocalAccountId } from '@/stores/client-registry';
import { useCalendarStore } from '@/stores/calendar-store';
import { useSettingsStore } from '@/stores/settings-store';
import { toast } from '@/stores/toast-store';
import type { IJMAPClient } from '@/lib/jmap/client-interface';
import { normalizeAppMode, type LinkedGoogleAccountPublic } from '@/lib/google/types';
import { reconcileCalendarEvents } from '@/lib/google/sync-engine';

export function useGoogleCalendar() {
  const [status, setStatus] = useState<GoogleAccountStatus>({ configured: false, connected: false });
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const dateRange = useCalendarStore((s) => s.dateRange);
  const selectedCalendarIds = useCalendarStore((s) => s.selectedCalendarIds);

  const checkStatus = useCallback(async () => {
    try {
      const currentStatus = await getGoogleStatus();
      setStatus(currentStatus);
      return currentStatus;
    } catch {
      return { configured: false, connected: false };
    }
  }, []);

  const loadCalendars = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentStatus: GoogleAccountStatus = await getGoogleStatus().catch(() => ({ configured: false, connected: false }));
      setStatus(currentStatus);

      const accounts: LinkedGoogleAccountPublic[] = currentStatus.accounts || [];
      const googleCals = await fetchGoogleCalendars();

      // Separate vs Sync vs None
      const separateCals: Calendar[] = [];
      for (const cal of googleCals) {
        const calEmail = cal.accountName || (cal.id.startsWith('google:') ? cal.id.split('::')[0].replace(/^google:/, '') : undefined);
        const matchingAccount = accounts.find((a: LinkedGoogleAccountPublic) => a.email.toLowerCase() === calEmail?.toLowerCase());
        const mode = matchingAccount ? normalizeAppMode(matchingAccount.enabledApps?.calendar) : 'separate';

        if (mode === 'separate') {
          separateCals.push(cal);
        }
      }

      setCalendars(googleCals); // Keep all for event fetching

      // Merge only separate Google calendars into calendar store
      useCalendarStore.setState((state) => {
        const nonGoogleCals = state.calendars.filter((c) => !c.id.startsWith('google:'));
        const newSelected = new Set(state.selectedCalendarIds);
        separateCals.forEach((c) => newSelected.add(c.id));

        const preferredDefaultId = useSettingsStore.getState().defaultCalendarId;
        let merged = [...nonGoogleCals, ...separateCals];
        if (preferredDefaultId && merged.some((c) => c.id === preferredDefaultId)) {
          merged = merged.map((c) => ({
            ...c,
            isDefault: c.id === preferredDefaultId,
          }));
        }

        return {
          calendars: merged,
          selectedCalendarIds: Array.from(newSelected),
        };
      });

      return googleCals;
    } catch (err) {
      console.error('Failed to load Google calendars:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus().then((s) => {
      if (s.connected) {
        void loadCalendars();
      }
    });

    const handleUpdated = () => {
      void loadCalendars();
    };
    window.addEventListener('google-services-updated', handleUpdated);
    return () => window.removeEventListener('google-services-updated', handleUpdated);
  }, [checkStatus, loadCalendars]);

  // Refresh Google events for visible range and selected Google calendars
  const refreshEvents = useCallback(async () => {
    if (!status.connected || !dateRange?.start || !dateRange?.end || calendars.length === 0) return;

    const accounts = status.accounts || [];
    const syncAccounts = accounts.filter((a) => normalizeAppMode(a.enabledApps?.calendar) === 'sync');

    try {
      const separateCalsToFetch = calendars.filter((c) => {
        const calEmail = c.accountName || (c.id.startsWith('google:') ? c.id.split('::')[0].replace(/^google:/, '') : undefined);
        const matchingAccount = accounts.find((a) => a.email.toLowerCase() === calEmail?.toLowerCase());
        const mode = matchingAccount ? normalizeAppMode(matchingAccount.enabledApps?.calendar) : 'separate';
        return mode === 'separate' && selectedCalendarIds.includes(c.id);
      });

      const syncCalsToFetch = calendars.filter((c) => {
        const calEmail = c.accountName || (c.id.startsWith('google:') ? c.id.split('::')[0].replace(/^google:/, '') : undefined);
        const matchingAccount = accounts.find((a) => a.email.toLowerCase() === calEmail?.toLowerCase());
        const mode = matchingAccount ? normalizeAppMode(matchingAccount.enabledApps?.calendar) : 'separate';
        return mode === 'sync';
      });

      const [separateEventArrays, syncEventArrays] = await Promise.all([
        Promise.all(
          separateCalsToFetch.map((c) =>
            fetchGoogleEvents(c.id, dateRange.start, dateRange.end).catch((err) => {
              console.error(`Failed to fetch events for Google calendar ${c.name}:`, err);
              return [] as CalendarEvent[];
            })
          )
        ),
        Promise.all(
          syncCalsToFetch.map((c) =>
            fetchGoogleEvents(c.id, dateRange.start, dateRange.end).then((evts) => ({
              cal: c,
              events: evts,
            })).catch(() => ({ cal: c, events: [] as CalendarEvent[] }))
          )
        ),
      ]);

      const googleSeparateEvents = separateEventArrays.flat();

      useCalendarStore.setState((state) => {
        const nonGoogleEvents = state.events.filter((e) => !e.id.startsWith('google:'));
        const defaultCal = state.calendars.find((c) => c.isDefault) || state.calendars[0];
        const defaultCalId = defaultCal?.id || 'default-calendar';

        let runningEvents = [...nonGoogleEvents];

        // Reconcile each sync calendar's events into default calendar
        for (const item of syncEventArrays) {
          const calEmail = item.cal.accountName || (item.cal.id.startsWith('google:') ? item.cal.id.split('::')[0].replace(/^google:/, '') : '');
          const syncRes = reconcileCalendarEvents({
            accountEmail: calEmail,
            incomingEvents: item.events,
            defaultCalendarId: defaultCalId,
            currentEvents: runningEvents,
            otherSyncAccounts: syncAccounts,
            onPushToGoogle: async (email, evt) => {
              try {
                await updateGoogleEventApi(item.cal.id, evt.id, {
                  title: evt.title,
                  start: evt.start,
                  duration: evt.duration,
                  utcStart: evt.utcStart,
                  utcEnd: evt.utcEnd,
                  description: evt.description,
                });
              } catch (err) {
                console.error(`Failed to propagate event to Google calendar ${email}:`, err);
              }
            },
          });
          runningEvents = syncRes.merged;
        }

        return {
          events: [...runningEvents, ...googleSeparateEvents],
        };
      });
    } catch (err) {
      console.error('Failed to refresh Google events:', err);
    }
  }, [status.connected, status.accounts, dateRange?.start, dateRange?.end, calendars, selectedCalendarIds]);

  // Initial fetch and 10-second background polling + immediate tab focus refresh
  useEffect(() => {
    if (!status.connected) return;

    // Run immediate refresh
    void refreshEvents();

    // Poll every 10 seconds while the page is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refreshEvents();
      }
    }, 10_000);

    // Refresh immediately when the user focuses the window or switches back to this tab
    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refreshEvents();
      }
    };

    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
    };
  }, [status.connected, refreshEvents]);

  // Register Google pseudo-clients in client-registry so calendar store mutations
  // routed by localAccountId (google:<email>) invoke our Google API routes.
  useEffect(() => {
    if (!status.connected) return;

    const emails = new Set<string>();
    if (status.email) emails.add(status.email);
    (status.accounts || []).forEach((a) => {
      if (a.email) emails.add(a.email);
    });
    calendars.forEach((c) => {
      if (c.localAccountId?.startsWith('google:')) {
        emails.add(c.localAccountId.replace(/^google:/, ''));
      }
    });

    if (emails.size === 0) return;

    const previousLookup = getClientByLocalAccountId;
    const clientsMap = new Map<string, IJMAPClient>();

    for (const email of emails) {
      const googleLocalAccountId = `google:${email}`;
      const googleClient = {
        getAccountId: () => googleLocalAccountId,
        getUsername: () => email,
        getServerUrl: () => 'https://www.googleapis.com',
        getAuthHeader: () => '',
        supportsCalendars: () => true,
        updateCalendar: async (calendarId: string, updates: Partial<Calendar>) => {
          const { updateGoogleCalendar } = await import('@/lib/google/google-calendar-client');
          return updateGoogleCalendar(calendarId, updates);
        },
        setDefaultCalendar: async (_calendarId: string) => {
          // Default calendar preference is persisted in settings store
        },
        createCalendarEvent: async (cleanEvent: Partial<CalendarEvent>) => {
          const calId = Object.keys(cleanEvent.calendarIds || {})[0] || `${googleLocalAccountId}::primary`;
          return createGoogleEventApi(calId, cleanEvent);
        },
        updateCalendarEvent: async (realId: string, updates: Partial<CalendarEvent>) => {
          const calId = Object.keys(updates.calendarIds || {})[0] || `${googleLocalAccountId}::primary`;
          return updateGoogleEventApi(calId, realId, updates);
        },
        deleteCalendarEvent: async (realId: string) => {
          return deleteGoogleEventApi(`${googleLocalAccountId}::primary`, realId);
        },
      } as unknown as IJMAPClient;

      clientsMap.set(googleLocalAccountId, googleClient);
    }

    setClientLookup((localAccountId: string) => {
      if (clientsMap.has(localAccountId)) {
        return clientsMap.get(localAccountId)!;
      }
      return previousLookup(localAccountId);
    });
  }, [status.connected, status.email, status.accounts, calendars]);

  const connectGoogle = useCallback(() => {
    window.location.href = '/api/auth/google/start?returnTo=/calendar';
  }, []);

  const disconnectGoogle = useCallback(async (accountIdOrEmail?: string) => {
    const success = await disconnectGoogleApi(accountIdOrEmail);
    if (success) {
      if (accountIdOrEmail) {
        await checkStatus();
        await loadCalendars();
        toast.success('Google Account disconnected');
      } else {
        setStatus({ configured: status.configured, connected: false });
        setCalendars([]);
        useCalendarStore.setState((state) => ({
          calendars: state.calendars.filter((c) => !c.id.startsWith('google:')),
          events: state.events.filter((e) => !e.id.startsWith('google:')),
        }));
        toast.success('Google Account disconnected');
      }
    } else {
      toast.error('Failed to disconnect Google Account');
    }
  }, [checkStatus, loadCalendars, status.configured]);

  return {
    status,
    calendars,
    isLoading,
    connectGoogle,
    disconnectGoogle,
    loadCalendars,
    refreshEvents,
    checkStatus,
  };
}
