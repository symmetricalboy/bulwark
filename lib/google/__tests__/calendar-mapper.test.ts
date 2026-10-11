import { describe, it, expect } from 'vitest';
import {
  googleCalendarToJmap,
  createGoogleBirthdayCalendar,
  isGoogleBirthdayCalendarId,
} from '../calendar-mapper';
import { isBirthdayEvent } from '@/components/calendar/event-card';
import type { GoogleCalendarItem } from '../types';
import type { CalendarEvent } from '@/lib/jmap/types';

describe('Google Calendar Mapper', () => {
  it('assigns sortOrder -1 and isDefault true to primary Google calendar', () => {
    const primaryItem: GoogleCalendarItem = {
      id: 'dylan.g.singer@gmail.com',
      summary: 'Dylan Singer',
      primary: true,
      selected: true,
      backgroundColor: '#4285F4',
      accessRole: 'owner',
    };

    const mapped = googleCalendarToJmap(primaryItem, 'dylan.g.singer@gmail.com');
    expect(mapped.isDefault).toBe(true);
    expect(mapped.sortOrder).toBe(-1);
    expect(mapped.name).toBe('Dylan Singer');
  });

  it('assigns sortOrder 0 and isDefault false to secondary Google calendars', () => {
    const secondaryItem: GoogleCalendarItem = {
      id: 'work-project@group.calendar.google.com',
      summary: 'Work Projects',
      primary: false,
      selected: true,
      backgroundColor: '#0B8043',
      accessRole: 'owner',
    };

    const mapped = googleCalendarToJmap(secondaryItem, 'dylan.g.singer@gmail.com');
    expect(mapped.isDefault).toBe(false);
    expect(mapped.sortOrder).toBe(0);
    expect(mapped.name).toBe('Work Projects');
  });

  it('sorts Google calendars with default calendar always at index 0', () => {
    const secondary = googleCalendarToJmap(
      { id: 'sec-1', summary: 'Alpha Secondary', primary: false, accessRole: 'owner' },
      'user@gmail.com',
    );
    const primary = googleCalendarToJmap(
      { id: 'user@gmail.com', summary: 'User Calendar', primary: true, accessRole: 'owner' },
      'user@gmail.com',
    );
    const birthday = createGoogleBirthdayCalendar('user@gmail.com');

    const calendars = [secondary, primary, birthday];

    calendars.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return (a.name || '').localeCompare(b.name || '');
    });

    expect(calendars[0].id).toBe(primary.id);
    expect(calendars[0].isDefault).toBe(true);
    expect(calendars[1].id).toBe(secondary.id);
    expect(calendars[2].id).toBe(birthday.id);
  });

  it('correctly identifies birthday events via isBirthdayEvent', () => {
    const birthdayEvent = {
      id: 'google:user@gmail.com::ev-1',
      title: "Alice's Birthday",
      start: '2026-10-15T00:00:00',
      duration: 'P1D',
      calendarIds: { 'google:user@gmail.com::#birthdays': true },
    } as unknown as CalendarEvent;

    expect(isBirthdayEvent(birthdayEvent)).toBe(true);

    const regularEvent = {
      id: 'google:user@gmail.com::ev-2',
      title: 'Project Sync',
      start: '2026-10-15T10:00:00',
      duration: 'PT1H',
      calendarIds: { 'google:user@gmail.com::primary': true },
    } as unknown as CalendarEvent;

    expect(isBirthdayEvent(regularEvent)).toBe(false);
  });
});
