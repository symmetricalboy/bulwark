import { NextRequest, NextResponse } from 'next/server';
import {
  decryptGoogleSessionData,
  encryptGoogleSessionData,
  GOOGLE_SESSION_COOKIE,
} from '@/lib/google/auth';
import { matchesComailOwner } from '@/lib/google/session';
import type { GoogleAccountAppToggles, GoogleAppMode } from '@/lib/google/types';
import { DEFAULT_GOOGLE_APP_TOGGLES, normalizeAppMode } from '@/lib/google/types';
import {
  syncGoogleSessionWithStorage,
  saveGoogleSessionToStorage,
} from '@/lib/linked-accounts-sync';

export const dynamic = 'force-dynamic';

const VALID_APPS: Array<keyof GoogleAccountAppToggles> = [
  'gmail',
  'drive',
  'calendar',
  'tasks',
  'contacts',
];

export async function POST(request: NextRequest) {
  let body: {
    accountId?: string;
    app?: keyof GoogleAccountAppToggles;
    enabled?: boolean | GoogleAppMode;
    settings?: Partial<GoogleAccountAppToggles>;
    comailAccountId?: string;
    comailAccountEmail?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { accountId, app, enabled, settings } = body;
  const comailAccountId = body.comailAccountId || request.headers.get('x-comail-account-id') || undefined;
  const comailAccountEmail = body.comailAccountEmail || request.headers.get('x-comail-account-email') || undefined;
  if (!accountId || (!app && !settings)) {
    return NextResponse.json(
      { error: 'Missing accountId, or missing app / settings' },
      { status: 400 }
    );
  }

  if (app && !VALID_APPS.includes(app)) {
    return NextResponse.json(
      { error: `Invalid app. Must be one of: ${VALID_APPS.join(', ')}` },
      { status: 400 }
    );
  }

  const cookie = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  const cookieSession = cookie ? decryptGoogleSessionData(cookie) : null;
  const { sessionData } = await syncGoogleSessionWithStorage(request, cookieSession, {
    comailAccountId,
    comailAccountEmail,
  });

  if (!sessionData || sessionData.accounts.length === 0) {
    return NextResponse.json({ error: 'No connected Google accounts' }, { status: 404 });
  }

  const account = sessionData.accounts.find(
    (a) =>
      (a.id === accountId || a.email.toLowerCase() === accountId.toLowerCase()) &&
      matchesComailOwner(a, comailAccountId, comailAccountEmail)
  );

  if (!account) {
    return NextResponse.json({ error: 'Google account not found' }, { status: 404 });
  }

  if (!account.enabledApps) {
    account.enabledApps = { ...DEFAULT_GOOGLE_APP_TOGGLES };
  }

  if (settings) {
    if (settings.gmail !== undefined) account.enabledApps.gmail = Boolean(settings.gmail);
    if (settings.drive !== undefined) account.enabledApps.drive = Boolean(settings.drive);
    if (settings.calendar !== undefined) account.enabledApps.calendar = normalizeAppMode(settings.calendar);
    if (settings.tasks !== undefined) account.enabledApps.tasks = normalizeAppMode(settings.tasks);
    if (settings.contacts !== undefined) account.enabledApps.contacts = normalizeAppMode(settings.contacts);
  } else if (app) {
    if (app === 'gmail' || app === 'drive') {
      account.enabledApps[app] = Boolean(enabled);
    } else {
      account.enabledApps[app] = normalizeAppMode(enabled);
    }
  }
  account.updatedAt = Date.now();

  await saveGoogleSessionToStorage(request, sessionData, {
    comailAccountId,
    comailAccountEmail,
  });

  const response = NextResponse.json({
    ok: true,
    account: {
      id: account.id,
      email: account.email,
      enabledApps: account.enabledApps,
    },
  });

  response.cookies.set({
    name: GOOGLE_SESSION_COOKIE,
    value: encryptGoogleSessionData(sessionData),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

