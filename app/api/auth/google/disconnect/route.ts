import { NextRequest, NextResponse } from 'next/server';
import {
  decryptGoogleSessionData,
  encryptGoogleSessionData,
  GOOGLE_SESSION_COOKIE,
} from '@/lib/google/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let targetAccountId: string | undefined;
  let targetEmail: string | undefined;
  let targetComailAccountId: string | undefined;

  try {
    const body = await request.json();
    targetAccountId = body?.accountId;
    targetEmail = body?.email;
    targetComailAccountId = body?.comailAccountId;
  } catch {
    // Body is optional
  }
  if (!targetComailAccountId) {
    targetComailAccountId = request.headers.get('x-comail-account-id') || undefined;
  }

  const cookie = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  if (!cookie) {
    const response = NextResponse.json({ ok: true, disconnected: true, remainingAccounts: 0 });
    response.cookies.delete(GOOGLE_SESSION_COOKIE);
    return response;
  }

  const sessionData = decryptGoogleSessionData(cookie);
  if (!sessionData || sessionData.accounts.length === 0) {
    const response = NextResponse.json({ ok: true, disconnected: true, remainingAccounts: 0 });
    response.cookies.delete(GOOGLE_SESSION_COOKIE);
    return response;
  }

  // If a specific account was targeted, remove only that one
  if (targetAccountId || targetEmail) {
    const targetIdx = sessionData.accounts.findIndex(
      (a) =>
        ((targetAccountId && a.id === targetAccountId) ||
        (targetEmail && a.email.toLowerCase() === targetEmail.toLowerCase())) &&
        (!targetComailAccountId || !a.comailAccountId || a.comailAccountId === targetComailAccountId)
    );

    if (targetIdx >= 0) {
      const [removed] = sessionData.accounts.splice(targetIdx, 1);
      if (removed?.tokens?.accessToken) {
        try {
          await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(removed.tokens.accessToken)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
          );
        } catch {
          // ignore revoke failure
        }
      }

      if (sessionData.accounts.length === 0) {
        const response = NextResponse.json({ ok: true, disconnected: true, remainingAccounts: 0 });
        response.cookies.delete(GOOGLE_SESSION_COOKIE);
        return response;
      }

      // If removed account was active, update activeAccountId
      if (sessionData.activeAccountId === removed.id) {
        sessionData.activeAccountId = sessionData.accounts[0].id;
      }

      const response = NextResponse.json({
        ok: true,
        disconnected: true,
        remainingAccounts: sessionData.accounts.length,
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
  }

  // Revoke all accounts matching targetComailAccountId (or all if not specified)
  const accountsToRevoke = targetComailAccountId
    ? sessionData.accounts.filter(
        (a) => !a.comailAccountId || a.comailAccountId === targetComailAccountId
      )
    : sessionData.accounts;

  for (const acc of accountsToRevoke) {
    if (acc.tokens?.accessToken) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(acc.tokens.accessToken)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );
      } catch {
        // ignore revoke failure
      }
    }
  }

  if (targetComailAccountId) {
    sessionData.accounts = sessionData.accounts.filter(
      (a) => a.comailAccountId && a.comailAccountId !== targetComailAccountId
    );
  } else {
    sessionData.accounts = [];
  }

  if (sessionData.accounts.length === 0) {
    const response = NextResponse.json({ ok: true, disconnected: true, remainingAccounts: 0 });
    response.cookies.delete(GOOGLE_SESSION_COOKIE);
    return response;
  }

  if (
    sessionData.activeAccountId &&
    !sessionData.accounts.some((a) => a.id === sessionData.activeAccountId)
  ) {
    sessionData.activeAccountId = sessionData.accounts[0].id;
  }

  const response = NextResponse.json({
    ok: true,
    disconnected: true,
    remainingAccounts: sessionData.accounts.length,
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
