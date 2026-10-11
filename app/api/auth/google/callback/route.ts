import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeGoogleCode,
  decryptGoogleSessionData,
  encryptGoogleSessionData,
  GOOGLE_SESSION_COOKIE,
} from '@/lib/google/auth';
import type { GoogleSessionData, LinkedGoogleAccount } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const stateRaw = searchParams.get('state');

  let returnTo = '/calendar';
  let comailAccountId: string | undefined;
  let comailAccountEmail: string | undefined;
  if (stateRaw) {
    try {
      const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
      if (parsed.returnTo && typeof parsed.returnTo === 'string' && parsed.returnTo.startsWith('/')) {
        returnTo = parsed.returnTo;
      }
      if (parsed.comailAccountId && typeof parsed.comailAccountId === 'string') {
        comailAccountId = parsed.comailAccountId;
      }
      if (parsed.comailAccountEmail && typeof parsed.comailAccountEmail === 'string') {
        comailAccountEmail = parsed.comailAccountEmail;
      }
    } catch {
      // ignore invalid state
    }
  }

  if (error || !code) {
    logger.warn('Google OAuth callback returned error or missing code', { error });
    const redirectUrl = new URL(returnTo, request.url);
    redirectUrl.searchParams.set('google_error', error || 'access_denied');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const tokens = await exchangeGoogleCode(code);

    // Retrieve existing session accounts if any
    const existingCookie = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
    const sessionData: GoogleSessionData = (existingCookie
      ? decryptGoogleSessionData(existingCookie)
      : null) || { accounts: [] };

    const email = tokens.email || '';
    const baseId = email || tokens.accessToken.slice(-8);
    const accountId = comailAccountId ? `${baseId}_${comailAccountId}` : baseId;

    const existingIdx = sessionData.accounts.findIndex(
      (a) =>
        (a.id === accountId || a.id === baseId || (email && a.email.toLowerCase() === email.toLowerCase())) &&
        (!comailAccountId || !a.comailAccountId || a.comailAccountId === comailAccountId)
    );

    const mergedTokens = {
      ...tokens,
      // Retain existing refresh token if Google didn't return one on re-auth
      refreshToken:
        tokens.refreshToken ||
        (existingIdx >= 0 ? sessionData.accounts[existingIdx].tokens.refreshToken : undefined),
    };

    const linkedAccount: LinkedGoogleAccount = {
      id: accountId,
      email,
      name: tokens.name || (existingIdx >= 0 ? sessionData.accounts[existingIdx].name : undefined),
      picture:
        tokens.picture || (existingIdx >= 0 ? sessionData.accounts[existingIdx].picture : undefined),
      tokens: mergedTokens,
      enabledApps:
        existingIdx >= 0
          ? sessionData.accounts[existingIdx].enabledApps
          : {
              calendar: true,
              tasks: true,
              drive: true,
              contacts: true,
            },
      connectedAt: existingIdx >= 0 ? sessionData.accounts[existingIdx].connectedAt : Date.now(),
      comailAccountId:
        comailAccountId || (existingIdx >= 0 ? sessionData.accounts[existingIdx].comailAccountId : undefined),
      comailAccountEmail:
        comailAccountEmail ||
        (existingIdx >= 0 ? sessionData.accounts[existingIdx].comailAccountEmail : undefined),
    };

    if (existingIdx >= 0) {
      sessionData.accounts[existingIdx] = linkedAccount;
    } else {
      sessionData.accounts.push(linkedAccount);
    }
    sessionData.activeAccountId = linkedAccount.id;

    const encrypted = encryptGoogleSessionData(sessionData);

    const redirectUrl = new URL(returnTo, request.url);
    redirectUrl.searchParams.set('google_connected', 'true');

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: GOOGLE_SESSION_COOKIE,
      value: encrypted,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err) {
    logger.error('Error during Google OAuth callback', { err });
    const redirectUrl = new URL(returnTo, request.url);
    redirectUrl.searchParams.set('google_error', 'token_exchange_failed');
    return NextResponse.redirect(redirectUrl);
  }
}
