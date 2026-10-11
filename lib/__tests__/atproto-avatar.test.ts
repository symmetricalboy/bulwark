import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveAtprotoAvatar,
  resolveAtprotoProfile,
  resolveConnectedAtprotoDid,
  resolveAtprotoPds,
  isComailAccount,
  isSupportedActor,
  isSupportedDid,
  __resetAtprotoAvatarCacheForTests,
} from '../atproto-avatar';

const DID = 'did:plc:abc123';
const AVATAR_URL = 'https://cdn.bsky.app/img/avatar/plain/abc/avatar.jpg';
const HANDLE = 'alice.example.com';

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

describe('isSupportedDid and isSupportedActor', () => {
  it('accepts did:plc and did:web', () => {
    expect(isSupportedDid('did:plc:123')).toBe(true);
    expect(isSupportedDid('did:web:example.com')).toBe(true);
    expect(isSupportedDid('did:key:123')).toBe(false);
    expect(isSupportedDid('')).toBe(false);
  });

  it('accepts handles for isSupportedActor', () => {
    expect(isSupportedActor('symmetricalboy.com')).toBe(true);
    expect(isSupportedActor('alice.bsky.social')).toBe(true);
    expect(isSupportedActor('not-a-handle')).toBe(false);
  });
});

describe('isComailAccount', () => {
  it('detects accounts with @comail.at email or username', () => {
    expect(isComailAccount({ email: 'symmetricalboy@comail.at' })).toBe(true);
    expect(isComailAccount({ username: 'user@comail.at' })).toBe(true);
    expect(isComailAccount({ email: 'other@example.com' })).toBe(false);
  });

  it('detects accounts hosted on inbox.comail.at', () => {
    expect(isComailAccount({ serverUrl: 'https://inbox.comail.at' })).toBe(true);
    expect(isComailAccount({ serverUrl: 'https://mail.example.com' })).toBe(false);
  });

  it('detects accounts with an existing atproto DID', () => {
    expect(isComailAccount({ did: 'did:plc:123' })).toBe(true);
  });
});

describe('resolveConnectedAtprotoDid', () => {
  beforeEach(() => {
    __resetAtprotoAvatarCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an existing valid DID directly', async () => {
    expect(await resolveConnectedAtprotoDid({ did: DID })).toBe(DID);
    expect(await resolveConnectedAtprotoDid(DID)).toBe(DID);
  });

  it('resolves a handle candidate via resolveHandle', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('resolveHandle') && url.includes('alice.example.com')) {
        return okResponse({ did: DID });
      }
      return { ok: false, status: 404 } as Response;
    });

    const did = await resolveConnectedAtprotoDid({ displayName: 'alice.example.com' });
    expect(did).toBe(DID);
  });

  it('resolves a bare username via typeahead lookup for Comail account', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('searchActors') && url.includes('symmetricalboy')) {
        return okResponse({
          actors: [
            {
              did: 'did:plc:33d7gnwiagm6cimpiepefp72',
              handle: 'symmetricalboy.com',
              displayName: 'symmetricalboy',
              avatar: AVATAR_URL,
            },
          ],
        });
      }
      return { ok: false, status: 404 } as Response;
    });

    const did = await resolveConnectedAtprotoDid({
      displayName: 'symmetricalboy',
      email: 'email@comail.at',
      serverUrl: 'https://inbox.comail.at',
    });
    expect(did).toBe('did:plc:33d7gnwiagm6cimpiepefp72');
  });

  it('prioritizes ATProto Spaces accounts over generic accounts in typeahead', async () => {
    const SPACES_DID = 'did:plc:vfueyv27ch72hrpxzr4jm3pm';
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('searchActors') && url.includes('symmetricalboy')) {
        return okResponse({
          actors: [
            {
              did: 'did:plc:33d7gnwiagm6cimpiepefp72',
              handle: 'symmetricalboy.com',
              displayName: 'symmetricalboy',
            },
            {
              did: SPACES_DID,
              handle: 'spaces.symmetricalboy.com',
              displayName: 'symmetricalboy (ATProto Spaces Alpha)',
            },
          ],
        });
      }
      return { ok: false, status: 404 } as Response;
    });

    const did = await resolveConnectedAtprotoDid({
      displayName: 'symmetricalboy',
      email: 'email@comail.at',
      serverUrl: 'https://inbox.comail.at',
    });
    expect(did).toBe(SPACES_DID);
  });

  it('upgrades a primary personal account DID to its associated spaces DID', async () => {
    const PRIMARY_DID = 'did:plc:33d7gnwiagm6cimpiepefp72';
    const SPACES_DID = 'did:plc:vfueyv27ch72hrpxzr4jm3pm';

    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('getProfile') && url.includes(encodeURIComponent(PRIMARY_DID))) {
        return okResponse({
          did: PRIMARY_DID,
          handle: 'symmetricalboy.com',
        });
      }
      if (url.includes('resolveHandle') && url.includes('spaces.symmetricalboy.com')) {
        return okResponse({ did: SPACES_DID });
      }
      return { ok: false, status: 404 } as Response;
    });

    const did = await resolveConnectedAtprotoDid({
      did: PRIMARY_DID,
      displayName: 'symmetricalboy',
      email: 'email@comail.at',
      serverUrl: 'https://inbox.comail.at',
    });
    expect(did).toBe(SPACES_DID);
  });

  it('checks spaces.<handle> first when resolving a handle', async () => {
    const SPACES_DID = 'did:plc:vfueyv27ch72hrpxzr4jm3pm';
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('resolveHandle') && url.includes('spaces.symmetricalboy.com')) {
        return okResponse({ did: SPACES_DID });
      }
      return { ok: false, status: 404 } as Response;
    });

    const did = await resolveConnectedAtprotoDid('symmetricalboy.com');
    expect(did).toBe(SPACES_DID);
  });
});

