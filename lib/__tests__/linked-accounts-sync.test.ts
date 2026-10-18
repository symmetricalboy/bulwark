// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth/session-secret', () => ({
  getSessionSecret: () => 's'.repeat(64),
  hasSessionSecret: () => true,
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
}));

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => { jar.set(name, value); },
    delete: (name: string) => { jar.delete(name); },
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  }),
}));

const savedBlobs = new Map<string, Record<string, unknown>>();
vi.mock('@/lib/settings-sync', () => ({
  loadUserSettings: vi.fn(async (accountName: string, serverUrl: string) => {
    const key = `${accountName.toLowerCase()}|${serverUrl.toLowerCase()}`;
    const stored = savedBlobs.get(key);
    return stored ? structuredClone(stored) : null;
  }),
  saveUserSettings: vi.fn(async (accountName: string, serverUrl: string, settings: Record<string, unknown>) => {
    const key = `${accountName.toLowerCase()}|${serverUrl.toLowerCase()}`;
    savedBlobs.set(key, structuredClone(settings));
    return true;
  }),
}));

import { encryptPayload, decryptPayload, encryptSession } from '@/lib/auth/crypto';
import { setStalwartAuthContextInStore } from '@/lib/stalwart/auth-context';
import {
  hydrateLinkedAccountsOnSettingsLoad,
  mergeStoredLinkedAccountsOnSettingsSave,
  removeGoogleAccountsFromStorage,
  removeJmapAccountsFromStorage,
  removeMicrosoftAccountsFromStorage,
  saveGoogleSessionToStorage,
  saveMicrosoftSessionToStorage,
  syncJmapSlotLoginToStorage,
} from '@/lib/linked-accounts-sync';
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

const COMAIL_USER = 'alice@comail.example';
const COMAIL_SERVER = 'https://comail.example';

function signInComailSlot0() {
  jar.clear();
  const cookieStore = {
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    set: (n: string, v: string) => { jar.set(n, v); },
    delete: (n: string) => { jar.delete(n); },
  };
  setStalwartAuthContextInStore(cookieStore as never, 0, {
    serverUrl: COMAIL_SERVER,
    username: COMAIL_USER,
    authHeader: 'Basic YWxpY2U6c2VjcmV0',
  });
}

