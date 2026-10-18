import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession, encryptPayload, decryptPayload } from '@/lib/auth/crypto';
import { SESSION_COOKIE_MAX_AGE, sessionCookieName } from '@/lib/auth/session-cookie';
import { getCookieOptions } from '@/lib/oauth/cookie-config';
import {
  readStalwartAuthContextFromStore,
  stalwartAuthContextCookieName,
} from '@/lib/stalwart/auth-context';
import {
  refreshTokenCookieName,
  refreshTokenServerCookieName,
} from '@/lib/oauth/tokens';
import { loadUserSettings, saveUserSettings } from '@/lib/settings-sync';
import { hasSessionSecret } from '@/lib/auth/session-secret';
import {
  generateAccountId,
  generateAvatarColor,
  MAX_ACCOUNT_SLOTS,
} from '@/lib/account-utils';
import {
  DEFAULT_GOOGLE_APP_TOGGLES,
  type GoogleSessionData,
  type LinkedGoogleAccount,
} from '@/lib/google/types';
import {
  DEFAULT_MICROSOFT_APP_TOGGLES,
  type MicrosoftAccountTokens,
  type MicrosoftSessionData,
} from '@/lib/microsoft/types';
import { logger } from '@/lib/logger';

export const LINKED_ACCOUNTS_SETTINGS_KEY = '_linkedAccounts';
const GOOGLE_COOKIE_NAME = 'google_tokens';
const MICROSOFT_COOKIE_NAME = 'microsoft_tokens';
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export interface ComailSettingsIdentity {
  /** Key used for loadUserSettings / saveUserSettings */
  accountName: string;
  /** Login username */
  username: string;
  /** JMAP server URL */
  serverUrl: string;
  /** Deterministic AccountEntry.id (`${username}@${host}`) */
  accountId: string;
  /** Cookie slot index where this identity was found */
  slot: number;
}

export interface SyncedJmapAccountPublic {
  id: string;
  username: string;
  serverUrl: string;
  label: string;
  displayName: string;
  email: string;
  avatarColor: string;
  authMode: 'basic' | 'oauth' | 'token';
  rememberMe: boolean;
  providerSession?: boolean;
  serverIdentifiers?: string[];
  did?: string;
  createdAt?: number;
  lastLoginAt: number;
  cookieSlot?: number;
}

export interface LinkedJmapAccountRecord extends SyncedJmapAccountPublic {
  /** Encrypted session cookie token (`encryptSession(...)`) for basic/token auth */
  sessionToken?: string;
  /** Encrypted stalwart auth context cookie token (`encryptPayload(..., 'session-context')`) */
  stalwartContextToken?: string;
  /** Refresh token for OAuth JMAP accounts */
  oauthRefreshToken?: string;
  /** Server ID for OAuth JMAP accounts */
  oauthServerId?: string | null;
  updatedAt: number;
}

export interface StoredLinkedAccountsData {
  google?: LinkedGoogleAccount[];
  googleActiveAccountId?: string;
  microsoft?: MicrosoftAccountTokens[];
  jmap?: LinkedJmapAccountRecord[];
  /**
   * Disconnected account tombstones (`google:<key>`, `microsoft:<key>`, `jmap:<key>`) -> timestamp (ms).
   * Prevents a stale cookie on another client from re-adding an intentionally disconnected account.
   */
  tombstones?: Record<string, number>;
  updatedAt?: number;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function getCookieReader(request?: NextRequest): Promise<CookieReader | null> {
  let headerCookies: CookieReader | null = null;
  try {
    headerCookies = await cookies();
  } catch {
    headerCookies = null;
  }
  const reqCookies = request?.cookies ?? null;
  if (!reqCookies && !headerCookies) return null;
  return {
    get(name: string) {
      return reqCookies?.get(name) ?? headerCookies?.get(name);
    },
  };
}

/**
 * Resolve all authenticated Comail / JMAP identities present in the caller's cookies.
 * Orders any slot matching `hints` first, then slot 0, then remaining slots.
 */
export function resolveComailIdentitiesFromCookieReader(
  cookieReader: CookieReader | null,
  hints?: {
    comailAccountId?: string;
    comailAccountEmail?: string;
    username?: string;
    serverUrl?: string;
  }
): ComailSettingsIdentity[] {
  if (!cookieReader || !hasSessionSecret()) return [];

  const found: ComailSettingsIdentity[] = [];
  const seenKeys = new Set<string>();

  for (let slot = 0; slot < MAX_ACCOUNT_SLOTS; slot++) {
    let accountName: string | undefined;
    let username: string | undefined;
    let serverUrl: string | undefined;

    const sessionToken = cookieReader.get(sessionCookieName(slot))?.value;
    if (sessionToken) {
      const session = decryptSession(sessionToken);
      if (session && session.username && session.serverUrl) {
        accountName = session.username;
        username = session.username;
        serverUrl = session.serverUrl;
      }
    }

    const ctx = readStalwartAuthContextFromStore(cookieReader as never, slot);
    if (ctx && ctx.username && ctx.serverUrl) {
      if (!accountName) accountName = ctx.accountName ?? ctx.username;
      if (!username) username = ctx.username;
      if (!serverUrl) serverUrl = ctx.serverUrl;
    }

    if (accountName && username && serverUrl) {
      const normUrl = normalizeUrl(serverUrl);
      const dedupeKey = `${accountName.toLowerCase()}::${normUrl.toLowerCase()}`;
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        found.push({
          accountName,
          username,
          serverUrl,
          accountId: generateAccountId(username, serverUrl),
          slot,
        });
      }
    }
  }

  if (found.length <= 1 || !hints) return found;

  const hintId = hints.comailAccountId?.toLowerCase();
  const hintEmail = hints.comailAccountEmail?.toLowerCase();
  const hintUser = hints.username?.toLowerCase();
  const hintServer = hints.serverUrl ? normalizeUrl(hints.serverUrl).toLowerCase() : undefined;

  const scoreIdentity = (id: ComailSettingsIdentity): number => {
    if (
      hintUser &&
      hintServer &&
      (id.username.toLowerCase() === hintUser || id.accountName.toLowerCase() === hintUser) &&
      normalizeUrl(id.serverUrl).toLowerCase() === hintServer
    ) {
      return 100;
    }
    if (hintId && id.accountId.toLowerCase() === hintId) {
      return 90;
    }
    if (
      hintEmail &&
      (id.username.toLowerCase() === hintEmail ||
        id.accountName.toLowerCase() === hintEmail ||
        id.accountId.toLowerCase().startsWith(`${hintEmail}@`))
    ) {
      return 80;
    }
    if (id.slot === 0) return 50;
    return 10 - id.slot * 0.1;
  };

  return [...found].sort((a, b) => scoreIdentity(b) - scoreIdentity(a));
}