describe('resolveAtprotoAvatar', () => {
  beforeEach(() => {
    __resetAtprotoAvatarCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the avatar URL from getProfile against the public appview', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse({ did: DID, avatar: AVATAR_URL }));

    const url = await resolveAtprotoAvatar(DID);

    expect(url).toBe(AVATAR_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledWith = String(fetchMock.mock.calls[0][0]);
    expect(calledWith).toContain('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile');
    expect(calledWith).toContain(`actor=${encodeURIComponent(DID)}`);
  });

  it('resolves avatar directly for a handle string', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse({ did: DID, handle: HANDLE, avatar: AVATAR_URL }));

    const url = await resolveAtprotoAvatar(HANDLE);

    expect(url).toBe(AVATAR_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledWith = String(fetchMock.mock.calls[0][0]);
    expect(calledWith).toContain(`actor=${encodeURIComponent(HANDLE)}`);
  });

  it('resolves avatar for an account object', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('resolveHandle')) {
        return okResponse({ did: DID });
      }
      if (url.includes('getProfile')) {
        return okResponse({ did: DID, avatar: AVATAR_URL });
      }
      return { ok: false, status: 404 } as Response;
    });

    const url = await resolveAtprotoAvatar({ displayName: 'alice.example.com' });
    expect(url).toBe(AVATAR_URL);
  });

  it('returns the current Bluesky handle and avatar from the shared profile request', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      okResponse({ did: DID, handle: HANDLE, avatar: AVATAR_URL }),
    );

    await expect(resolveAtprotoProfile(DID)).resolves.toEqual({
      did: DID,
      handle: HANDLE,
      avatar: AVATAR_URL,
    });
  });

  it('shares one cached profile request between the handle and avatar consumers', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      okResponse({ did: DID, handle: HANDLE, avatar: AVATAR_URL }),
    );

    const profile = await resolveAtprotoProfile(DID);
    const avatar = await resolveAtprotoAvatar(DID);

    expect(profile?.handle).toBe(HANDLE);
    expect(avatar).toBe(AVATAR_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never sends an Authorization header (public appview needs no auth)', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse({ avatar: AVATAR_URL }));

    await resolveAtprotoAvatar(DID);

    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const headerKeys = Object.keys(headers).map((k) => k.toLowerCase());
    expect(headerKeys).not.toContain('authorization');
  });

  it('returns null when the profile has no avatar', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ did: DID }));
    expect(await resolveAtprotoAvatar(DID)).toBeNull();
  });

  it('fails open to null on a non-ok HTTP response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);
    expect(await resolveAtprotoAvatar(DID)).toBeNull();
  });

  it('fails open to null on a network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    expect(await resolveAtprotoAvatar(DID)).toBeNull();
  });

  it('caches the result so it does not refetch for the same DID', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse({ avatar: AVATAR_URL }));

    const first = await resolveAtprotoAvatar(DID);
    const second = await resolveAtprotoAvatar(DID);

    expect(first).toBe(AVATAR_URL);
    expect(second).toBe(AVATAR_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches negative results too (no avatar) without refetching', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse({ did: DID }));

    expect(await resolveAtprotoAvatar(DID)).toBeNull();
    expect(await resolveAtprotoAvatar(DID)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent requests for the same DID onto one fetch', async () => {
    let resolveFetch!: (r: Response) => void;
    const fetchMock = vi.spyOn(global, 'fetch').mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const p1 = resolveAtprotoAvatar(DID);
    const p2 = resolveAtprotoAvatar(DID);
    resolveFetch(okResponse({ avatar: AVATAR_URL }));

    expect(await p1).toBe(AVATAR_URL);
    expect(await p2).toBe(AVATAR_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null without fetching for an unsupported / empty DID', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    expect(await resolveAtprotoAvatar('')).toBeNull();
    expect(await resolveAtprotoAvatar('not-a-did')).toBeNull();
    expect(await resolveAtprotoAvatar('did:key:zabc')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('resolveAtprotoPds', () => {
  beforeEach(() => {
    __resetAtprotoAvatarCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves PDS hostname for a did:plc identifier from PLC directory', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      okResponse({
        id: DID,
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://spaces-alpha.host.bsky.network',
          },
        ],
      }),
    );

    const host = await resolveAtprotoPds(DID);
    expect(host).toBe('spaces-alpha.host.bsky.network');
    expect(fetchMock).toHaveBeenCalledWith(
      `https://plc.directory/${encodeURIComponent(DID)}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('resolves PDS hostname for a did:web identifier from well-known endpoint', async () => {
    const webDid = 'did:web:spaces.symmetricalboy.com';
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      okResponse({
        id: webDid,
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://pds.symmetricalboy.com/',
          },
        ],
      }),
    );

    const host = await resolveAtprotoPds(webDid);
    expect(host).toBe('pds.symmetricalboy.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://spaces.symmetricalboy.com/.well-known/did.json',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('caches resolved PDS hostname and avoids duplicate fetches', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      okResponse({
        id: DID,
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://spaces-alpha.host.bsky.network',
          },
        ],
      }),
    );

    expect(await resolveAtprotoPds(DID)).toBe('spaces-alpha.host.bsky.network');
    expect(await resolveAtprotoPds(DID)).toBe('spaces-alpha.host.bsky.network');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null on missing service or fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ id: DID, service: [] }));
    expect(await resolveAtprotoPds(DID)).toBeNull();
  });
});
