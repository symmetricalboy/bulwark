/**
 * Resolve an atproto (Bluesky) account's public profile for the account UI.
 *
 * The logged-in member's DID is fetched against the PUBLIC appview
 * (`app.bsky.actor.getProfile`), which requires no authentication. The result
 * is cached module-level so the handle and avatar consumers share one request,
 * and concurrent renders share a single in-flight request.
 *
 * Design constraints (see issue #1767):
 *   - Public appview only. No auth header, no other hosts.
 *   - Fail-open: any network / parse / HTTP error resolves to `null` so the
 *     caller falls back to initials. Never throws, never blocks login.
 *   - Cache the result (including failures and profiles without an avatar) so
 *     we do not refetch per render.
 */

import {
  looksLikeHandle,
  normalizeHandle,
  resolveHandle,
  searchActorsTypeahead,
} from "@/lib/atproto/handle";

const PUBLIC_APPVIEW_BASE = "https://public.api.bsky.app";
const GET_PROFILE_PATH = "/xrpc/app.bsky.actor.getProfile";

export interface AtprotoProfile {
  did: string;
  handle: string | null;
  avatar: string | null;
  createdAt?: string;
}

// did/handle -> resolved public profile (or null on failure). Avatar and handle
// consumers share this cache and the same in-flight request.
const profileCache = new Map<string, AtprotoProfile | null>();
const inFlight = new Map<string, Promise<AtprotoProfile | null>>();
const pdsCache = new Map<string, string | null>();
const pdsInFlight = new Map<string, Promise<string | null>>();

export function isSupportedDid(did: string): boolean {
  // atproto DIDs are did:plc:* or did:web:*. Reject anything else so we never
  // send arbitrary caller-controlled strings to the appview.
  return typeof did === "string" && (did.startsWith("did:plc:") || did.startsWith("did:web:"));
}

export function isSupportedActor(actor: string): boolean {
  if (typeof actor !== "string") return false;
  const a = actor.trim();
  if (a.startsWith("did:")) {
    return isSupportedDid(a);
  }
  return looksLikeHandle(a);
}

export function isComailAccount(account: {
  serverUrl?: string;
  email?: string;
  username?: string;
  did?: string;
}): boolean {
  if (!account) return false;
  if (account.did && isSupportedDid(account.did)) return true;
  const email = (account.email || "").toLowerCase();
  const username = (account.username || "").toLowerCase();
  const serverUrl = (account.serverUrl || "").toLowerCase();
  return (
    email.endsWith("@comail.at") ||
    username.endsWith("@comail.at") ||
    serverUrl.includes("comail.at")
  );
}

export interface AccountIdentityCandidates {
  did?: string;
  displayName?: string;
  label?: string;
  username?: string;
  email?: string;
  serverUrl?: string;
}

/**
 * Resolve the connected atproto DID for a Comail account or identifier candidate.
 * Tests explicit DIDs, handles, .bsky.social aliases, and typeahead actor matches
 * against Bluesky's records. Fail-open: returns null on failure or unknown actor.
 */
