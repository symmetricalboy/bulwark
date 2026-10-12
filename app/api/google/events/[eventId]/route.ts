import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import { googleEventToJmap, jmapEventToGoogle } from '@/lib/google/calendar-mapper';
import type { GoogleEvent } from '@/lib/google/types';
import type { CalendarEvent } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function cleanId(id: string): string {
  const parts = id.split('::');
  return parts.length > 1 ? parts[1] : id;
}

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { eventId: rawEventId } = await params;
  const eventId = cleanId(rawEventId);

  try {
    const body = await request.json();
    const rawCalendarId = body.calendarId || 'primary';
    const calendarId = cleanId(rawCalendarId);
    const eventUpdates: Partial<CalendarEvent> = body.updates || {};

    const session = await getGoogleSession(request, {
      accountId: rawCalendarId.startsWith('google:') ? rawCalendarId : rawEventId,
      app: 'calendar',
    });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    const patchPayload = jmapEventToGoogle(eventUpdates);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchPayload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error('Failed to update Google event', { status: res.status, eventId, errBody });
      return NextResponse.json({ error: 'google_api_error', detail: errBody }, { status: 502 });
    }

    const updated = (await res.json()) as GoogleEvent;
    const accountEmail = session.tokens.email || 'google';
    const jmapEvent = googleEventToJmap(updated, calendarId, accountEmail);

    const response = NextResponse.json({ event: jmapEvent });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception updating Google event', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { eventId: rawEventId } = await params;
  const eventId = cleanId(rawEventId);
  const rawCalendarId = request.nextUrl.searchParams.get('calendarId') || 'primary';
  const calendarId = cleanId(rawCalendarId);

  const session = await getGoogleSession(request, {
    accountId: rawCalendarId.startsWith('google:') ? rawCalendarId : rawEventId,
    app: 'calendar',
  });
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!res.ok && res.status !== 404 && res.status !== 410) {
      logger.error('Failed to delete Google event', { status: res.status, eventId });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const response = NextResponse.json({ ok: true, deletedId: rawEventId });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception deleting Google event', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