function makeRequest(url = 'https://app.example/api/settings'): NextRequest {
  const headers = new Headers();
  if (jar.size > 0) {
    headers.set(
      'cookie',
      [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    );
  }
  return new NextRequest(url, { headers });
}

describe('linked-accounts-sync cross-client persistence', () => {
  beforeEach(() => {
    savedBlobs.clear();
    jar.clear();
  });

  it('syncs Google and Microsoft accounts to Comail settings storage and hydrates them on a new client without leaking raw tokens in settings JSON', async () => {
    signInComailSlot0();
    const reqClientA = makeRequest('https://app.example/api/auth/google/callback');

    const googleAcct: LinkedGoogleAccount = {
      id: 'g-123',
      email: 'alice@gmail.com',
      name: 'Alice Gmail',
      picture: 'https://example.com/pic.png',
      tokens: {
        accessToken: 'ya29.test-google-access',
        refreshToken: '1//test-google-refresh',
        expiresAt: Date.now() + 3600_000,
      },
      enabledApps: {
        ...DEFAULT_GOOGLE_APP_TOGGLES,
        gmail: true,
        drive: false,
      },
      connectedAt: 1000,
      updatedAt: 2000,
    };

    const msAcct: MicrosoftAccountTokens = {
      id: 'ms-456',
      email: 'alice@outlook.com',
      name: 'Alice Outlook',
      accessToken: 'EwB.test-ms-access',
      refreshToken: 'M.test-ms-refresh',
      expiresAt: Date.now() + 3600_000,
      apps: {
        ...DEFAULT_MICROSOFT_APP_TOGGLES,
        onedrive: true,
        contacts: false,
      },
      connectedAt: 1500,
      updatedAt: 2500,
    };

    await saveGoogleSessionToStorage(reqClientA, { accounts: [googleAcct], activeAccountId: 'g-123' });
    await saveMicrosoftSessionToStorage(reqClientA, { accounts: [msAcct] });

    // Client B has only the Comail login cookie and no Google/Microsoft cookies
    signInComailSlot0();
    const reqClientB = makeRequest('https://app.example/api/settings');
    const rawSettings = savedBlobs.get(`${COMAIL_USER}|${COMAIL_SERVER}`) ?? null;

    const hydrated = await hydrateLinkedAccountsOnSettingsLoad({
      request: reqClientB,
      accountName: COMAIL_USER,
      username: COMAIL_USER,
      serverUrl: COMAIL_SERVER,
      rawSettings,
    });

    expect(hydrated.sanitizedSettings).not.toBeNull();
    // Raw _linkedAccounts must NEVER be exposed in client-visible settings JSON
    expect(hydrated.sanitizedSettings).not.toHaveProperty('_linkedAccounts');

    const res = NextResponse.json({ settings: hydrated.sanitizedSettings });
    hydrated.applyCookies(res);

    const googleCookie = res.cookies.get('google_tokens');
    const msCookie = res.cookies.get('microsoft_tokens');
    expect(googleCookie).toBeDefined();
    expect(msCookie).toBeDefined();

    const restoredGoogle = decryptPayload(googleCookie!.value, 'google-tokens') as unknown as GoogleSessionData;
    expect(restoredGoogle.accounts).toHaveLength(1);
    expect(restoredGoogle.accounts[0]).toMatchObject({
      id: 'g-123',
      email: 'alice@gmail.com',
      tokens: {
        refreshToken: '1//test-google-refresh',
      },
      enabledApps: { drive: false, gmail: true },
    });

    const restoredMs = decryptPayload(msCookie!.value, 'microsoft-tokens') as unknown as MicrosoftSessionData;
    expect(restoredMs.accounts).toHaveLength(1);
    expect(restoredMs.accounts[0]).toMatchObject({
      id: 'ms-456',
      email: 'alice@outlook.com',
      refreshToken: 'M.test-ms-refresh',
      apps: { contacts: false, onedrive: true },
    });
  });

  it('syncs secondary JMAP account credentials and hydrates them onto a free slot on another client', async () => {
    signInComailSlot0();
    const reqClientA = makeRequest('https://app.example/api/auth/session');

    const secondarySessionToken = encryptSession(
      'https://jmap.fastmail.example',
      'alice@fastmail.example',
      'app-password-xyz',
    );

    await syncJmapSlotLoginToStorage(reqClientA.cookies, {
      id: 'alice@fastmail.example@jmap.fastmail.example',
      username: 'alice@fastmail.example',
      serverUrl: 'https://jmap.fastmail.example',
      label: 'Fastmail',
      displayName: 'Alice Fastmail',
      email: 'alice@fastmail.example',
      avatarColor: '#3b82f6',
      authMode: 'basic',
      rememberMe: true,
      lastLoginAt: 3000,
      sessionToken: secondarySessionToken,
      updatedAt: 3000,
    });

    // Client B only has slot 0 logged into Comail
    signInComailSlot0();
    const reqClientB = makeRequest('https://app.example/api/settings');
    const rawSettings = savedBlobs.get(`${COMAIL_USER}|${COMAIL_SERVER}`) ?? null;

    const hydrated = await hydrateLinkedAccountsOnSettingsLoad({
      request: reqClientB,
      accountName: COMAIL_USER,
      username: COMAIL_USER,
      serverUrl: COMAIL_SERVER,
      rawSettings,
    });

    expect(hydrated.linkedJmapAccounts).toHaveLength(1);
    expect(hydrated.linkedJmapAccounts[0]).toMatchObject({
      id: 'alice@fastmail.example@jmap.fastmail.example',
      username: 'alice@fastmail.example',
      serverUrl: 'https://jmap.fastmail.example',
      authMode: 'basic',
      cookieSlot: 1,
    });

    const res = NextResponse.json({ settings: hydrated.sanitizedSettings });
    hydrated.applyCookies(res);

    const slotCookie = res.cookies.get('jmap_session_1');
    expect(slotCookie).toBeDefined();
    expect(slotCookie!.value).toBe(secondarySessionToken);
  });

  it('propagates disconnect tombstones across clients so stale cookies do not resurrect disconnected accounts', async () => {
    signInComailSlot0();
    const reqClientA = makeRequest('https://app.example/api/auth/google/disconnect');

    const googleAcct: LinkedGoogleAccount = {
      id: 'g-remove-me',
      email: 'old@gmail.com',
      name: 'Old Gmail',
      tokens: {
        accessToken: 'tok',
        refreshToken: 'ref',
        expiresAt: Date.now() + 3600_000,
      },
      enabledApps: { ...DEFAULT_GOOGLE_APP_TOGGLES },
      connectedAt: 1000,
      updatedAt: 1000,
    };

    await saveGoogleSessionToStorage(reqClientA, { accounts: [googleAcct], activeAccountId: 'g-remove-me' });
    await removeGoogleAccountsFromStorage(reqClientA, { accounts: [] }, ['g-remove-me', 'old@gmail.com']);
    await removeMicrosoftAccountsFromStorage(reqClientA, { accounts: [] }, ['ms-remove-me']);
    await removeJmapAccountsFromStorage(reqClientA.cookies, ['old@jmap.example@jmap.example']);

    // Client B still has a stale google_tokens cookie with old@gmail.com
    signInComailSlot0();
    jar.set(
      'google_tokens',
      encryptPayload({ accounts: [googleAcct], activeAccountId: 'g-remove-me' }, 'google-tokens'),
    );
    const reqClientB = makeRequest('https://app.example/api/settings');
    const rawSettings = savedBlobs.get(`${COMAIL_USER}|${COMAIL_SERVER}`) ?? null;

    const hydrated = await hydrateLinkedAccountsOnSettingsLoad({
      request: reqClientB,
      accountName: COMAIL_USER,
      username: COMAIL_USER,
      serverUrl: COMAIL_SERVER,
      rawSettings,
    });

    const res = NextResponse.json({ settings: hydrated.sanitizedSettings });
    hydrated.applyCookies(res);

    // Stale google_tokens cookie should be cleared on Client B
    expect(jar.has('google_tokens')).toBe(false);
    expect(hydrated.disconnectedJmapAccountIds).toContain('old@jmap.example@jmap.example');
  });

  it('preserves stored _linkedAccounts when saving regular user settings via mergeStoredLinkedAccountsOnSettingsSave', async () => {
    signInComailSlot0();
    const reqClientA = makeRequest('https://app.example/api/settings');
    const googleAcct: LinkedGoogleAccount = {
      id: 'g-keep',
      email: 'keep@gmail.com',
      name: 'Keep Gmail',
      tokens: {
        accessToken: 'tok',
        refreshToken: 'ref',
        expiresAt: Date.now() + 3600_000,
      },
      enabledApps: { ...DEFAULT_GOOGLE_APP_TOGGLES },
      connectedAt: 1000,
      updatedAt: 2000,
    };
    await saveGoogleSessionToStorage(reqClientA, { accounts: [googleAcct], activeAccountId: 'g-keep' });

    const existingBlob = savedBlobs.get(`${COMAIL_USER}|${COMAIL_SERVER}`) ?? null;
    const merged = mergeStoredLinkedAccountsOnSettingsSave(
      existingBlob,
      { theme: 'dark', sendDelaySeconds: 10 },
      reqClientA.cookies,
    );

    expect(merged.theme).toBe('dark');
    expect(merged._linkedAccounts).toBeDefined();
    const internal = merged._linkedAccounts as { google: LinkedGoogleAccount[] };
    expect(internal.google).toHaveLength(1);
    expect(internal.google[0].email).toBe('keep@gmail.com');
  });
});
