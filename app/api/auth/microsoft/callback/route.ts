import { NextRequest, NextResponse } from 'next/server';
import { exchangeMicrosoftCodeForTokens, fetchMicrosoftUserProfile, resolveMicrosoftRedirectUri } from '@/lib/microsoft/auth';
import { getMicrosoftSessionWithSync, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { DEFAULT_MICROSOFT_APP_TOGGLES } from '@/lib/microsoft/types';
import { saveMicrosoftSessionToStorage } from '@/lib/linked-accounts-sync';
import { decryptPayload } from '@/lib/auth/crypto';
import { logger } from '@/lib/logger';

interface OAuthState {
  returnTo: string;
  redirectUri?: string;
  nonce: string;
  createdAt: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  let returnTo = '/en/calendar';
  let stateRedirectUri: string | undefined;
  const storedState = request.cookies.get('microsoft_oauth_state')?.value;

  if (stateParam) {
    const decoded = decryptPayload(stateParam, 'microsoft-oauth-state');
    if (decoded && typeof decoded.returnTo === 'string' && decoded.returnTo.startsWith('/')) {
      returnTo = decoded.returnTo;
    }
    if (decoded && typeof decoded.redirectUri === 'string') {
      stateRedirectUri = decoded.redirectUri;
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const requestOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;

  const redirectUrl = new URL(returnTo, requestOrigin);

  if (error || !code || !stateParam || stateParam !== storedState) {
    redirectUrl.searchParams.set('microsoft_error', error || 'invalid_state');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('microsoft_oauth_state');
    return response;
  }

  try {
    const effectiveRedirectUri = stateRedirectUri || resolveMicrosoftRedirectUri(requestOrigin);
    const tokens = await exchangeMicrosoftCodeForTokens(code, effectiveRedirectUri);
    const profile = await fetchMicrosoftUserProfile(tokens.accessToken);
    const { session } = await getMicrosoftSessionWithSync(request);

    const existingIdx = session.accounts.findIndex(
      (a) => a.email.toLowerCase() === profile.email.toLowerCase()
    );
    const existingAccount = existingIdx >= 0 ? session.accounts[existingIdx] : undefined;
    const now = Date.now();

    const newAccount = {
      id: existingAccount?.id || profile.email.toLowerCase(),
      email: profile.email,
      name: profile.name || existingAccount?.name,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || existingAccount?.refreshToken || '',
      expiresAt: tokens.expiresAt,
      apps: existingAccount?.apps
        ? { ...DEFAULT_MICROSOFT_APP_TOGGLES, ...existingAccount.apps }
        : { ...DEFAULT_MICROSOFT_APP_TOGGLES },
      connectedAt: now,
      updatedAt: now,
    };

    if (!newAccount.refreshToken) {
      logger.warn('No refresh token received from Microsoft OAuth and none previously stored', {
        email: profile.email,
      });
    }

    if (existingIdx >= 0) {
      session.accounts[existingIdx] = newAccount;
    } else {
      session.accounts.push(newAccount);
    }

    await saveMicrosoftSessionToStorage(request, session, {
      clearTombstoneKeys: [newAccount.id, newAccount.email].filter(Boolean),
    });

    redirectUrl.searchParams.set('microsoft_connected', 'true');
    redirectUrl.searchParams.set('microsoft_account_id', newAccount.id);
    redirectUrl.searchParams.set('microsoft_account_email', newAccount.email);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('microsoft_oauth_state');
    setMicrosoftSessionCookie(response, session);
    return response;
  } catch (err) {
    logger.error('Error in Microsoft OAuth callback', { error: err });
    redirectUrl.searchParams.set('microsoft_error', 'token_exchange_failed');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('microsoft_oauth_state');
    return response;
  }
}

