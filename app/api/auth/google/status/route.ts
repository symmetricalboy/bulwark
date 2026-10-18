import { NextRequest, NextResponse } from 'next/server';
import {
  decryptGoogleSessionData,
  encryptGoogleSessionData,
  fetchGoogleUserProfile,
  getGoogleConfig,
  getValidGoogleAccessToken,
  GOOGLE_SESSION_COOKIE,
} from '@/lib/google/auth';
import { matchesComailOwner } from '@/lib/google/session';
import {
  syncGoogleSessionWithStorage,
  saveGoogleSessionToStorage,
} from '@/lib/linked-accounts-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { isConfigured } = getGoogleConfig();
  const requestedComailId =
    request.nextUrl.searchParams.get('comailAccountId') ||
    request.headers.get('x-comail-account-id') ||
    undefined;
  const requestedComailEmail =
    request.nextUrl.searchParams.get('comailAccountEmail') ||
    request.headers.get('x-comail-account-email') ||
    undefined;

  const cookie = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  const cookieSession = cookie ? decryptGoogleSessionData(cookie) : null;

  const { sessionData: session, cookieChanged } = await syncGoogleSessionWithStorage(
    request,
    cookieSession,
    { comailAccountId: requestedComailId, comailAccountEmail: requestedComailEmail }
  );

  if (!session || session.accounts.length === 0) {
    const emptyRes = NextResponse.json({
      configured: isConfigured,
      connected: false,
      accounts: [],
    });
    if (cookieChanged && cookie) {
      emptyRes.cookies.delete(GOOGLE_SESSION_COOKIE);
    }
    return emptyRes;
  }

  let sessionModified = false;
  for (const a of session.accounts) {
    if (!a.picture || !a.name) {
      try {
        const accessToken = await getValidGoogleAccessToken(a.tokens, (refreshed) => {
          a.tokens = refreshed;
          a.updatedAt = Date.now();
          sessionModified = true;
        });
        const profile = await fetchGoogleUserProfile(accessToken);
        if (profile) {
          if (!a.picture && profile.picture) {
            a.picture = profile.picture;
            a.tokens.picture = profile.picture;
            a.updatedAt = Date.now();
            sessionModified = true;
          }
          if (!a.name && profile.name) {
            a.name = profile.name;
            a.tokens.name = profile.name;
            a.updatedAt = Date.now();
            sessionModified = true;
          }
        }
      } catch {
        // fail-open if tokens are expired or cannot be refreshed
      }
    }
  }

  let filteredAccounts = session.accounts;
  if (requestedComailId || requestedComailEmail) {
    filteredAccounts = session.accounts.filter((a) => {
      // Backfill / legacy fallback: if an existing linked account had no comailAccountId/email recorded yet,
      // associate it with this first request so it's not lost
      if (!a.comailAccountId && !a.comailAccountEmail) {
        if (requestedComailId) a.comailAccountId = requestedComailId;
        if (requestedComailEmail) a.comailAccountEmail = requestedComailEmail;
        a.updatedAt = Date.now();
        sessionModified = true;
        return true;
      }
      return matchesComailOwner(a, requestedComailId, requestedComailEmail);
    });
  }

  if (sessionModified) {
    await saveGoogleSessionToStorage(request, session, {
      comailAccountId: requestedComailId,
      comailAccountEmail: requestedComailEmail,
    });
  }

  const activeAccount =
    (session.activeAccountId && filteredAccounts.find((a) => a.id === session.activeAccountId)) ||
    filteredAccounts[0];

  const accounts = filteredAccounts.map((a) => ({
    id: a.id,
    email: a.email,
    name: a.name,
    picture: a.picture,
    enabledApps: a.enabledApps,
    connectedAt: a.connectedAt,
    comailAccountId: a.comailAccountId,
    comailAccountEmail: a.comailAccountEmail,
  }));

  const response = NextResponse.json({
    configured: isConfigured,
    connected: accounts.length > 0,
    accounts,
    email: activeAccount?.email,
    name: activeAccount?.name,
    picture: activeAccount?.picture,
  });

  if (sessionModified || cookieChanged) {
    const encrypted = encryptGoogleSessionData(session);
    response.cookies.set({
      name: GOOGLE_SESSION_COOKIE,
      value: encrypted,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return response;
}