export async function resolveComailIdentities(
  request?: NextRequest,
  hints?: {
    comailAccountId?: string;
    comailAccountEmail?: string;
    username?: string;
    serverUrl?: string;
  }
): Promise<ComailSettingsIdentity[]> {
  const cookieReader = await getCookieReader(request);
  const effectiveHints = {
    comailAccountId:
      hints?.comailAccountId ||
      request?.nextUrl?.searchParams?.get('comailAccountId') ||
      request?.headers?.get('x-comail-account-id') ||
      undefined,
    comailAccountEmail:
      hints?.comailAccountEmail ||
      request?.nextUrl?.searchParams?.get('comailAccountEmail') ||
      request?.headers?.get('x-comail-account-email') ||
      undefined,
    username:
      hints?.username ||
      request?.headers?.get('x-settings-username') ||
      undefined,
    serverUrl:
      hints?.serverUrl ||
      request?.headers?.get('x-settings-server') ||
      undefined,
  };
  return resolveComailIdentitiesFromCookieReader(cookieReader, effectiveHints);
}

export function normalizeStoredLinkedAccounts(raw: unknown): StoredLinkedAccountsData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const obj = raw as Record<string, unknown>;
  const now = Date.now();
  const cutoff = now - TOMBSTONE_TTL_MS;

  const tombstones: Record<string, number> = {};
  if (obj.tombstones && typeof obj.tombstones === 'object' && !Array.isArray(obj.tombstones)) {
    for (const [k, v] of Object.entries(obj.tombstones as Record<string, unknown>)) {
      if (typeof v === 'number' && v > cutoff) {
        tombstones[k.toLowerCase()] = v;
      }
    }
  }

  return {
    google: Array.isArray(obj.google) ? (obj.google as LinkedGoogleAccount[]) : undefined,
    googleActiveAccountId:
      typeof obj.googleActiveAccountId === 'string' ? obj.googleActiveAccountId : undefined,
    microsoft: Array.isArray(obj.microsoft)
      ? (obj.microsoft as MicrosoftAccountTokens[])
      : undefined,
    jmap: Array.isArray(obj.jmap) ? (obj.jmap as LinkedJmapAccountRecord[]) : undefined,
    tombstones,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : undefined,
  };
}

async function loadRawUserSettingsWithFallback(
  identity: Pick<ComailSettingsIdentity, 'accountName' | 'username' | 'serverUrl'>
): Promise<{
  accountName: string;
  serverUrl: string;
  settings: Record<string, unknown> | null;
}> {
  const candidates: Array<{ accountName: string; serverUrl: string }> = [
    { accountName: identity.accountName, serverUrl: identity.serverUrl },
  ];
  const normUrl = normalizeUrl(identity.serverUrl);
  if (normUrl !== identity.serverUrl) {
    candidates.push({ accountName: identity.accountName, serverUrl: normUrl });
  }
  if (identity.username && identity.username !== identity.accountName) {
    candidates.push({ accountName: identity.username, serverUrl: identity.serverUrl });
    if (normUrl !== identity.serverUrl) {
      candidates.push({ accountName: identity.username, serverUrl: normUrl });
    }
  }

  for (const candidate of candidates) {
    const loaded = await loadUserSettings(candidate.accountName, candidate.serverUrl);
    if (loaded) {
      return {
        accountName: candidate.accountName,
        serverUrl: candidate.serverUrl,
        settings: loaded,
      };
    }
  }

  return {
    accountName: identity.accountName,
    serverUrl: normUrl,
    settings: null,
  };
}

