import { NextRequest, NextResponse } from 'next/server';
import { getMicrosoftSessionWithSync, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { saveMicrosoftSessionToStorage } from '@/lib/linked-accounts-sync';
import {
  DEFAULT_MICROSOFT_APP_TOGGLES,
  MicrosoftAccountAppToggles,
  MicrosoftAppMode,
  resolveMicrosoftAppMode,
} from '@/lib/microsoft/types';

const BOOLEAN_APP_KEYS: (keyof MicrosoftAccountAppToggles)[] = ['outlook', 'onedrive'];
const MODE_APP_KEYS: (keyof MicrosoftAccountAppToggles)[] = ['calendar', 'tasks', 'contacts'];
const VALID_APP_KEYS: (keyof MicrosoftAccountAppToggles)[] = [...BOOLEAN_APP_KEYS, ...MODE_APP_KEYS];
const VALID_MODES: MicrosoftAppMode[] = ['none', 'separate', 'sync'];

export async function POST(request: NextRequest) {
  let body: {
    accountId?: string;
    email?: string;
    app?: keyof MicrosoftAccountAppToggles;
    enabled?: boolean | MicrosoftAppMode;
    mode?: MicrosoftAppMode;
    settings?: Partial<MicrosoftAccountAppToggles>;
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const target = (body.accountId || body.email)?.toLowerCase();
  if (!target) {
    return NextResponse.json({ error: 'Missing accountId or email' }, { status: 400 });
  }

  const { session } = await getMicrosoftSessionWithSync(request);
  const idx = session.accounts.findIndex(
    (a) => (a.id || a.email).toLowerCase() === target || a.email.toLowerCase() === target
  );

  if (idx < 0) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const currentApps: MicrosoftAccountAppToggles = {
    ...DEFAULT_MICROSOFT_APP_TOGGLES,
    ...(session.accounts[idx].apps || {}),
  };

  if (body.settings && typeof body.settings === 'object') {
    for (const [k, v] of Object.entries(body.settings)) {
      const key = k as keyof MicrosoftAccountAppToggles;
      if (!VALID_APP_KEYS.includes(key)) continue;
      if (BOOLEAN_APP_KEYS.includes(key)) {
        (currentApps as Record<string, unknown>)[key] = Boolean(v);
      } else {
        (currentApps as Record<string, unknown>)[key] = resolveMicrosoftAppMode(
          v as MicrosoftAppMode | boolean
        );
      }
    }
  } else if (body.app && VALID_APP_KEYS.includes(body.app)) {
    const app = body.app;
    if (BOOLEAN_APP_KEYS.includes(app)) {
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json({ error: 'Missing boolean enabled parameter' }, { status: 400 });
      }
      (currentApps as Record<string, unknown>)[app] = body.enabled;
    } else {
      let nextMode: MicrosoftAppMode;
      if (body.mode && VALID_MODES.includes(body.mode)) {
        nextMode = body.mode;
      } else if (typeof body.enabled === 'string' && VALID_MODES.includes(body.enabled)) {
        nextMode = body.enabled;
      } else if (typeof body.enabled === 'boolean') {
        nextMode = body.enabled ? 'separate' : 'none';
      } else {
        return NextResponse.json({ error: 'Missing mode or enabled parameter' }, { status: 400 });
      }
      (currentApps as Record<string, unknown>)[app] = nextMode;
    }
  } else {
    return NextResponse.json({ error: 'Missing settings or app parameter' }, { status: 400 });
  }

  session.accounts[idx] = {
    ...session.accounts[idx],
    id: session.accounts[idx].id || session.accounts[idx].email.toLowerCase(),
    apps: currentApps,
    updatedAt: Date.now(),
  };

  await saveMicrosoftSessionToStorage(request, session);

  const response = NextResponse.json({
    success: true,
    accounts: session.accounts.map((a) => ({
      id: a.id || a.email.toLowerCase(),
      email: a.email,
      name: a.name,
      expiresAt: a.expiresAt,
      apps: {
        ...DEFAULT_MICROSOFT_APP_TOGGLES,
        ...(a.apps || {}),
        outlook: Boolean(a.apps?.outlook),
        onedrive: Boolean(a.apps?.onedrive),
        calendar: resolveMicrosoftAppMode(a.apps?.calendar),
        tasks: resolveMicrosoftAppMode(a.apps?.tasks),
        contacts: resolveMicrosoftAppMode(a.apps?.contacts),
      },
    })),
  });

  setMicrosoftSessionCookie(response, session);
  return response;
}