export async function resolveConnectedAtprotoDid(
  accountOrTarget: AccountIdentityCandidates | string,
): Promise<string | null> {
  if (typeof accountOrTarget === "string") {
    const raw = normalizeHandle(accountOrTarget);
    if (!raw) return null;
    if (isSupportedDid(raw)) {
      // Check if this DID corresponds to an account with an associated spaces account
      try {
        const profile = await resolveAtprotoProfile(raw);
        if (profile?.handle && !profile.handle.startsWith("spaces.")) {
          const spacesDid = await resolveHandle(`spaces.${profile.handle}`);
          if (spacesDid.status === "resolved") return spacesDid.did;
        }
      } catch {
        // Fail-open
      }
      return raw;
    }
    if (looksLikeHandle(raw)) {
      // For Comail accounts on the Spaces alpha, check spaces.<handle> first if not already prefixed
      if (!raw.startsWith("spaces.")) {
        const spacesRes = await resolveHandle(`spaces.${raw}`);
        if (spacesRes.status === "resolved") return spacesRes.did;
      }
      const res = await resolveHandle(raw);
      if (res.status === "resolved") return res.did;
    }
    // Try spaces alias
    if (!raw.startsWith("spaces.")) {
      const spacesBsky = await resolveHandle(`spaces.${raw}.bsky.social`);
      if (spacesBsky.status === "resolved") return spacesBsky.did;
    }
    // Try .bsky.social alias
    const bsky = await resolveHandle(`${raw}.bsky.social`);
    if (bsky.status === "resolved") return bsky.did;
    // Try public typeahead lookup
    try {
      const actors = await searchActorsTypeahead(raw);
      if (actors.length > 0) {
        // Prioritize ATProto Spaces Alpha / Comail actors
        const spacesMatch = actors.find(
          (a) =>
            a.handle.startsWith("spaces.") ||
            a.handle.includes(".spaces.") ||
            (a.displayName && a.displayName.toLowerCase().includes("spaces"))
        );
        if (spacesMatch) return spacesMatch.did;

        // Check if any matching actor's handle has a spaces.<handle> counterpart
        for (const a of actors) {
          if (a.handle && !a.handle.startsWith("spaces.")) {
            const spacesRes = await resolveHandle(`spaces.${a.handle}`);
            if (spacesRes.status === "resolved") return spacesRes.did;
          }
        }

        const match = actors.find(
          (a) =>
            a.displayName?.trim().toLowerCase() === raw.toLowerCase() ||
            a.handle.toLowerCase() === raw.toLowerCase() ||
            a.handle.toLowerCase().split(".")[0] === raw.toLowerCase()
        );
        if (match) return match.did;
      }
    } catch {
      // Fail-open
    }
    return null;
  }

  // Account object
  if (accountOrTarget.did && isSupportedDid(accountOrTarget.did)) {
    // If it's already a spaces DID or has an associated spaces counterpart, ensure we resolve the spaces DID
    try {
      const profile = await resolveAtprotoProfile(accountOrTarget.did);
      if (profile?.handle?.startsWith("spaces.")) {
        return accountOrTarget.did;
      }
      if (profile?.handle) {
        const spacesDid = await resolveHandle(`spaces.${profile.handle}`);
        if (spacesDid.status === "resolved") return spacesDid.did;
      }
    } catch {
      // Fail-open
    }
  }

  const candidates: string[] = [];
  if (accountOrTarget.displayName) candidates.push(accountOrTarget.displayName);
  if (accountOrTarget.label && accountOrTarget.label !== accountOrTarget.displayName) {
    candidates.push(accountOrTarget.label);
  }
  if (
    accountOrTarget.username &&
    accountOrTarget.username !== accountOrTarget.displayName &&
    accountOrTarget.username !== accountOrTarget.label
  ) {
    if (accountOrTarget.username.includes("@")) {
      const [local, dom] = accountOrTarget.username.split("@");
      if (local && !["email", "mail", "admin", "postmaster", "info"].includes(local.toLowerCase())) {
        candidates.push(local);
      }
      if (dom && looksLikeHandle(accountOrTarget.username)) {
        candidates.push(accountOrTarget.username);
      }
    } else {
      candidates.push(accountOrTarget.username);
    }
  }
  if (accountOrTarget.email) {
    const [local, dom] = accountOrTarget.email.split("@");
    if (local && !["email", "mail", "admin", "postmaster", "info"].includes(local.toLowerCase())) {
      if (!candidates.includes(local)) candidates.push(local);
    }
    if (dom && looksLikeHandle(dom) && !dom.includes("comail.at")) {
      if (!candidates.includes(dom)) candidates.push(dom);
    }
  }

  for (const candidate of candidates) {
    const did = await resolveConnectedAtprotoDid(candidate);
    if (did) return did;
  }

  if (accountOrTarget.did && isSupportedDid(accountOrTarget.did)) {
    return accountOrTarget.did;
  }

  return null;
}

/**
 * Resolve the public atproto profile for a DID or handle. Returns the current
 * handle and avatar URL, or `null` when unsupported or the fetch fails. A
 * profile without an avatar is still returned so handle-only accounts render.
 */
export async function resolveAtprotoProfile(actorOrDid: string): Promise<AtprotoProfile | null> {
  if (!actorOrDid || !isSupportedActor(actorOrDid)) return null;

  if (profileCache.has(actorOrDid)) {
    return profileCache.get(actorOrDid) ?? null;
  }
  const existing = inFlight.get(actorOrDid);
  if (existing) return existing;

  const url =
    `${PUBLIC_APPVIEW_BASE}${GET_PROFILE_PATH}?actor=${encodeURIComponent(actorOrDid)}`;

  const request = (async (): Promise<AtprotoProfile | null> => {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        did?: unknown;
        handle?: unknown;
        avatar?: unknown;
        createdAt?: unknown;
      };
      const handle =
        typeof data.handle === "string" && data.handle.trim().length > 0
          ? data.handle.trim().replace(/^@/, "")
          : null;
      const avatar = typeof data.avatar === "string" ? data.avatar : null;
      const createdAt =
        typeof data.createdAt === "string" && data.createdAt.trim().length > 0
          ? data.createdAt.trim()
          : undefined;
      const did =
        typeof data.did === "string" && isSupportedDid(data.did)
          ? data.did
          : isSupportedDid(actorOrDid)
            ? actorOrDid
            : "";
      const profile: AtprotoProfile = {
        did,
        handle,
        avatar: avatar && avatar.length > 0 ? avatar : null,
        ...(createdAt ? { createdAt } : {}),
      };
      if (profile.did) {
        profileCache.set(profile.did, profile);
      }
      if (profile.handle) {
        profileCache.set(profile.handle, profile);
      }
      return profile;
    } catch {
      // Fail-open: network error, abort, or malformed JSON.
      return null;
    }
  })();

  inFlight.set(actorOrDid, request);
  try {
    const result = await request;
    profileCache.set(actorOrDid, result);
    return result;
  } finally {
    inFlight.delete(actorOrDid);
  }
}