async function updateLinkedAccountsInStorageForIdentities(
  identities: ComailSettingsIdentity[],
  updater: (current: StoredLinkedAccountsData) => StoredLinkedAccountsData | null
): Promise<void> {
  if (!hasSessionSecret() || identities.length === 0) return;

  // Update the primary matched identity and slot 0 (if different) so any Comail login finds it
  const targets: ComailSettingsIdentity[] = [identities[0]];
  const slotZero = identities.find((i) => i.slot === 0);
  if (slotZero && slotZero !== identities[0]) {
    targets.push(slotZero);
  }

  for (const target of targets) {
    try {
      const { accountName, serverUrl, settings } = await loadRawUserSettingsWithFallback(target);
      const baseSettings = settings || {};
      const currentLinked = normalizeStoredLinkedAccounts(baseSettings[LINKED_ACCOUNTS_SETTINGS_KEY]);
      const nextLinked = updater(currentLinked);
      if (!nextLinked) continue;
      await saveUserSettings(accountName, serverUrl, {
        ...baseSettings,
        [LINKED_ACCOUNTS_SETTINGS_KEY]: {
          ...nextLinked,
          updatedAt: Date.now(),
        },
      });
    } catch (err) {
      logger.warn('Failed to persist linked accounts to user settings storage', {
        accountName: target.accountName,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}

function getGoogleTombstoneTimestamp(
  acc: Pick<LinkedGoogleAccount, 'id' | 'email'>,
  tombstones: Record<string, number>
): number {
  const idKey = acc.id ? `google:${acc.id.toLowerCase()}` : '';
  const emailKey = acc.email ? `google:${acc.email.toLowerCase()}` : '';
  return Math.max(
    idKey ? tombstones[idKey] || 0 : 0,
    emailKey ? tombstones[emailKey] || 0 : 0
  );
}

function isSameGoogleAccount(a: LinkedGoogleAccount, b: LinkedGoogleAccount): boolean {
  if (a.id && b.id && a.id.toLowerCase() === b.id.toLowerCase()) return true;
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
    if (!a.comailAccountId || !b.comailAccountId || a.comailAccountId === b.comailAccountId) {
      return true;
    }
  }
  return false;
}

export function mergeGoogleAccounts(
  cookieAccounts: LinkedGoogleAccount[],
  storedAccounts: LinkedGoogleAccount[],
  tombstones: Record<string, number> = {}
): {
  accounts: LinkedGoogleAccount[];
  cookieChanged: boolean;
  storageChanged: boolean;
} {
  let cookieChanged = false;
  let storageChanged = false;

  const validCookieAccounts = cookieAccounts.filter((acc) => {
    const tombTime = getGoogleTombstoneTimestamp(acc, tombstones);
    const accTime = Math.max(acc.updatedAt || 0, acc.connectedAt || 0);
    if (tombTime > 0 && accTime <= tombTime) {
      cookieChanged = true;
      return false;
    }
    return Boolean(acc.tokens?.accessToken || acc.tokens?.refreshToken);
  });

  const validStoredAccounts = storedAccounts.filter((acc) => {
    const tombTime = getGoogleTombstoneTimestamp(acc, tombstones);
    const accTime = Math.max(acc.updatedAt || 0, acc.connectedAt || 0);
    if (tombTime > 0 && accTime <= tombTime) {
      storageChanged = true;
      return false;
    }
    return Boolean(acc.tokens?.accessToken || acc.tokens?.refreshToken);
  });

  const merged: LinkedGoogleAccount[] = [];

  for (const cookieAcc of validCookieAccounts) {
    const storedAcc = validStoredAccounts.find((s) => isSameGoogleAccount(cookieAcc, s));
    if (!storedAcc) {
      merged.push({
        ...cookieAcc,
        enabledApps: { ...DEFAULT_GOOGLE_APP_TOGGLES, ...(cookieAcc.enabledApps || {}) },
        updatedAt: cookieAcc.updatedAt || cookieAcc.connectedAt || Date.now(),
      });
      storageChanged = true;
      continue;
    }

    const cookieExpires = cookieAcc.tokens?.expiresAt || 0;
    const storedExpires = storedAcc.tokens?.expiresAt || 0;
    const fresherTokens = cookieExpires >= storedExpires ? cookieAcc.tokens : storedAcc.tokens;
    const refreshToken =
      cookieAcc.tokens?.refreshToken || storedAcc.tokens?.refreshToken || undefined;

    if (storedExpires > cookieExpires) cookieChanged = true;
    if (cookieExpires > storedExpires) storageChanged = true;
    if (!cookieAcc.tokens?.refreshToken && storedAcc.tokens?.refreshToken) cookieChanged = true;
    if (cookieAcc.tokens?.refreshToken && !storedAcc.tokens?.refreshToken) storageChanged = true;

    const cookieUpdated = cookieAcc.updatedAt || cookieAcc.connectedAt || 0;
    const storedUpdated = storedAcc.updatedAt || storedAcc.connectedAt || 0;
    const newerMeta = cookieUpdated >= storedUpdated ? cookieAcc : storedAcc;
    const olderMeta = cookieUpdated >= storedUpdated ? storedAcc : cookieAcc;

    const mergedApps = {
      ...DEFAULT_GOOGLE_APP_TOGGLES,
      ...(olderMeta.enabledApps || {}),
      ...(newerMeta.enabledApps || {}),
    };

    if (JSON.stringify(mergedApps) !== JSON.stringify(cookieAcc.enabledApps || {})) {
      cookieChanged = true;
    }
    if (JSON.stringify(mergedApps) !== JSON.stringify(storedAcc.enabledApps || {})) {
      storageChanged = true;
    }

    const combined: LinkedGoogleAccount = {
      id: cookieAcc.id || storedAcc.id,
      email: cookieAcc.email || storedAcc.email,
      name: newerMeta.name || olderMeta.name,
      picture: newerMeta.picture || olderMeta.picture,
      tokens: {
        ...fresherTokens,
        refreshToken,
        email: fresherTokens.email || cookieAcc.email || storedAcc.email,
        name: fresherTokens.name || newerMeta.name || olderMeta.name,
        picture: fresherTokens.picture || newerMeta.picture || olderMeta.picture,
      },
      enabledApps: mergedApps,
      connectedAt: Math.min(
        cookieAcc.connectedAt || Date.now(),
        storedAcc.connectedAt || Date.now()
      ),
      updatedAt: Math.max(cookieUpdated, storedUpdated, Date.now()),
      comailAccountId: newerMeta.comailAccountId || olderMeta.comailAccountId,
      comailAccountEmail: newerMeta.comailAccountEmail || olderMeta.comailAccountEmail,
    };

    merged.push(combined);
  }

  for (const storedAcc of validStoredAccounts) {
    if (!merged.some((m) => isSameGoogleAccount(m, storedAcc))) {
      merged.push({
        ...storedAcc,
        enabledApps: { ...DEFAULT_GOOGLE_APP_TOGGLES, ...(storedAcc.enabledApps || {}) },
      });
      cookieChanged = true;
    }
  }

  return { accounts: merged, cookieChanged, storageChanged };
}

function getMicrosoftTombstoneTimestamp(
  acc: Pick<MicrosoftAccountTokens, 'id' | 'email'>,
  tombstones: Record<string, number>
): number {
  const idKey = acc.id ? `microsoft:${acc.id.toLowerCase()}` : '';
  const emailKey = acc.email ? `microsoft:${acc.email.toLowerCase()}` : '';
  return Math.max(
    idKey ? tombstones[idKey] || 0 : 0,
    emailKey ? tombstones[emailKey] || 0 : 0
  );
}

function isSameMicrosoftAccount(a: MicrosoftAccountTokens, b: MicrosoftAccountTokens): boolean {
  const aId = (a.id || a.email || '').toLowerCase();
  const bId = (b.id || b.email || '').toLowerCase();
  if (aId && bId && aId === bId) return true;
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) return true;
  return false;
}

export function mergeMicrosoftAccounts(
  cookieAccounts: MicrosoftAccountTokens[],
  storedAccounts: MicrosoftAccountTokens[],
  tombstones: Record<string, number> = {}
): {
  accounts: MicrosoftAccountTokens[];
  cookieChanged: boolean;
  storageChanged: boolean;
} {
  let cookieChanged = false;
  let storageChanged = false;

  const validCookieAccounts = cookieAccounts.filter((acc) => {
    const tombTime = getMicrosoftTombstoneTimestamp(acc, tombstones);
    const accTime = Math.max(acc.updatedAt || 0, acc.connectedAt || 0);
    if (tombTime > 0 && accTime <= tombTime) {
      cookieChanged = true;
      return false;
    }
    return Boolean(acc.accessToken || acc.refreshToken);
  });

  const validStoredAccounts = storedAccounts.filter((acc) => {
    const tombTime = getMicrosoftTombstoneTimestamp(acc, tombstones);
    const accTime = Math.max(acc.updatedAt || 0, acc.connectedAt || 0);
    if (tombTime > 0 && accTime <= tombTime) {
      storageChanged = true;
      return false;
    }
    return Boolean(acc.accessToken || acc.refreshToken);
  });

  const merged: MicrosoftAccountTokens[] = [];

  for (const cookieAcc of validCookieAccounts) {
    const storedAcc = validStoredAccounts.find((s) => isSameMicrosoftAccount(cookieAcc, s));
    if (!storedAcc) {
      const now = Date.now();
      merged.push({
        ...cookieAcc,
        id: cookieAcc.id || cookieAcc.email.toLowerCase(),
        apps: { ...DEFAULT_MICROSOFT_APP_TOGGLES, ...(cookieAcc.apps || {}) },
        connectedAt: cookieAcc.connectedAt || now,
        updatedAt: cookieAcc.updatedAt || cookieAcc.connectedAt || now,
      });
      storageChanged = true;
      continue;
    }

    const cookieExpires = cookieAcc.expiresAt || 0;
    const storedExpires = storedAcc.expiresAt || 0;
    const fresher = cookieExpires >= storedExpires ? cookieAcc : storedAcc;
    const refreshToken = cookieAcc.refreshToken || storedAcc.refreshToken || '';

    if (storedExpires > cookieExpires) cookieChanged = true;
    if (cookieExpires > storedExpires) storageChanged = true;
    if (!cookieAcc.refreshToken && storedAcc.refreshToken) cookieChanged = true;
    if (cookieAcc.refreshToken && !storedAcc.refreshToken) storageChanged = true;

    const cookieUpdated = cookieAcc.updatedAt || cookieAcc.connectedAt || 0;
    const storedUpdated = storedAcc.updatedAt || storedAcc.connectedAt || 0;
    const newerMeta = cookieUpdated >= storedUpdated ? cookieAcc : storedAcc;
    const olderMeta = cookieUpdated >= storedUpdated ? storedAcc : cookieAcc;

    const mergedApps = {
      ...DEFAULT_MICROSOFT_APP_TOGGLES,
      ...(olderMeta.apps || {}),
      ...(newerMeta.apps || {}),
    };

    if (JSON.stringify(mergedApps) !== JSON.stringify(cookieAcc.apps || {})) {
      cookieChanged = true;
    }
    if (JSON.stringify(mergedApps) !== JSON.stringify(storedAcc.apps || {})) {
      storageChanged = true;
    }

    merged.push({
      id: cookieAcc.id || storedAcc.id || cookieAcc.email.toLowerCase(),
      email: cookieAcc.email || storedAcc.email,
      name: newerMeta.name || olderMeta.name,
      accessToken: fresher.accessToken,
      refreshToken,
      expiresAt: fresher.expiresAt,
      apps: mergedApps,
      connectedAt: Math.min(
        cookieAcc.connectedAt || Date.now(),
        storedAcc.connectedAt || Date.now()
      ),
      updatedAt: Math.max(cookieUpdated, storedUpdated, Date.now()),
      comailAccountId: newerMeta.comailAccountId || olderMeta.comailAccountId,
      comailAccountEmail: newerMeta.comailAccountEmail || olderMeta.comailAccountEmail,
    });
  }

  for (const storedAcc of validStoredAccounts) {
    if (!merged.some((m) => isSameMicrosoftAccount(m, storedAcc))) {
      merged.push({
        ...storedAcc,
        id: storedAcc.id || storedAcc.email.toLowerCase(),
        apps: { ...DEFAULT_MICROSOFT_APP_TOGGLES, ...(storedAcc.apps || {}) },
      });
      cookieChanged = true;
    }
  }

  return { accounts: merged, cookieChanged, storageChanged };
}

/**
 * Synchronize Google session accounts between the browser's `google_tokens` cookie
 * and the active Comail account's encrypted settings storage.
 */
export async function syncGoogleSessionWithStorage(
  request: NextRequest,
  cookieSession: GoogleSessionData | null,
  hints?: { comailAccountId?: string; comailAccountEmail?: string }
): Promise<{ sessionData: GoogleSessionData; cookieChanged: boolean }> {
  const baseSession: GoogleSessionData = cookieSession
    ? { accounts: [...cookieSession.accounts], activeAccountId: cookieSession.activeAccountId }
    : { accounts: [] };

  const identities = await resolveComailIdentities(request, hints);
  if (identities.length === 0) {
    return { sessionData: baseSession, cookieChanged: false };
  }

  try {
    // Load stored linked accounts across resolved Comail identities (primary first)
    let storedLinked: StoredLinkedAccountsData = {};
    for (const identity of identities) {
      const { settings } = await loadRawUserSettingsWithFallback(identity);
      if (settings && settings[LINKED_ACCOUNTS_SETTINGS_KEY]) {
        storedLinked = normalizeStoredLinkedAccounts(settings[LINKED_ACCOUNTS_SETTINGS_KEY]);
        break;
      }
    }

    const { accounts, cookieChanged, storageChanged } = mergeGoogleAccounts(
      baseSession.accounts,
      storedLinked.google || [],
      storedLinked.tombstones || {}
    );

    const activeAccountId =
      (baseSession.activeAccountId &&
        accounts.some((a) => a.id === baseSession.activeAccountId) &&
        baseSession.activeAccountId) ||
      (storedLinked.googleActiveAccountId &&
        accounts.some((a) => a.id === storedLinked.googleActiveAccountId) &&
        storedLinked.googleActiveAccountId) ||
      accounts[0]?.id;

    const nextSession: GoogleSessionData = {
      accounts,
      activeAccountId,
    };

    if (storageChanged) {
      await updateLinkedAccountsInStorageForIdentities(identities, (curr) => ({
        ...curr,
        google: accounts,
        googleActiveAccountId: activeAccountId,
      }));
    }

    return { sessionData: nextSession, cookieChanged };
  } catch (err) {
    logger.warn('Failed to sync Google session with settings storage', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return { sessionData: baseSession, cookieChanged: false };
  }
}

/**
 * Save updated Google session state to the Comail account's settings storage
 * (e.g., on OAuth callback, app toggle, or token refresh).
 */
export async function saveGoogleSessionToStorage(
  request: NextRequest,
  sessionData: GoogleSessionData,
  options?: {
    comailAccountId?: string;
    comailAccountEmail?: string;
    clearTombstoneKeys?: string[];
  }
): Promise<void> {
  const identities = await resolveComailIdentities(request, options);
  if (identities.length === 0) return;

  await updateLinkedAccountsInStorageForIdentities(identities, (curr) => {
    const tombstones = { ...(curr.tombstones || {}) };
    for (const acc of sessionData.accounts) {
      if (acc.id) delete tombstones[`google:${acc.id.toLowerCase()}`];
      if (acc.email) delete tombstones[`google:${acc.email.toLowerCase()}`];
    }
    for (const key of options?.clearTombstoneKeys || []) {
      delete tombstones[`google:${key.toLowerCase()}`];
    }

    const { accounts } = mergeGoogleAccounts(
      sessionData.accounts,
      curr.google || [],
      tombstones
    );

    return {
      ...curr,
      google: accounts,
      googleActiveAccountId: sessionData.activeAccountId || accounts[0]?.id,
      tombstones,
    };
  });
}

/**
 * Remove disconnected Google account(s) from the Comail account's settings storage
 * and record tombstones so other clients drop stale cookies on their next sync.
 */
export async function removeGoogleAccountsFromStorage(
  request: NextRequest,
  remainingSessionData: GoogleSessionData,
  removedKeys: string[],
  hints?: { comailAccountId?: string; comailAccountEmail?: string }
): Promise<void> {
  const identities = await resolveComailIdentities(request, hints);
  if (identities.length === 0) return;

  const now = Date.now();
  const normalizedKeys = removedKeys.map((k) => k.toLowerCase()).filter(Boolean);

  await updateLinkedAccountsInStorageForIdentities(identities, (curr) => {
    const tombstones = { ...(curr.tombstones || {}) };
    for (const key of normalizedKeys) {
      tombstones[`google:${key}`] = now;
    }

    const remainingStored = (curr.google || []).filter((acc) => {
      const idMatch = acc.id && normalizedKeys.includes(acc.id.toLowerCase());
      const emailMatch = acc.email && normalizedKeys.includes(acc.email.toLowerCase());
      return !idMatch && !emailMatch;
    });

    // If remainingSessionData is empty and no specific keys were given, tombstone all stored google accounts
    if (normalizedKeys.length === 0 && remainingSessionData.accounts.length === 0) {
      for (const acc of curr.google || []) {
        if (acc.id) tombstones[`google:${acc.id.toLowerCase()}`] = now;
        if (acc.email) tombstones[`google:${acc.email.toLowerCase()}`] = now;
      }
      return {
        ...curr,
        google: [],
        googleActiveAccountId: undefined,
        tombstones,
      };
    }

    return {
      ...curr,
      google: remainingStored,
      googleActiveAccountId:
        remainingSessionData.activeAccountId || remainingStored[0]?.id,
      tombstones,
    };
  });
}

/**
 * Synchronize Microsoft session accounts between the browser's `microsoft_tokens` cookie
 * and the active Comail account's encrypted settings storage.
 */
export async function syncMicrosoftSessionWithStorage(
  request: NextRequest,
  cookieSession: MicrosoftSessionData,
  hints?: { comailAccountId?: string; comailAccountEmail?: string }
): Promise<{ sessionData: MicrosoftSessionData; cookieChanged: boolean }> {
  const baseSession: MicrosoftSessionData = {
    accounts: [...(cookieSession.accounts || [])],
  };

  const identities = await resolveComailIdentities(request, hints);
  if (identities.length === 0) {
    return { sessionData: baseSession, cookieChanged: false };
  }

  try {
    let storedLinked: StoredLinkedAccountsData = {};
    for (const identity of identities) {
      const { settings } = await loadRawUserSettingsWithFallback(identity);
      if (settings && settings[LINKED_ACCOUNTS_SETTINGS_KEY]) {
        storedLinked = normalizeStoredLinkedAccounts(settings[LINKED_ACCOUNTS_SETTINGS_KEY]);
        break;
      }
    }

    const { accounts, cookieChanged, storageChanged } = mergeMicrosoftAccounts(
      baseSession.accounts,
      storedLinked.microsoft || [],
      storedLinked.tombstones || {}
    );

    const nextSession: MicrosoftSessionData = { accounts };

    if (storageChanged) {
      await updateLinkedAccountsInStorageForIdentities(identities, (curr) => ({
        ...curr,
        microsoft: accounts,
      }));
    }

    return { sessionData: nextSession, cookieChanged };
  } catch (err) {
    logger.warn('Failed to sync Microsoft session with settings storage', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return { sessionData: baseSession, cookieChanged: false };
  }
}

/**
 * Save updated Microsoft session state to the Comail account's settings storage.
 */
export async function saveMicrosoftSessionToStorage(
  request: NextRequest,
  sessionData: MicrosoftSessionData,
  options?: {
    comailAccountId?: string;
    comailAccountEmail?: string;
    clearTombstoneKeys?: string[];
  }
): Promise<void> {
  const identities = await resolveComailIdentities(request, options);
  if (identities.length === 0) return;

  await updateLinkedAccountsInStorageForIdentities(identities, (curr) => {
    const tombstones = { ...(curr.tombstones || {}) };
    for (const acc of sessionData.accounts) {
      if (acc.id) delete tombstones[`microsoft:${acc.id.toLowerCase()}`];
      if (acc.email) delete tombstones[`microsoft:${acc.email.toLowerCase()}`];
    }
    for (const key of options?.clearTombstoneKeys || []) {
      delete tombstones[`microsoft:${key.toLowerCase()}`];
    }

    const { accounts } = mergeMicrosoftAccounts(
      sessionData.accounts,
      curr.microsoft || [],
      tombstones
    );

    return {
      ...curr,
      microsoft: accounts,
      tombstones,
    };
  });
}

/**
 * Remove disconnected Microsoft account(s) from the Comail account's settings storage
 * and record tombstones so other clients drop stale cookies on their next sync.
 */
export async function removeMicrosoftAccountsFromStorage(
  request: NextRequest,
  remainingSessionData: MicrosoftSessionData,
  removedKeys: string[],
  hints?: { comailAccountId?: string; comailAccountEmail?: string }
): Promise<void> {
  const identities = await resolveComailIdentities(request, hints);
  if (identities.length === 0) return;

  const now = Date.now();
  const normalizedKeys = removedKeys.map((k) => k.toLowerCase()).filter(Boolean);

  await updateLinkedAccountsInStorageForIdentities(identities, (curr) => {
    const tombstones = { ...(curr.tombstones || {}) };
    for (const key of normalizedKeys) {
      tombstones[`microsoft:${key}`] = now;
    }

    const remainingStored = (curr.microsoft || []).filter((acc) => {
      const idMatch = acc.id && normalizedKeys.includes(acc.id.toLowerCase());
      const emailMatch = acc.email && normalizedKeys.includes(acc.email.toLowerCase());
      return !idMatch && !emailMatch;
    });

    if (normalizedKeys.length === 0 && remainingSessionData.accounts.length === 0) {
      for (const acc of curr.microsoft || []) {
        if (acc.id) tombstones[`microsoft:${acc.id.toLowerCase()}`] = now;
        if (acc.email) tombstones[`microsoft:${acc.email.toLowerCase()}`] = now;
      }
      return {
        ...curr,
        microsoft: [],
        tombstones,
      };
    }

    return {
      ...curr,
      microsoft: remainingStored,
      tombstones,
    };
  });
}

/**
 * Extract all currently authenticated JMAP accounts from the request's cookies,
 * enriched with any public AccountEntry metadata sent by the client.
 */
export function extractJmapAccountsFromCookies(
  cookieReader: CookieReader,
  clientAccountsMeta?: SyncedJmapAccountPublic[]
): LinkedJmapAccountRecord[] {
  if (!hasSessionSecret()) return [];

  const records: LinkedJmapAccountRecord[] = [];
  const metaById = new Map<string, SyncedJmapAccountPublic>();
  if (Array.isArray(clientAccountsMeta)) {
    for (const item of clientAccountsMeta) {
      if (item && typeof item.id === 'string') {
        metaById.set(item.id.toLowerCase(), item);
      }
    }
  }

  for (let slot = 0; slot < MAX_ACCOUNT_SLOTS; slot++) {
    const sessionToken = cookieReader.get(sessionCookieName(slot))?.value;
    const stalwartToken = cookieReader.get(stalwartAuthContextCookieName(slot))?.value;
    const oauthRefreshToken = cookieReader.get(refreshTokenCookieName(slot))?.value;
    const oauthServerId = cookieReader.get(refreshTokenServerCookieName(slot))?.value ?? null;

    const session = sessionToken ? decryptSession(sessionToken) : null;
    const ctx = readStalwartAuthContextFromStore(cookieReader as never, slot);

    const username = session?.username || ctx?.username;
    const serverUrl = session?.serverUrl || ctx?.serverUrl;
    if (!username || !serverUrl) continue;
    // Only sync JMAP accounts that have a restorable session or refresh token
    if (!sessionToken && !oauthRefreshToken) continue;

    const id = generateAccountId(username, serverUrl);
    const meta = metaById.get(id.toLowerCase());
    const authMode: 'basic' | 'oauth' | 'token' =
      meta?.authMode || (oauthRefreshToken ? 'oauth' : session?.token ? 'token' : 'basic');

    records.push({
      id,
      username,
      serverUrl,
      label: meta?.label || username,
      displayName: meta?.displayName || meta?.label || username,
      email: meta?.email || username,
      avatarColor: meta?.avatarColor || generateAvatarColor(meta?.email || username),
      authMode,
      rememberMe: true,
      providerSession: meta?.providerSession,
      serverIdentifiers: meta?.serverIdentifiers,
      did: meta?.did || session?.did,
      createdAt: meta?.createdAt || Date.now(),
      lastLoginAt: meta?.lastLoginAt || Date.now(),
      sessionToken,
      stalwartContextToken: stalwartToken,
      oauthRefreshToken,
      oauthServerId,
      updatedAt: Date.now(),
    });
  }

  return records;
}

export function mergeJmapAccounts(
  cookieRecords: LinkedJmapAccountRecord[],
  storedRecords: LinkedJmapAccountRecord[],
  tombstones: Record<string, number> = {}
): {
  records: LinkedJmapAccountRecord[];
  storageChanged: boolean;
} {
  let storageChanged = false;
  const byId = new Map<string, LinkedJmapAccountRecord>();

  for (const stored of storedRecords) {
    if (!stored || !stored.id) continue;
    const key = stored.id.toLowerCase();
    const tombTime = tombstones[`jmap:${key}`] || 0;
    if (tombTime > 0 && (stored.updatedAt || 0) <= tombTime) {
      storageChanged = true;
      continue;
    }
    byId.set(key, stored);
  }

  for (const cookieRec of cookieRecords) {
    if (!cookieRec || !cookieRec.id) continue;
    const key = cookieRec.id.toLowerCase();
    const tombTime = tombstones[`jmap:${key}`] || 0;
    if (tombTime > 0 && (cookieRec.updatedAt || 0) <= tombTime) {
      continue;
    }
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, cookieRec);
      storageChanged = true;
    } else {
      const merged: LinkedJmapAccountRecord = {
        ...existing,
        ...cookieRec,
        sessionToken: cookieRec.sessionToken || existing.sessionToken,
        stalwartContextToken: cookieRec.stalwartContextToken || existing.stalwartContextToken,
        oauthRefreshToken: cookieRec.oauthRefreshToken || existing.oauthRefreshToken,
        oauthServerId:
          cookieRec.oauthServerId !== undefined ? cookieRec.oauthServerId : existing.oauthServerId,
        updatedAt: Math.max(cookieRec.updatedAt || 0, existing.updatedAt || 0),
      };
      if (
        merged.sessionToken !== existing.sessionToken ||
        merged.oauthRefreshToken !== existing.oauthRefreshToken ||
        merged.label !== existing.label ||
        merged.displayName !== existing.displayName
      ) {
        storageChanged = true;
      }
      byId.set(key, merged);
    }
  }

  return {
    records: Array.from(byId.values()),
    storageChanged,
  };
}

/**
 * Sync a newly logged-in JMAP slot into the Comail user's `_linkedAccounts.jmap`.
 */
export async function syncJmapSlotLoginToStorage(
  cookieReader: CookieReader,
  loggedInRecord: LinkedJmapAccountRecord
): Promise<void> {
  const identities = resolveComailIdentitiesFromCookieReader(cookieReader, {
    username: loggedInRecord.username,
    serverUrl: loggedInRecord.serverUrl,
  });
  if (identities.length === 0) return;

  const allCookieRecords = extractJmapAccountsFromCookies(cookieReader);
  const combinedCookieRecords = [
    ...allCookieRecords.filter((r) => r.id.toLowerCase() !== loggedInRecord.id.toLowerCase()),
    loggedInRecord,
  ];

  await updateLinkedAccountsInStorageForIdentities(identities, (curr) => {
    const tombstones = { ...(curr.tombstones || {}) };
    for (const rec of combinedCookieRecords) {
      delete tombstones[`jmap:${rec.id.toLowerCase()}`];
    }
    const { records } = mergeJmapAccounts(combinedCookieRecords, curr.jmap || [], tombstones);
    return {
      ...curr,
      jmap: records,
      tombstones,
    };
  });
}

/**
 * Record JMAP slot sign-out in `_linkedAccounts.jmap` so disconnected secondary JMAP accounts
 * are not resurrected on other clients.
 */
export async function removeJmapAccountsFromStorage(
  cookieReader: CookieReader,
  removedAccountIds: string[]
): Promise<void> {
  const identities = resolveComailIdentitiesFromCookieReader(cookieReader);
  if (identities.length === 0 || removedAccountIds.length === 0) return;

  const now = Date.now();
  const normalizedIds = removedAccountIds.map((id) => id.toLowerCase());

  await updateLinkedAccountsInStorageForIdentities(identities, (curr) => {
    const tombstones = { ...(curr.tombstones || {}) };
    for (const id of normalizedIds) {
      tombstones[`jmap:${id}`] = now;
    }
    const remaining = (curr.jmap || []).filter(
      (rec) => !normalizedIds.includes(rec.id.toLowerCase())
    );
    return {
      ...curr,
      jmap: remaining,
      tombstones,
    };
  });
}

/**
 * Preserve and merge `_linkedAccounts` during `POST /api/settings`, incorporating
 * any current browser cookies and `linkedJmapAccounts` metadata sent by the client.
 */
export function mergeStoredLinkedAccountsOnSettingsSave(
  stored: Record<string, unknown> | null,
  incomingSettings: Record<string, unknown>,
  cookieReader: CookieReader | null
): Record<string, unknown> {
  const storedLinked = normalizeStoredLinkedAccounts(stored?.[LINKED_ACCOUNTS_SETTINGS_KEY]);
  const tombstones = { ...(storedLinked.tombstones || {}) };

  const clientJmapMeta = Array.isArray(incomingSettings.linkedJmapAccounts)
    ? (incomingSettings.linkedJmapAccounts as SyncedJmapAccountPublic[])
    : undefined;

  // Strip client-sent transient helper key so we only keep canonical `_linkedAccounts`
  const cleanedIncoming = { ...incomingSettings };
  delete cleanedIncoming.linkedJmapAccounts;
  delete cleanedIncoming[LINKED_ACCOUNTS_SETTINGS_KEY];

  let googleAccounts = storedLinked.google || [];
  let googleActiveAccountId = storedLinked.googleActiveAccountId;
  let microsoftAccounts = storedLinked.microsoft || [];
  let jmapRecords = storedLinked.jmap || [];

  if (cookieReader && hasSessionSecret()) {
    // Merge Google cookie if present
    const googleCookieVal = cookieReader.get(GOOGLE_COOKIE_NAME)?.value;
    if (googleCookieVal) {
      const payload = decryptPayload(googleCookieVal, 'google-tokens') as GoogleSessionData | null;
      if (payload && Array.isArray(payload.accounts)) {
        const mergedGoogle = mergeGoogleAccounts(payload.accounts, googleAccounts, tombstones);
        googleAccounts = mergedGoogle.accounts;
        googleActiveAccountId = payload.activeAccountId || googleActiveAccountId;
      }
    }

    // Merge Microsoft cookie if present
    const msCookieVal = cookieReader.get(MICROSOFT_COOKIE_NAME)?.value;
    if (msCookieVal) {
      const payload = decryptPayload(msCookieVal, 'microsoft-tokens') as MicrosoftSessionData | null;
      if (payload && Array.isArray(payload.accounts)) {
        const mergedMs = mergeMicrosoftAccounts(payload.accounts, microsoftAccounts, tombstones);
        microsoftAccounts = mergedMs.accounts;
      }
    }

    // Merge JMAP cookies + client metadata
    const cookieJmap = extractJmapAccountsFromCookies(cookieReader, clientJmapMeta);
    if (cookieJmap.length > 0) {
      const mergedJmap = mergeJmapAccounts(cookieJmap, jmapRecords, tombstones);
      jmapRecords = mergedJmap.records;
    }
  }

  const hasAnyLinkedData =
    googleAccounts.length > 0 ||
    microsoftAccounts.length > 0 ||
    jmapRecords.length > 0 ||
    Object.keys(tombstones).length > 0 ||
    Boolean(stored?.[LINKED_ACCOUNTS_SETTINGS_KEY]);

  if (!hasAnyLinkedData) {
    return cleanedIncoming;
  }

  return {
    ...cleanedIncoming,
    [LINKED_ACCOUNTS_SETTINGS_KEY]: {
      google: googleAccounts,
      googleActiveAccountId,
      microsoft: microsoftAccounts,
      jmap: jmapRecords,
      tombstones,
      updatedAt: Date.now(),
    } satisfies StoredLinkedAccountsData,
  };
}

/**
 * Hydrate `google_tokens`, `microsoft_tokens`, and any secondary JMAP slot cookies
 * onto the `GET /api/settings` response, and return sanitized public settings + `linkedJmapAccounts`.
 */
export async function hydrateLinkedAccountsOnSettingsLoad(params: {
  request: NextRequest;
  accountName: string;
  username?: string;
  serverUrl: string;
  rawSettings: Record<string, unknown> | null;
}): Promise<{
  sanitizedSettings: Record<string, unknown> | null;
  linkedJmapAccounts: SyncedJmapAccountPublic[];
  disconnectedJmapAccountIds: string[];
  applyCookies: (response: NextResponse) => void;
}> {
  const { request, accountName, username, serverUrl, rawSettings } = params;
  const cookieReader = await getCookieReader(request);
  let headerCookieStore: Awaited<ReturnType<typeof cookies>> | null = null;
  try {
    headerCookieStore = await cookies();
  } catch {
    headerCookieStore = null;
  }

  const primaryAccountIds = new Set<string>([
    generateAccountId(accountName, serverUrl).toLowerCase(),
    ...(username ? [generateAccountId(username, serverUrl).toLowerCase()] : []),
  ]);

  const storedLinked = normalizeStoredLinkedAccounts(
    rawSettings?.[LINKED_ACCOUNTS_SETTINGS_KEY]
  );
  const tombstones = { ...(storedLinked.tombstones || {}) };

  let googleAccounts = storedLinked.google || [];
  let googleActiveAccountId = storedLinked.googleActiveAccountId;
  let googleCookieNeedsUpdate = false;
  let storageNeedsUpdate = false;

  let microsoftAccounts = storedLinked.microsoft || [];
  let msCookieNeedsUpdate = false;

  let jmapRecords = storedLinked.jmap || [];

  if (cookieReader && hasSessionSecret()) {
    // 1. Google merge
    const googleCookieVal = cookieReader.get(GOOGLE_COOKIE_NAME)?.value;
    const cookieGoogleSession = googleCookieVal
      ? (decryptPayload(googleCookieVal, 'google-tokens') as GoogleSessionData | null)
      : null;
    const cookieGoogleAccounts = Array.isArray(cookieGoogleSession?.accounts)
      ? cookieGoogleSession!.accounts
      : [];

    const mergedGoogle = mergeGoogleAccounts(cookieGoogleAccounts, googleAccounts, tombstones);
    googleAccounts = mergedGoogle.accounts;
    googleActiveAccountId =
      cookieGoogleSession?.activeAccountId || googleActiveAccountId || googleAccounts[0]?.id;
    googleCookieNeedsUpdate = mergedGoogle.cookieChanged;
    if (mergedGoogle.storageChanged) storageNeedsUpdate = true;

    // 2. Microsoft merge
    const msCookieVal = cookieReader.get(MICROSOFT_COOKIE_NAME)?.value;
    const cookieMsSession = msCookieVal
      ? (decryptPayload(msCookieVal, 'microsoft-tokens') as MicrosoftSessionData | null)
      : null;
    const cookieMsAccounts = Array.isArray(cookieMsSession?.accounts)
      ? cookieMsSession!.accounts
      : [];

    const mergedMs = mergeMicrosoftAccounts(cookieMsAccounts, microsoftAccounts, tombstones);
    microsoftAccounts = mergedMs.accounts;
    msCookieNeedsUpdate = mergedMs.cookieChanged;
    if (mergedMs.storageChanged) storageNeedsUpdate = true;

    // 3. JMAP merge
    const cookieJmap = extractJmapAccountsFromCookies(cookieReader);
    const mergedJmap = mergeJmapAccounts(cookieJmap, jmapRecords, tombstones);
    jmapRecords = mergedJmap.records;
    if (mergedJmap.storageChanged) storageNeedsUpdate = true;
  }

  const hasSecondaryJmap = jmapRecords.some((r) => !primaryAccountIds.has(r.id.toLowerCase()));

  // Persist back if the client's cookies had linked accounts not yet in settings storage
  if (
    storageNeedsUpdate &&
    hasSessionSecret() &&
    (rawSettings !== null ||
      googleAccounts.length > 0 ||
      microsoftAccounts.length > 0 ||
      hasSecondaryJmap)
  ) {
    try {
      const baseSettings = rawSettings || {};
      await saveUserSettings(accountName, serverUrl, {
        ...baseSettings,
        [LINKED_ACCOUNTS_SETTINGS_KEY]: {
          google: googleAccounts,
          googleActiveAccountId,
          microsoft: microsoftAccounts,
          jmap: jmapRecords,
          tombstones,
          updatedAt: Date.now(),
        } satisfies StoredLinkedAccountsData,
      });
    } catch (err) {
      logger.warn('Failed to update linked accounts during settings load', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Determine which JMAP slots are already occupied on this client
  const occupiedSlots = new Set<number>();
  const existingSlotByAccountId = new Map<string, number>();
  const jmapSlotsToDelete: number[] = [];

  if (cookieReader && hasSessionSecret()) {
    for (let slot = 0; slot < MAX_ACCOUNT_SLOTS; slot++) {
      const sTok = cookieReader.get(sessionCookieName(slot))?.value;
      const cTok = cookieReader.get(stalwartAuthContextCookieName(slot))?.value;
      const rTok = cookieReader.get(refreshTokenCookieName(slot))?.value;
      if (sTok || cTok || rTok) {
        const sess = sTok ? decryptSession(sTok) : null;
        const ctx = readStalwartAuthContextFromStore(cookieReader as never, slot);
        const u = sess?.username || ctx?.username;
        const s = sess?.serverUrl || ctx?.serverUrl;
        if (u && s) {
          const accIdLower = generateAccountId(u, s).toLowerCase();
          if (
            !primaryAccountIds.has(accIdLower) &&
            tombstones[`jmap:${accIdLower}`] &&
            !jmapRecords.some((r) => r.id.toLowerCase() === accIdLower)
          ) {
            jmapSlotsToDelete.push(slot);
            continue;
          }
          occupiedSlots.add(slot);
          existingSlotByAccountId.set(accIdLower, slot);
        } else {
          occupiedSlots.add(slot);
        }
      }
    }
  }

  const jmapCookiesToSet: Array<{
    slot: number;
    sessionToken?: string;
    stalwartContextToken?: string;
    oauthRefreshToken?: string;
    oauthServerId?: string | null;
  }> = [];

  const linkedJmapAccounts: SyncedJmapAccountPublic[] = [];

  for (const rec of jmapRecords) {
    const key = rec.id.toLowerCase();
    let slot = existingSlotByAccountId.get(key);
    if (slot === undefined) {
      // Find next free slot
      let candidate = 0;
      while (occupiedSlots.has(candidate) && candidate < MAX_ACCOUNT_SLOTS) {
        candidate++;
      }
      if (candidate >= MAX_ACCOUNT_SLOTS) continue;
      slot = candidate;
      occupiedSlots.add(slot);
      existingSlotByAccountId.set(key, slot);

      jmapCookiesToSet.push({
        slot,
        sessionToken: rec.sessionToken,
        stalwartContextToken: rec.stalwartContextToken,
        oauthRefreshToken: rec.oauthRefreshToken,
        oauthServerId: rec.oauthServerId,
      });
    }

    if (!primaryAccountIds.has(key)) {
      linkedJmapAccounts.push({
        id: rec.id,
        username: rec.username,
        serverUrl: rec.serverUrl,
        label: rec.label,
        displayName: rec.displayName,
        email: rec.email,
        avatarColor: rec.avatarColor,
        authMode: rec.authMode,
        rememberMe: true,
        providerSession: rec.providerSession,
        serverIdentifiers: rec.serverIdentifiers,
        did: rec.did,
        createdAt: rec.createdAt,
        lastLoginAt: rec.lastLoginAt,
        cookieSlot: slot,
      });
    }
  }

  const disconnectedJmapAccountIds = Object.keys(tombstones)
    .filter((k) => k.startsWith('jmap:'))
    .map((k) => k.slice('jmap:'.length))
    .filter((id) => !primaryAccountIds.has(id));

  let sanitizedSettings: Record<string, unknown> | null = null;
  if (rawSettings) {
    sanitizedSettings = { ...rawSettings };
    delete sanitizedSettings[LINKED_ACCOUNTS_SETTINGS_KEY];
  }

  const applyCookies = (response: NextResponse) => {
    if (!hasSessionSecret()) return;

    const setCookieBoth = (
      name: string,
      value: string,
      options: Parameters<typeof response.cookies.set>[2]
    ) => {
      response.cookies.set(name, value, options);
      try {
        headerCookieStore?.set(name, value, options);
      } catch {
        /* ignore if headers already sent or read-only */
      }
    };

    const deleteCookieBoth = (name: string) => {
      response.cookies.delete(name);
      try {
        headerCookieStore?.delete(name);
      } catch {
        /* ignore */
      }
    };

    if (googleCookieNeedsUpdate) {
      if (googleAccounts.length === 0) {
        deleteCookieBoth(GOOGLE_COOKIE_NAME);
      } else {
        const encryptedGoogle = encryptPayload(
          {
            accounts: googleAccounts,
            activeAccountId: googleActiveAccountId || googleAccounts[0]?.id,
          },
          'google-tokens'
        );
        setCookieBoth(GOOGLE_COOKIE_NAME, encryptedGoogle, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    }

    if (msCookieNeedsUpdate) {
      if (microsoftAccounts.length === 0) {
        deleteCookieBoth(MICROSOFT_COOKIE_NAME);
      } else {
        const encryptedMs = encryptPayload(
          { accounts: microsoftAccounts },
          'microsoft-tokens'
        );
        setCookieBoth(MICROSOFT_COOKIE_NAME, encryptedMs, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    }

    for (const delSlot of jmapSlotsToDelete) {
      deleteCookieBoth(sessionCookieName(delSlot));
      deleteCookieBoth(stalwartAuthContextCookieName(delSlot));
      deleteCookieBoth(refreshTokenCookieName(delSlot));
      deleteCookieBoth(refreshTokenServerCookieName(delSlot));
    }

    const baseCookieOpts = getCookieOptions();
    const { maxAge: _omittedMaxAge, ...sessionCookieOpts } = baseCookieOpts;

    for (const item of jmapCookiesToSet) {
      if (item.sessionToken) {
        setCookieBoth(sessionCookieName(item.slot), item.sessionToken, {
          ...baseCookieOpts,
          maxAge: SESSION_COOKIE_MAX_AGE,
        });
      }
      if (item.stalwartContextToken) {
        setCookieBoth(
          stalwartAuthContextCookieName(item.slot),
          item.stalwartContextToken,
          sessionCookieOpts
        );
      }
      if (item.oauthRefreshToken) {
        setCookieBoth(
          refreshTokenCookieName(item.slot),
          item.oauthRefreshToken,
          baseCookieOpts
        );
        if (item.oauthServerId) {
          setCookieBoth(
            refreshTokenServerCookieName(item.slot),
            item.oauthServerId,
            baseCookieOpts
          );
        }
      }
    }
  };

  return {
    sanitizedSettings,
    linkedJmapAccounts,
    disconnectedJmapAccountIds,
    applyCookies,
  };
}
