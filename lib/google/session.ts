import { NextRequest, NextResponse } from 'next/server';
import {
  decryptGoogleSessionData,
  encryptGoogleSessionData,
  encryptGoogleTokens,
  getValidGoogleAccessToken,
  GOOGLE_SESSION_COOKIE,
} from './auth';
import type { GoogleTokens, GoogleSessionData, LinkedGoogleAccount, GoogleAccountAppToggles } from './types';
import { logger } from '@/lib/logger';

export interface GoogleSessionResult {
  tokens: GoogleTokens;
  accessToken: string;
  refreshedTokens?: GoogleTokens;
  refreshedSessionData?: GoogleSessionData;
  account?: LinkedGoogleAccount;
  sessionData?: GoogleSessionData;
}

export interface GoogleSessionOptions {
  accountId?: string;
  app?: keyof GoogleAccountAppToggles;
  comailAccountId?: string;
  comailAccountEmail?: string;
}

export async function getGoogleSession(
  request: NextRequest,
  options?: GoogleSessionOptions
): Promise<GoogleSessionResult | null> {
  const cookie = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  if (!cookie) return null;

  const sessionData = decryptGoogleSessionData(cookie);
  if (!sessionData || sessionData.accounts.length === 0) return null;

  const requestedComailId =
    options?.comailAccountId ||
    request.nextUrl.searchParams.get('comailAccountId') ||
    request.headers.get('x-comail-account-id') ||
    undefined;

  const requestedComailEmail =
    options?.comailAccountEmail ||
    request.nextUrl.searchParams.get('comailAccountEmail') ||
    request.headers.get('x-comail-account-email') ||
    undefined;

  // Filter accounts by Comail ownership if specified
  let candidateAccounts = sessionData.accounts;
  if (requestedComailId || requestedComailEmail) {
    candidateAccounts = sessionData.accounts.filter((a) => {
      if (requestedComailId && a.comailAccountId) {
        return a.comailAccountId === requestedComailId;
      }
      if (requestedComailEmail && a.comailAccountEmail) {
        return a.comailAccountEmail.toLowerCase() === requestedComailEmail.toLowerCase();
      }
      // Allow legacy accounts without tagged owner
      if (!a.comailAccountId && !a.comailAccountEmail) {
        return true;
      }
      return false;
    });
  }

  if (candidateAccounts.length === 0) return null;

  // Resolve requested account
  const requestedId =
    options?.accountId ||
    request.nextUrl.searchParams.get('googleAccountId') ||
    request.headers.get('x-google-account-id');

  let account = requestedId
    ? candidateAccounts.find((a) => a.id === requestedId || a.email.toLowerCase() === requestedId.toLowerCase())
    : undefined;

  if (!account) {
    account =
      (sessionData.activeAccountId &&
        candidateAccounts.find((a) => a.id === sessionData.activeAccountId)) ||
      candidateAccounts[0];
  }

  if (!account) return null;

  // If a specific app was requested, verify that it's enabled for this account
  if (options?.app && account.enabledApps && account.enabledApps[options.app] === false) {
    logger.info('Google app integration is disabled for this account', {
      email: account.email,
      app: options.app,
    });
    return null;
  }

  try {
    let refreshed: GoogleTokens | undefined;
    const accessToken = await getValidGoogleAccessToken(account.tokens, (newTokens) => {
      refreshed = newTokens;
    });

    let refreshedSessionData: GoogleSessionData | undefined;
    if (refreshed) {
      account.tokens = refreshed;
      refreshedSessionData = { ...sessionData };
    }

    return {
      tokens: refreshed || account.tokens,
      accessToken,
      refreshedTokens: refreshed,
      refreshedSessionData,
      account,
      sessionData,
    };
  } catch (err) {
    logger.warn('Failed to get valid Google access token for session', { err });
    return null;
  }
}

export function attachRefreshedTokens(
  response: NextResponse,
  refreshed?: GoogleTokens | GoogleSessionData | GoogleSessionResult
): void {
  if (!refreshed) return;

  let cookieVal: string;
  if ('refreshedSessionData' in refreshed && refreshed.refreshedSessionData) {
    cookieVal = encryptGoogleSessionData(refreshed.refreshedSessionData);
  } else if ('accounts' in refreshed && Array.isArray((refreshed as GoogleSessionData).accounts)) {
    cookieVal = encryptGoogleSessionData(refreshed as GoogleSessionData);
  } else if ('accessToken' in refreshed && typeof refreshed.accessToken === 'string') {
    cookieVal = encryptGoogleTokens(refreshed as GoogleTokens);
  } else {
    return;
  }

  response.cookies.set({
    name: GOOGLE_SESSION_COOKIE,
    value: cookieVal,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}
