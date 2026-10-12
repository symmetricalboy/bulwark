import { NextRequest, NextResponse } from 'next/server';
import {
  decryptGoogleSessionData,
  encryptGoogleSessionData,
  encryptGoogleTokens,
  getValidGoogleAccessToken,
  GOOGLE_SESSION_COOKIE,
} from './auth';
import type { GoogleTokens, GoogleSessionData, LinkedGoogleAccount, GoogleAccountAppToggles } from './types';
import { isAppEnabled } from './types';
import { logger } from '@/lib/logger';

export interface GoogleSessionResult {
  tokens: GoogleTokens;
  accessToken: string;
  refreshedTokens?: GoogleTokens;
  refreshedSessionData?: GoogleSessionData;
  account?: LinkedGoogleAccount;
  sessionData?: GoogleSessionData;
}

export interface AllGoogleSessionsResult {
  sessions: GoogleSessionResult[];
  sessionData: GoogleSessionData;
  refreshedSessionData?: GoogleSessionData;
}

export interface GoogleSessionOptions {
  accountId?: string;
  app?: keyof GoogleAccountAppToggles;
  comailAccountId?: string;
  comailAccountEmail?: string;
}

function resolveCandidateAccounts(
  sessionData: GoogleSessionData,
  request: NextRequest,
  options?: GoogleSessionOptions
): LinkedGoogleAccount[] {
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

  return candidateAccounts;
}

export async function getAllGoogleSessions(
  request: NextRequest,
  options?: GoogleSessionOptions
): Promise<AllGoogleSessionsResult | null> {
  const cookie = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  if (!cookie) return null;

  const sessionData = decryptGoogleSessionData(cookie);
  if (!sessionData || sessionData.accounts.length === 0) return null;

  let candidateAccounts = resolveCandidateAccounts(sessionData, request, options);

  if (options?.app) {
    candidateAccounts = candidateAccounts.filter((a) => {
      if (!a.enabledApps) return false;
      const val = a.enabledApps[options.app!];
      return isAppEnabled(val);
    });
  }

  if (candidateAccounts.length === 0) return null;

  let anyRefreshed = false;
  const sessions: GoogleSessionResult[] = [];

  for (const account of candidateAccounts) {
    try {
      let refreshed: GoogleTokens | undefined;
      const accessToken = await getValidGoogleAccessToken(account.tokens, (newTokens) => {
        refreshed = newTokens;
      });

      if (refreshed) {
        account.tokens = refreshed;
        anyRefreshed = true;
      }

      sessions.push({
        tokens: account.tokens,
        accessToken,
        refreshedTokens: refreshed,
        account,
        sessionData,
      });
    } catch (err) {
      logger.warn('Failed to get valid Google access token for account in getAllGoogleSessions', {
        email: account.email,
        err,
      });
    }
  }

  if (sessions.length === 0) return null;

  return {
    sessions,
    sessionData,
    refreshedSessionData: anyRefreshed ? { ...sessionData } : undefined,
  };
}

export async function getGoogleSession(
  request: NextRequest,
  options?: GoogleSessionOptions
): Promise<GoogleSessionResult | null> {
  const cookie = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  if (!cookie) return null;

  const sessionData = decryptGoogleSessionData(cookie);
  if (!sessionData || sessionData.accounts.length === 0) return null;

  const candidateAccounts = resolveCandidateAccounts(sessionData, request, options);
  if (candidateAccounts.length === 0) return null;

  // Resolve requested account
  let requestedId =
    options?.accountId ||
    request.nextUrl.searchParams.get('googleAccountId') ||
    request.headers.get('x-google-account-id');

  // If requestedId looks like a namespaced identifier (e.g. google:user@gmail.com::something)
  if (requestedId && requestedId.startsWith('google:')) {
    const afterPrefix = requestedId.replace(/^google:/, '');
    requestedId = afterPrefix.includes('::') ? afterPrefix.split('::')[0] : afterPrefix;
  }

  let account = requestedId
    ? candidateAccounts.find(
        (a) =>
          a.id === requestedId ||
          a.email.toLowerCase() === requestedId!.toLowerCase() ||
          (a.email && requestedId!.toLowerCase().includes(a.email.toLowerCase()))
      )
    : undefined;

  if (!account) {
    account =
      (sessionData.activeAccountId &&
        candidateAccounts.find((a) => a.id === sessionData.activeAccountId)) ||
      candidateAccounts[0];
  }

  if (!account) return null;

  // If a specific app was requested, verify that it's enabled for this account
  if (options?.app) {
    const val = account.enabledApps ? account.enabledApps[options.app] : undefined;
    if (!isAppEnabled(val)) {
      logger.info('Google app integration is disabled for this account', {
        email: account.email,
        app: options.app,
      });
      return null;
    }
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
  refreshed?: GoogleTokens | GoogleSessionData | GoogleSessionResult | AllGoogleSessionsResult
): void {
  if (!refreshed) return;

  let cookieVal: string;
  if ('refreshedSessionData' in refreshed && refreshed.refreshedSessionData) {
    cookieVal = encryptGoogleSessionData(refreshed.refreshedSessionData);
  } else if ('accounts' in refreshed && Array.isArray((refreshed as GoogleSessionData).accounts)) {
    cookieVal = encryptGoogleSessionData(refreshed as GoogleSessionData);
  } else if ('accessToken' in refreshed && typeof (refreshed as GoogleSessionResult).accessToken === 'string') {
    cookieVal = encryptGoogleTokens((refreshed as GoogleSessionResult).tokens);
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

