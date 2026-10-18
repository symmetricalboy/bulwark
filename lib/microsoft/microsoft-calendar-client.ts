import { Calendar, CalendarEvent } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';
import type { GoogleAppMode } from '@/lib/google/types';

export interface MicrosoftAccountCalendarGroup {
  email: string;
  mode: GoogleAppMode;
  calendars: Calendar[];
}

export class MicrosoftCalendarClient {
  async getCalendars(): Promise<Calendar[]> {
    const groups = await this.getCalendarGroups();
    return groups.flatMap((g) => g.calendars);
  }

  async getCalendarGroups(): Promise<MicrosoftAccountCalendarGroup[]> {
    try {
      const res = await fetch('/api/microsoft/calendars');
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) return [];
        throw new Error(`Failed to fetch Microsoft calendars: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data.accounts)) {
        return data.accounts;
      }
      return [];
    } catch (err) {
      logger.error('Error in MicrosoftCalendarClient.getCalendarGroups', { error: err });
      return [];
    }
  }

  async updateCalendar(namespacedCalendarId: string, updates: Partial<Calendar>): Promise<Calendar> {
    const res = await fetch('/api/microsoft/calendars', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId: namespacedCalendarId, updates }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update Microsoft calendar: ${res.status}`);
    }
    const data = await res.json();
    return data.calendar;
  }

  async getEvents(calendarId: string, start: Date, end: Date): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams({
        calendarId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
      });
      const res = await fetch(`/api/microsoft/events?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch Microsoft events: ${res.status}`);
      }
      const data = await res.json();
      return data.events || [];
    } catch (err) {
      logger.error('Error in MicrosoftCalendarClient.getEvents', { error: err, calendarId });
      return [];
    }
  }

  async createEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const res = await fetch('/api/microsoft/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId, event }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create Microsoft event: ${res.status}`);
    }
    const data = await res.json();
    return data.event;
  }

  async updateEvent(calendarId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const encodedId = encodeURIComponent(eventId);
    const res = await fetch(`/api/microsoft/events/${encodedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId, updates }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update Microsoft event: ${res.status}`);
    }
    const data = await res.json();
    return data.event;
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const encodedId = encodeURIComponent(eventId);
    const params = new URLSearchParams({ calendarId });
    const res = await fetch(`/api/microsoft/events/${encodedId}?${params.toString()}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete Microsoft event: ${res.status}`);
    }
  }
}

export const microsoftCalendarClient = new MicrosoftCalendarClient();
