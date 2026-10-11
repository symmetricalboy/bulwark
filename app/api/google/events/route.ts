import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import {
  googleEventToJmap,
  jmapEventToGoogle,
  isGoogleBirthdayCalendarId,
  isGoogleBirthdayEvent,
  GOOGLE_BIRTHDAY_CALENDAR_ID,
} from '@/lib/google/calendar-mapper';
import type { GoogleEventsListResponse, GoogleEvent } from '@/lib/google/types';
import type { CalendarEvent } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function cleanCalendarId(calendarId: string): string {
  // Strip any google:user@domain:: prefix
  const parts = calendarId.split('::');
  return parts.length > 1 ? parts[1] : calendarId;
}

export async function GET(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const rawCalendarId = searchParams.get('calendarId') || 'primary';
  const calendarId = cleanCalendarId(rawCalendarId);
  const after = searchParams.get('after'); // ISO 8601 string
  const before = searchParams.get('before'); // ISO 8601 string

  const isBirthdays = isGoogleBirthdayCalendarId(calendarId);
  const targetCalendarId = isBirthdays ? 'primary' : calendarId;

  const query = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  if (after) query.set('timeMin', new Date(after).toISOString());
  if (before) query.set('timeMax', new Date(before).toISOString());
  if (isBirthdays) {
    query.set('eventTypes', 'birthday');
  }

  try {
    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events?${query.toString()}`;
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    // If query with eventTypes=birthday returned 400 (e.g. not supported on target endpoint), retry without eventTypes param
    if (!res.ok && isBirthdays && res.status === 400) {
      query.delete('eventTypes');
      url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events?${query.toString()}`;
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
    }

    if (!res.ok) {
      logger.error('Failed to list Google events', { status: res.status, calendarId: targetCalendarId });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const data = (await res.json()) as GoogleEventsListResponse;
    const accountEmail = session.tokens.email || 'google';

    let items = data.items || [];
    if (isBirthdays) {
      // In Birthdays pseudo-calendar, keep only birthday events
      items = items.filter(isGoogleBirthdayEvent);
    } else {
      // In primary and other calendars, exclude birthday events so they don't get merged
      items = items.filter((item) => !isGoogleBirthdayEvent(item));
    }

    const events = items.map((item) =>
      googleEventToJmap(item, isBirthdays ? GOOGLE_BIRTHDAY_CALENDAR_ID : calendarId, accountEmail)
    );

    const response = NextResponse.json({ events });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception fetching Google events', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawCalendarId = body.calendarId || 'primary';
    const calendarId = cleanCalendarId(rawCalendarId);
    const eventInput: Partial<CalendarEvent> = body.event || {};

    const googlePayload = jmapEventToGoogle(eventInput);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googlePayload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error('Failed to create Google event', { status: res.status, errBody });
      return NextResponse.json({ error: 'google_api_error', detail: errBody }, { status: 502 });
    }

    const created = (await res.json()) as GoogleEvent;
    const accountEmail = session.tokens.email || 'google';
    const jmapEvent = googleEventToJmap(created, calendarId, accountEmail);

    const response = NextResponse.json({ event: jmapEvent });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception creating Google event', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
