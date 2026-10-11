"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { IJMAPClient } from '@/lib/jmap/client-interface';
import { toast } from '@/stores/toast-store';

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
      const googleCals = await fetchGoogleCalendars();
      setCalendars(googleCals);

      // Merge Google calendars into calendar store so event creation & viewing recognizes them
      useCalendarStore.setState((state) => {
        const nonGoogleCals = state.calendars.filter((c) => !c.id.startsWith('google:'));
        const newSelected = new Set(state.selectedCalendarIds);
        googleCals.forEach((c) => newSelected.add(c.id));

        const preferredDefaultId = useSettingsStore.getState().defaultCalendarId;
        let merged = [...nonGoogleCals, ...googleCals];
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
  }, [checkStatus, loadCalendars]);

  // Refresh Google events for visible range and selected Google calendars
  const refreshEvents = useCallback(async () => {
    if (!status.connected || !dateRange?.start || !dateRange?.end || calendars.length === 0) return;

    const selectedGoogleCals = calendars.filter((c) => selectedCalendarIds.includes(c.id));
    if (selectedGoogleCals.length === 0) return;

    try {
      const eventArrays = await Promise.all(
        selectedGoogleCals.map((c) =>
          fetchGoogleEvents(c.originalId || 'primary', dateRange.start, dateRange.end).catch((err) => {
            console.error(`Failed to fetch events for Google calendar ${c.name}:`, err);
            return [] as CalendarEvent[];
          }),
        ),
      );
      const googleEvents = eventArrays.flat();
      useCalendarStore.setState((state) => {
        const nonGoogleEvents = state.events.filter((e) => !e.id.startsWith('google:'));
        return {
          events: [...nonGoogleEvents, ...googleEvents],
        };
      });
    } catch (err) {
      console.error('Failed to refresh Google events:', err);
    }
  }, [status.connected, dateRange?.start, dateRange?.end, calendars, selectedCalendarIds]);

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

  // Register Google pseudo-client in client-registry so calendar store mutations
  // routed by localAccountId (google:<email>) invoke our Google API routes.
  useEffect(() => {
    if (!status.connected || !status.email) return;

    const googleLocalAccountId = `google:${status.email}`;
    const previousLookup = getClientByLocalAccountId;

    const googleClient = {
      getAccountId: () => googleLocalAccountId,
      getUsername: () => status.email || 'google',
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
        const calId = Object.keys(cleanEvent.calendarIds || {})[0] || 'primary';
        return createGoogleEventApi(calId, cleanEvent);
      },
      updateCalendarEvent: async (realId: string, updates: Partial<CalendarEvent>) => {
        const calId = Object.keys(updates.calendarIds || {})[0] || 'primary';
        return updateGoogleEventApi(calId, realId, updates);
      },
      deleteCalendarEvent: async (realId: string) => {
        return deleteGoogleEventApi('primary', realId);
      },
    } as unknown as IJMAPClient;

    setClientLookup((localAccountId: string) => {
      if (localAccountId === googleLocalAccountId) {
        return googleClient;
      }
      return previousLookup(localAccountId);
    });
  }, [status.connected, status.email]);

  const connectGoogle = useCallback(() => {
    window.location.href = '/api/auth/google/start?returnTo=/calendar';
  }, []);

  const disconnectGoogle = useCallback(async () => {
    const success = await disconnectGoogleApi();
    if (success) {
      setStatus({ configured: status.configured, connected: false });
      setCalendars([]);
      useCalendarStore.setState((state) => ({
        calendars: state.calendars.filter((c) => !c.id.startsWith('google:')),
        events: state.events.filter((e) => !e.id.startsWith('google:')),
      }));
      toast.success('Google Account disconnected');
    } else {
      toast.error('Failed to disconnect Google Account');
    }
  }, [status.configured]);

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
