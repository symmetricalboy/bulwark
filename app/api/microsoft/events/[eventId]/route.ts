import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { mapMicrosoftToJmapEvent, mapJmapToMicrosoftEvent } from '@/lib/microsoft/calendar-mapper';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import { MicrosoftGraphEvent, isMicrosoftAppEnabled } from '@/lib/microsoft/types';
import { CalendarEvent } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';

function parseNamespacedId(namespacedId: string): { email: string; rawId: string } | null {
  if (!namespacedId.startsWith('microsoft:')) return null;
  const withoutPrefix = namespacedId.slice('microsoft:'.length);
  const sepIdx = withoutPrefix.indexOf('::');
  if (sepIdx === -1) return null;
  return {
    email: withoutPrefix.slice(0, sepIdx),
    rawId: withoutPrefix.slice(sepIdx + 2),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const decodedEventId = decodeURIComponent(eventId);
  const parsedEvent = parseNamespacedId(decodedEventId);

  let body: { calendarId: string; updates: Partial<CalendarEvent> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsedCal = parseNamespacedId(body.calendarId);
  if (!parsedEvent || !parsedCal) {
    return NextResponse.json({ error: 'Invalid Microsoft IDs' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsedCal.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.calendar)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const msPayload = mapJmapToMicrosoftEvent(body.updates);
  const url = `${MICROSOFT_GRAPH_BASE}/me/events/${encodeURIComponent(parsedEvent.rawId)}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(msPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to update Microsoft event', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to update Microsoft event' }, { status: res.status });
  }

  const updated: MicrosoftGraphEvent = await res.json();
  const event = mapMicrosoftToJmapEvent(updated, body.calendarId, account.email);

  const response = NextResponse.json({ event });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const decodedEventId = decodeURIComponent(eventId);
  const parsedEvent = parseNamespacedId(decodedEventId);
  const calendarId = request.nextUrl.searchParams.get('calendarId') || '';
  const parsedCal = parseNamespacedId(calendarId);

  if (!parsedEvent || !parsedCal) {
    return NextResponse.json({ error: 'Invalid Microsoft IDs' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsedCal.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.calendar)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const url = `${MICROSOFT_GRAPH_BASE}/me/events/${encodeURIComponent(parsedEvent.rawId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    logger.error('Failed to delete Microsoft event', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to delete Microsoft event' }, { status: res.status });
  }

  const response = NextResponse.json({ success: true });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
