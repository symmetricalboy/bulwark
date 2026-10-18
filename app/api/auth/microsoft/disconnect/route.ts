import { NextRequest, NextResponse } from 'next/server';
import {
  getMicrosoftSessionWithSync,
  setMicrosoftSessionCookie,
  MICROSOFT_COOKIE_NAME,
} from '@/lib/microsoft/session';
import { removeMicrosoftAccountsFromStorage } from '@/lib/linked-accounts-sync';

export async function POST(request: NextRequest) {
  let body: { email?: string; accountId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Allow empty body to clear all
  }

  const { session } = await getMicrosoftSessionWithSync(request);
  const target = (body.accountId || body.email)?.toLowerCase();
  const removedKeys: string[] = [];

  if (target) {
    if (body.accountId) removedKeys.push(body.accountId);
    if (body.email) removedKeys.push(body.email);
    for (const a of session.accounts) {
      if ((a.id || a.email).toLowerCase() === target || a.email.toLowerCase() === target) {
        if (a.id) removedKeys.push(a.id);
        if (a.email) removedKeys.push(a.email);
      }
    }
    session.accounts = session.accounts.filter(
      (a) => (a.id || a.email).toLowerCase() !== target && a.email.toLowerCase() !== target
    );
  } else {
    for (const a of session.accounts) {
      if (a.id) removedKeys.push(a.id);
      if (a.email) removedKeys.push(a.email);
    }
    session.accounts = [];
  }

  await removeMicrosoftAccountsFromStorage(request, session, removedKeys);

  const response = NextResponse.json({
    success: true,
    accounts: session.accounts.map((a) => ({
      id: a.id || a.email.toLowerCase(),
      email: a.email,
      name: a.name,
      apps: a.apps,
    })),
  });

  if (session.accounts.length === 0) {
    response.cookies.delete(MICROSOFT_COOKIE_NAME);
  } else {
    setMicrosoftSessionCookie(response, session);
  }

  return response;
}

