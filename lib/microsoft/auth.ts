import { MicrosoftAccountTokens } from './types';
import { logger } from '@/lib/logger';

const MICROSOFT_AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
export const MICROSOFT_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'Contacts.ReadWrite',
  'Tasks.ReadWrite',
  'Files.ReadWrite',
];

function getMicrosoftCredentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/auth/microsoft/callback';

  return { clientId, clientSecret, redirectUri };
}

/**
 * Resolves the Microsoft OAuth callback URL for the current request origin
 * (supporting both localhost and https://comail.symmetricalboy.com on a single Entra App Registration).
 */
export function resolveMicrosoftRedirectUri(requestOrigin?: string): string {
  const envUri = process.env.MICROSOFT_REDIRECT_URI?.trim();
  if (requestOrigin) {
    try {
      const originUrl = new URL(requestOrigin);
      const dynamicUri = `${originUrl.origin}/api/auth/microsoft/callback`;
      if (!envUri) return dynamicUri;
      const envOrigin = new URL(envUri).origin;
      if (envOrigin !== originUrl.origin) {
        return dynamicUri;
      }
    } catch {
      // Fall back to envUri
    }
  }
  return envUri || 'http://localhost:3000/api/auth/microsoft/callback';
}

export function isMicrosoftOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getMicrosoftCredentials();
  return !!(clientId && clientSecret);
}

export function buildMicrosoftAuthUrl(state: string, redirectUriOverride?: string): string {
  const { clientId, redirectUri } = getMicrosoftCredentials();
  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID is not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUriOverride || redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: MICROSOFT_SCOPES.join(' '),
    prompt: 'select_account',
    state,
  });

  return `${MICROSOFT_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeMicrosoftCodeForTokens(
  code: string,
  redirectUriOverride?: string
): Promise<Omit<MicrosoftAccountTokens, 'id' | 'email' | 'name'>> {
  const { clientId, clientSecret, redirectUri } = getMicrosoftCredentials();
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials are not configured');
  }

  const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUriOverride || redirectUri,
      grant_type: 'authorization_code',
      scope: MICROSOFT_SCOPES.join(' '),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error('Failed to exchange Microsoft OAuth code', { status: response.status, error: errText });
    throw new Error('Failed to exchange Microsoft authorization code for tokens');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

export async function refreshMicrosoftTokens(refreshToken: string): Promise<{ accessToken: string; expiresAt: number; refreshToken?: string }> {
  const { clientId, clientSecret } = getMicrosoftCredentials();
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials are not configured');
  }

  const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      scope: MICROSOFT_SCOPES.join(' '),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error('Failed to refresh Microsoft OAuth token', { status: response.status, error: errText });
    throw new Error('Failed to refresh Microsoft token');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    refreshToken: data.refresh_token || refreshToken,
  };
}

export async function fetchMicrosoftUserProfile(accessToken: string): Promise<{ email: string; name?: string; id?: string }> {
  const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Microsoft user profile');
  }

  const data = await response.json();
  const email = (data.mail || data.userPrincipalName || '').toLowerCase();
  return {
    id: data.id,
    email,
    name: data.displayName || undefined,
  };
}

export async function getValidMicrosoftToken(account: MicrosoftAccountTokens): Promise<{ account: MicrosoftAccountTokens; refreshed: boolean }> {
  if (Date.now() < account.expiresAt - 5 * 60 * 1000) {
    return { account, refreshed: false };
  }

  if (!account.refreshToken) {
    throw new Error('Microsoft token expired and no refresh token available');
  }

  const refreshed = await refreshMicrosoftTokens(account.refreshToken);
  return {
    account: {
      ...account,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || account.refreshToken,
      expiresAt: refreshed.expiresAt,
    },
    refreshed: true,
  };
}