/**
 * Compatibility wrapper for avatar consumers. It shares the profile cache, so
 * rendering a handle and avatar for the same account performs one request.
 * Accepts a DID, a handle, or an account object.
 */
export async function resolveAtprotoAvatar(
  target: string | AccountIdentityCandidates,
): Promise<string | null> {
  if (typeof target === "string") {
    if (!isSupportedActor(target)) return null;
    return (await resolveAtprotoProfile(target))?.avatar ?? null;
  }

  const did = await resolveConnectedAtprotoDid(target);
  if (did) {
    return (await resolveAtprotoProfile(did))?.avatar ?? null;
  }
  return null;
}

/**
 * Resolve the PDS (Personal Data Server) hostname for an atproto DID, actor handle,
 * or account object. Queries the PLC directory (for did:plc:*) or the well-known DID
 * document (for did:web:*) to extract the serviceEndpoint for #atproto_pds.
 *
 * Example:
 *   did:plc:vfueyv27ch72hrpxzr4jm3pm -> spaces-alpha.host.bsky.network
 */
export async function resolveAtprotoPds(
  target: string | AccountIdentityCandidates,
): Promise<string | null> {
  if (!target) return null;

  let did: string | null = null;
  if (typeof target === "string") {
    const raw = target.trim();
    if (!raw) return null;
    if (pdsCache.has(raw)) {
      return pdsCache.get(raw) ?? null;
    }
    if (isSupportedDid(raw)) {
      did = raw;
    } else if (isSupportedActor(raw)) {
      did = await resolveConnectedAtprotoDid(raw);
    }
  } else {
    did = await resolveConnectedAtprotoDid(target);
  }

  if (!did || !isSupportedDid(did)) return null;

  if (pdsCache.has(did)) {
    return pdsCache.get(did) ?? null;
  }
  const existing = pdsInFlight.get(did);
  if (existing) return existing;

  const request = (async (): Promise<string | null> => {
    try {
      let url: string;
      if (did.startsWith("did:plc:")) {
        url = `https://plc.directory/${encodeURIComponent(did)}`;
      } else if (did.startsWith("did:web:")) {
        const rawParts = did.slice("did:web:".length).split(":");
        if (rawParts.length === 0 || !rawParts[0]) return null;
        const domain = decodeURIComponent(rawParts[0]);
        const path =
          rawParts.length > 1
            ? rawParts.slice(1).map(decodeURIComponent).join("/") + "/did.json"
            : ".well-known/did.json";
        url = `https://${domain}/${path}`;
      } else {
        return null;
      }

      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      if (!res.ok) return null;
      const doc = (await res.json()) as {
        service?: Array<{
          id?: string;
          type?: string;
          serviceEndpoint?: string;
        }>;
      };

      const pdsService = doc.service?.find(
        (s) =>
          s?.id === "#atproto_pds" ||
          s?.id?.endsWith("#atproto_pds") ||
          s?.type === "AtprotoPersonalDataServer",
      );
      if (!pdsService?.serviceEndpoint) return null;
      const endpoint = String(pdsService.serviceEndpoint).trim();
      let hostname: string;
      try {
        hostname = new URL(endpoint).hostname || endpoint;
      } catch {
        hostname = endpoint.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
      }
      pdsCache.set(did, hostname);
      if (typeof target === "string" && target !== did) {
        pdsCache.set(target, hostname);
      }
      return hostname;
    } catch {
      return null;
    }
  })();

  pdsInFlight.set(did, request);
  try {
    const result = await request;
    pdsCache.set(did, result);
    return result;
  } finally {
    pdsInFlight.delete(did);
  }
}

/** Test-only: reset the module caches between cases. */
export function __resetAtprotoAvatarCacheForTests(): void {
  profileCache.clear();
  inFlight.clear();
  pdsCache.clear();
  pdsInFlight.clear();
}
