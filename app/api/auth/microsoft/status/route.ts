import { NextRequest, NextResponse } from 'next/server';
import { getMicrosoftSessionWithSync, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { isMicrosoftOAuthConfigured } from '@/lib/microsoft/auth';
import { DEFAULT_MICROSOFT_APP_TOGGLES, resolveMicrosoftAppMode } from '@/lib/microsoft/types';

export async function GET(request: NextRequest) {
  const { session, cookieChanged } = await getMicrosoftSessionWithSync(request);
  const configured = isMicrosoftOAuthConfigured();

  const mappedAccounts = session.accounts.map((a) => {
    const apps = {
      ...DEFAULT_MICROSOFT_APP_TOGGLES,
      ...(a.apps || {}),
      outlook: Boolean(a.apps?.outlook),
      onedrive: Boolean(a.apps?.onedrive),
      calendar: resolveMicrosoftAppMode(a.apps?.calendar),
      tasks: resolveMicrosoftAppMode(a.apps?.tasks),
      contacts: resolveMicrosoftAppMode(a.apps?.contacts),
    };
    return {
      id: a.id || a.email.toLowerCase(),
      email: a.email,
      name: a.name,
      expiresAt: a.expiresAt,
      apps,
      enabledApps: {
        gmail: apps.outlook,
        drive: apps.onedrive,
        calendar: apps.calendar,
        tasks: apps.tasks,
        contacts: apps.contacts,
      },
    };
  });

  const response = NextResponse.json({
    configured,
    connected: mappedAccounts.length > 0,
    email: mappedAccounts[0]?.email,
    name: mappedAccounts[0]?.name,
    accounts: mappedAccounts,
  });

  if (cookieChanged) {
    setMicrosoftSessionCookie(response, session);
  }

  return response;
}

