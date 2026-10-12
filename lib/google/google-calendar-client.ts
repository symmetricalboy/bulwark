import type { Calendar, CalendarEvent } from '@/lib/jmap/types';
import type { LinkedGoogleAccountPublic } from './types';
import { getComailAccountHeaders } from './comail-headers';

export interface GoogleAccountStatus {
  configured: boolean;
  connected: boolean;
  accounts?: LinkedGoogleAccountPublic[];
  email?: string;
  name?: string;
  picture?: string;
}

export async function getGoogleStatus(): Promise<GoogleAccountStatus> {
  try {
    const res = await fetch('/api/auth/google/status', {
      headers: getComailAccountHeaders(),
    });
    if (!res.ok) return { configured: false, connected: false };
    return await res.json();
  } catch {
    return { configured: false, connected: false };
  }
}

export async function disconnectGoogle(accountIdOrEmail?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
      body: accountIdOrEmail
        ? JSON.stringify(
            accountIdOrEmail.includes('@')
              ? { email: accountIdOrEmail }
              : { accountId: accountIdOrEmail }
          )
        : undefined,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchGoogleCalendars(): Promise<Calendar[]> {
  const res = await fetch('/api/google/calendars', {
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch Google calendars (${res.status})`);
  const data = await res.json();
  return data.calendars || [];
}

export async function updateGoogleCalendar(
  calendarId: string,
  updates: Partial<Calendar>,
): Promise<void> {
  const res = await fetch('/api/google/calendars', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ calendarId, updates }),
  });
  if (!res.ok) throw new Error(`Failed to update Google calendar (${res.status})`);
}

export async function fetchGoogleEvents(
  calendarId: string,
  after: string,
  before: string,
): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({
    calendarId,
    after,
    before,
  });
  const res = await fetch(`/api/google/events?${query.toString()}`, {
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch Google events (${res.status})`);
  const data = await res.json();
  return data.events || [];
}

export async function createGoogleEvent(
  calendarId: string,
  event: Partial<CalendarEvent>,
): Promise<CalendarEvent> {
  const res = await fetch('/api/google/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ calendarId, event }),
  });
  if (!res.ok) throw new Error(`Failed to create Google event (${res.status})`);
  const data = await res.json();
  return data.event;
}

export async function updateGoogleEvent(
  calendarId: string,
  eventId: string,
  updates: Partial<CalendarEvent>,
): Promise<CalendarEvent> {
  const res = await fetch(`/api/google/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getComailAccountHeaders() },
    body: JSON.stringify({ calendarId, updates }),
  });
  if (!res.ok) throw new Error(`Failed to update Google event (${res.status})`);
  const data = await res.json();
  return data.event;
}

export async function deleteGoogleEvent(
  calendarId: string,
  eventId: string,
): Promise<void> {
  const query = new URLSearchParams({ calendarId });
  const res = await fetch(`/api/google/events/${encodeURIComponent(eventId)}?${query.toString()}`, {
    method: 'DELETE',
    headers: getComailAccountHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete Google event (${res.status})`);
}
