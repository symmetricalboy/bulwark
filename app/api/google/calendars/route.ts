import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import {
  googleCalendarToJmap,
  createGoogleBirthdayCalendar,
  isGoogleBirthdayCalendarId,
} from '@/lib/google/calendar-mapper';
import type { GoogleCalendarListResponse } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!res.ok) {
      logger.error('Failed to list Google calendars', { status: res.status });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const data = (await res.json()) as GoogleCalendarListResponse;
    const accountEmail = session.tokens.email || 'google';
    const calendars = (data.items || []).map((item) => googleCalendarToJmap(item, accountEmail));

    const hasBirthdays = calendars.some((c) => isGoogleBirthdayCalendarId(c.originalId || ''));
    if (!hasBirthdays) {
      calendars.push(createGoogleBirthdayCalendar(accountEmail));
    }

    // Default Google calendar should always be at the top of the Google list
    calendars.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return (a.name || '').localeCompare(b.name || '');
    });

    const response = NextResponse.json({ calendars });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception fetching Google calendars', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

function cleanCalendarId(calendarId: string): string {
  const parts = calendarId.split('::');
  return parts.length > 1 ? parts[1] : calendarId;
}

export async function PATCH(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawCalendarId = body.calendarId;
    if (!rawCalendarId) {
      return NextResponse.json({ error: 'missing_calendar_id' }, { status: 400 });
    }
    const cleanId = cleanCalendarId(rawCalendarId);
    const updates = body.updates || {};

    if (cleanId === '#birthdays' || cleanId.includes('contacts@group.v.calendar.google.com')) {
      return NextResponse.json({ success: true });
    }

    // Attempt 1: PATCH users/me/calendarList/{calendarId} with summaryOverride
    // (Google Calendar API standard for renaming calendars in the user's view, works on primary too)
    const patchBody: Record<string, unknown> = {};
    if (updates.name) patchBody.summaryOverride = updates.name;

    let res = await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(cleanId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchBody),
      },
    );

    // Fallback: If not ok and we have a name update, try calendars resource with summary
    if (!res.ok && updates.name) {
      res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cleanId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ summary: updates.name }),
        },
      );
    }

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to update Google calendar', { status: res.status, errText, cleanId });
      return NextResponse.json({ error: 'google_api_error', detail: errText }, { status: 502 });
    }

    const response = NextResponse.json({ success: true });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception updating Google calendar', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
