import { NextRequest, NextResponse } from 'next/server';
import { encryptPayload, decryptPayload } from '@/lib/auth/crypto';
import { MicrosoftSessionData, MicrosoftAccountTokens } from './types';
import { getValidMicrosoftToken } from './auth';
import {
  syncMicrosoftSessionWithStorage,
  saveMicrosoftSessionToStorage,
} from '@/lib/linked-accounts-sync';

export const MICROSOFT_COOKIE_NAME = 'microsoft_tokens';
const PURPOSE = 'microsoft-tokens';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function getMicrosoftSession(request: NextRequest): MicrosoftSessionData {
  const token = request.cookies.get(MICROSOFT_COOKIE_NAME)?.value;
  if (!token) {
    return { accounts: [] };
  }

  const payload = decryptPayload(token, PURPOSE);
  if (!payload || !Array.isArray(payload.accounts)) {
    return { accounts: [] };
  }

  return { accounts: payload.accounts as MicrosoftAccountTokens[] };
}

export async function getMicrosoftSessionWithSync(
  request: NextRequest,
  hints?: { comailAccountId?: string; comailAccountEmail?: string }
): Promise<{ session: MicrosoftSessionData; cookieChanged: boolean }> {
  const cookieSession = getMicrosoftSession(request);
  const { sessionData, cookieChanged } = await syncMicrosoftSessionWithStorage(
    request,
    cookieSession,
    hints
  );
  return { session: sessionData, cookieChanged };
}

export function setMicrosoftSessionCookie(response: NextResponse, sessionData: MicrosoftSessionData): void {
  if (sessionData.accounts.length === 0) {
    response.cookies.delete(MICROSOFT_COOKIE_NAME);
    return;
  }

  const token = encryptPayload({ accounts: sessionData.accounts }, PURPOSE);
  response.cookies.set(MICROSOFT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getValidMicrosoftAccounts(request: NextRequest): Promise<{
  accounts: MicrosoftAccountTokens[];
  updatedSession: MicrosoftSessionData | null;
}> {
  const { session, cookieChanged } = await getMicrosoftSessionWithSync(request);
  if (session.accounts.length === 0) {
    return {
      accounts: [],
      updatedSession: cookieChanged ? { accounts: [] } : null,
    };
  }

  let anyRefreshed = false;
  const validAccounts: MicrosoftAccountTokens[] = [];

  for (const acc of session.accounts) {
    try {
      const { account, refreshed } = await getValidMicrosoftToken(acc);
      if (refreshed) {
        account.updatedAt = Date.now();
        anyRefreshed = true;
      }
      validAccounts.push(account);
    } catch {
      // Skip invalid/expired accounts that cannot be refreshed
      anyRefreshed = true;
    }
  }

  if (anyRefreshed) {
    await saveMicrosoftSessionToStorage(request, { accounts: validAccounts });
  }

  return {
    accounts: validAccounts,
    updatedSession: anyRefreshed || cookieChanged ? { accounts: validAccounts } : null,
  };
}

