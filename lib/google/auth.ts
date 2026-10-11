import { encryptPayload, decryptPayload } from '@/lib/auth/crypto';
import type { GoogleTokens, GoogleSessionData } from './types';
import { logger } from '@/lib/logger';

export const GOOGLE_SESSION_COOKIE = 'google_tokens';

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  return { clientId, clientSecret, redirectUri, isConfigured: Boolean(clientId && clientSecret) };
}

export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.readonly',
];

export function getGoogleAuthUrl(
  state: string,
  options?: { loginHint?: string; prompt?: string }
): string {
  const { clientId, redirectUri } = getGoogleConfig();
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: options?.prompt || 'consent select_account',
    include_granted_scopes: 'true',
    state,
  });

  if (options?.loginHint) {
    params.set('login_hint', options.loginHint);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function decodeGoogleIdToken(idToken: string): {
  email?: string;
  name?: string;
  picture?: string;
} | null {
  try {
    const parts = idToken.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      return {
        email: typeof payload.email === 'string' ? payload.email : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      };
    }
  } catch {
    // fail-open
  }
  return null;
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<{
  email?: string;
  name?: string;
  picture?: string;
} | null> {
  const endpoints = [
    'https://www.googleapis.com/oauth2/v3/userinfo',
    'https://www.googleapis.com/oauth2/v2/userinfo',
    'https://openidconnect.googleapis.com/v1/userinfo',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const email = typeof data.email === 'string' ? data.email : undefined;
        const name = typeof data.name === 'string' ? data.name : undefined;
        const picture = typeof data.picture === 'string' ? data.picture : undefined;
        if (email || name || picture) {
          return { email, name, picture };
        }
      }
    } catch {
      // try next
    }
  }

  return null;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials not configured');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Failed to exchange Google OAuth code', { status: response.status, body: errorBody });
    throw new Error(`Google token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  const accessToken = data.access_token as string;
  const refreshToken = (data.refresh_token as string) || undefined;
  const expiresIn = (data.expires_in as number) || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;
  const idToken = data.id_token as string | undefined;

  // Fetch basic user profile (try ID token first, then userinfo endpoints)
  let email: string | undefined;
  let name: string | undefined;
  let picture: string | undefined;

  if (idToken) {
    const decoded = decodeGoogleIdToken(idToken);
    if (decoded) {
      email = decoded.email;
      name = decoded.name;
      picture = decoded.picture;
    }
  }

  if (!email || !name || !picture) {
    const profile = await fetchGoogleUserProfile(accessToken);
    if (profile) {
      email = email || profile.email;
      name = name || profile.name;
      picture = picture || profile.picture;
    }
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    email,
    name,
    picture,
  };
}

export async function refreshGoogleTokens(
  refreshToken: string,
  existingEmail?: string,
  existingName?: string,
  existingPicture?: string
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getGoogleConfig();
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials not configured');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Failed to refresh Google access token', { status: response.status, body: errorBody });
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  const accessToken = data.access_token as string;
  const expiresIn = (data.expires_in as number) || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;
  const idToken = data.id_token as string | undefined;

  let email = existingEmail;
  let name = existingName;
  let picture = existingPicture;

  if (idToken) {
    const decoded = decodeGoogleIdToken(idToken);
    if (decoded) {
      email = decoded.email || email;
      name = decoded.name || name;
      picture = decoded.picture || picture;
    }
  }

  return {
    accessToken,
    refreshToken, // keep the existing refresh token
    expiresAt,
    email,
    name,
    picture,
  };
}

export function encryptGoogleSessionData(sessionData: GoogleSessionData): string {
  return encryptPayload(sessionData as unknown as Record<string, unknown>, 'google-tokens');
}

export function decryptGoogleSessionData(cookieValue: string): GoogleSessionData | null {
  try {
    const payload = decryptPayload(cookieValue, 'google-tokens') as {
      accounts?: unknown[];
      accessToken?: string;
      [key: string]: unknown;
    } | null;
    if (!payload) return null;

    if (Array.isArray(payload.accounts)) {
      return payload as unknown as GoogleSessionData;
    }

    if (typeof payload.accessToken === 'string') {
      const legacyTokens = payload as unknown as GoogleTokens;
      const accountId = legacyTokens.email || 'primary';
      return {
        accounts: [
          {
            id: accountId,
            email: legacyTokens.email || '',
            name: legacyTokens.name,
            picture: legacyTokens.picture,
            tokens: legacyTokens,
            enabledApps: {
              calendar: true,
              tasks: true,
              drive: true,
              contacts: true,
            },
            connectedAt: Date.now(),
          },
        ],
        activeAccountId: accountId,
      };
    }

    return null;
  } catch (err) {
    logger.warn('Failed to decrypt Google session cookie', { err });
    return null;
  }
}

export function encryptGoogleTokens(tokens: GoogleTokens): string {
  const accountId = tokens.email || 'primary';
  const sessionData: GoogleSessionData = {
    accounts: [
      {
        id: accountId,
        email: tokens.email || '',
        name: tokens.name,
        picture: tokens.picture,
        tokens,
        enabledApps: {
          calendar: true,
          tasks: true,
          drive: true,
          contacts: true,
        },
        connectedAt: Date.now(),
      },
    ],
    activeAccountId: accountId,
  };
  return encryptGoogleSessionData(sessionData);
}

export function decryptGoogleTokens(cookieValue: string): GoogleTokens | null {
  const session = decryptGoogleSessionData(cookieValue);
  if (!session || session.accounts.length === 0) return null;
  const active =
    (session.activeAccountId && session.accounts.find((a) => a.id === session.activeAccountId)) ||
    session.accounts[0];
  return active?.tokens || null;
}

/**
 * Returns a valid access token, automatically refreshing it if it expired or is about to expire.
 */
export async function getValidGoogleAccessToken(
  tokens: GoogleTokens,
  onRefreshed?: (refreshed: GoogleTokens) => Promise<void> | void,
): Promise<string> {
  // If token expires in less than 2 minutes, refresh it
  if (tokens.expiresAt - Date.now() < 120_000 && tokens.refreshToken) {
    const refreshed = await refreshGoogleTokens(
      tokens.refreshToken,
      tokens.email,
      tokens.name,
      tokens.picture,
    );
    if (onRefreshed) await onRefreshed(refreshed);
    return refreshed.accessToken;
  }
  return tokens.accessToken;
}
