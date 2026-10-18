import { NextRequest, NextResponse } from 'next/server';
import {
  decryptGoogleSessionData,
  encryptGoogleSessionData,
  GOOGLE_SESSION_COOKIE,
} from '@/lib/google/auth';
import { matchesComailOwner } from '@/lib/google/session';
import {
  syncGoogleSessionWithStorage,
  removeGoogleAccountsFromStorage,
} from '@/lib/linked-accounts-sync';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let targetAccountId: string | undefined;
  let targetEmail: string | undefined;
  let targetComailAccountId: string | undefined;
  let targetComailAccountEmail: string | undefined;

  try {
    const body = await request.json();
    targetAccountId = body?.accountId;
    targetEmail = body?.email;
    targetComailAccountId = body?.comailAccountId;
    targetComailAccountEmail = body?.comailAccountEmail;
  } catch {
    // Body is optional
  }
  if (!targetComailAccountId) {
    targetComailAccountId = request.headers.get('x-comail-account-id') || undefined;
  }
  if (!targetComailAccountEmail) {
    targetComailAccountEmail = request.headers.get('x-comail-account-email') || undefined;
  }

  const cookie = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  const cookieSession = cookie ? decryptGoogleSessionData(cookie) : null;
  const { sessionData } = await syncGoogleSessionWithStorage(request, cookieSession, {
    comailAccountId: targetComailAccountId,
    comailAccountEmail: targetComailAccountEmail,
  });

  if (!sessionData || sessionData.accounts.length === 0) {
    await removeGoogleAccountsFromStorage(
      request,
      { accounts: [] },
      [targetAccountId || '', targetEmail || ''].filter(Boolean),
      { comailAccountId: targetComailAccountId, comailAccountEmail: targetComailAccountEmail }
    );
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
        matchesComailOwner(a, targetComailAccountId, targetComailAccountEmail)
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

      if (sessionData.accounts.length > 0 && sessionData.activeAccountId === removed.id) {
        sessionData.activeAccountId = sessionData.accounts[0].id;
      }

      await removeGoogleAccountsFromStorage(
        request,
        sessionData,
        [removed.id, removed.email, targetAccountId || '', targetEmail || ''].filter(Boolean),
        { comailAccountId: targetComailAccountId, comailAccountEmail: targetComailAccountEmail }
      );

      if (sessionData.accounts.length === 0) {
        const response = NextResponse.json({ ok: true, disconnected: true, remainingAccounts: 0 });
        response.cookies.delete(GOOGLE_SESSION_COOKIE);
        return response;
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
  const accountsToRevoke =
    targetComailAccountId || targetComailAccountEmail
      ? sessionData.accounts.filter((a) =>
          matchesComailOwner(a, targetComailAccountId, targetComailAccountEmail)
        )
      : sessionData.accounts;

  const removedKeys: string[] = [];
  for (const acc of accountsToRevoke) {
    if (acc.id) removedKeys.push(acc.id);
    if (acc.email) removedKeys.push(acc.email);
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

  if (targetComailAccountId || targetComailAccountEmail) {
    sessionData.accounts = sessionData.accounts.filter(
      (a) => !matchesComailOwner(a, targetComailAccountId, targetComailAccountEmail)
    );
  } else {
    sessionData.accounts = [];
  }

  if (
    sessionData.activeAccountId &&
    !sessionData.accounts.some((a) => a.id === sessionData.activeAccountId)
  ) {
    sessionData.activeAccountId = sessionData.accounts[0]?.id;
  }

  await removeGoogleAccountsFromStorage(request, sessionData, removedKeys, {
    comailAccountId: targetComailAccountId,
    comailAccountEmail: targetComailAccountEmail,
  });

  if (sessionData.accounts.length === 0) {
    const response = NextResponse.json({ ok: true, disconnected: true, remainingAccounts: 0 });
    response.cookies.delete(GOOGLE_SESSION_COOKIE);
    return response;
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

