import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { mapMicrosoftToJmapCalendar } from '@/lib/microsoft/calendar-mapper';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import {
  MicrosoftGraphCalendar,
  isMicrosoftAppEnabled,
  resolveMicrosoftAppMode,
  MicrosoftAppMode,
} from '@/lib/microsoft/types';
import { Calendar } from '@/lib/jmap/types';
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
  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const enabledAccounts = accounts.filter((a) => isMicrosoftAppEnabled(a.apps?.calendar));
  if (enabledAccounts.length === 0) {
    const res = NextResponse.json({ calendars: [], accounts: [] });
    if (updatedSession) setMicrosoftSessionCookie(res, updatedSession);
    return res;
  }

  const allCalendars: Calendar[] = [];
  const accountGroups: Array<{ email: string; mode: MicrosoftAppMode; calendars: Calendar[] }> = [];

  for (const account of enabledAccounts) {
    try {
      const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/calendars`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      if (!res.ok) {
        logger.error('Failed to fetch Microsoft calendars for account', {
          email: account.email,
          status: res.status,
        });
        continue;
      }

      const data = await res.json();
      const items: MicrosoftGraphCalendar[] = data.value || [];
      const mapped = items.map((item) => mapMicrosoftToJmapCalendar(item, account.email));
      allCalendars.push(...mapped);
      accountGroups.push({
        email: account.email,
        mode: resolveMicrosoftAppMode(account.apps?.calendar),
        calendars: mapped,
      });
    } catch (err) {
      logger.error('Exception fetching Microsoft calendars', { email: account.email, error: err });
    }
  }

  const response = NextResponse.json({ calendars: allCalendars, accounts: accountGroups });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function PATCH(request: NextRequest) {
  let body: { calendarId: string; updates: Partial<Calendar> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parseNamespacedId(body.calendarId || '');
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft calendar ID' }, { status: 400 });
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

  const patchPayload: Record<string, unknown> = {};
  if (body.updates?.name !== undefined) {
    patchPayload.name = body.updates.name;
  }

  const res = await fetch(
    `${MICROSOFT_GRAPH_BASE}/me/calendars/${encodeURIComponent(parsed.rawId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchPayload),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to update Microsoft calendar', { status: res.status, error: errText });
    return NextResponse.json(
      { error: 'Failed to update Microsoft calendar' },
      { status: res.status }
    );
  }

  const updatedItem: MicrosoftGraphCalendar = await res.json();
  const mapped = mapMicrosoftToJmapCalendar(updatedItem, account.email);
  if (body.updates?.color) {
    mapped.color = body.updates.color;
  }

  const response = NextResponse.json({ calendar: mapped });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
