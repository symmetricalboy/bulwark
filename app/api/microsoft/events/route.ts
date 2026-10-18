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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const calendarId = searchParams.get('calendarId');
  const timeMin = searchParams.get('timeMin');
  const timeMax = searchParams.get('timeMax');

  if (!calendarId || !timeMin || !timeMax) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const parsed = parseNamespacedId(calendarId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft calendarId' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsed.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.calendar)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const params = new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
    $top: '250',
  });

  const url = `${MICROSOFT_GRAPH_BASE}/me/calendars/${encodeURIComponent(parsed.rawId)}/calendarView?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to fetch Microsoft events', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to fetch Microsoft events' }, { status: res.status });
  }

  const data = await res.json();
  const items: MicrosoftGraphEvent[] = data.value || [];
  const events: CalendarEvent[] = items.map((item) =>
    mapMicrosoftToJmapEvent(item, calendarId, account.email)
  );

  const response = NextResponse.json({ events });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function POST(request: NextRequest) {
  let body: { calendarId: string; event: Partial<CalendarEvent> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parseNamespacedId(body.calendarId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft calendarId' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsed.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.calendar)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const msPayload = mapJmapToMicrosoftEvent(body.event);
  const url = `${MICROSOFT_GRAPH_BASE}/me/calendars/${encodeURIComponent(parsed.rawId)}/events`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(msPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to create Microsoft event', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to create Microsoft event' }, { status: res.status });
  }

  const created: MicrosoftGraphEvent = await res.json();
  const event = mapMicrosoftToJmapEvent(created, body.calendarId, account.email);

  const response = NextResponse.json({ event });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
