/**
 * Video meeting helpers for Comail.
 *
 * Only Jitsi rooms can be minted client-side: a Jitsi room exists as soon as
 * someone opens its URL, so an unguessable room name is a real, shareable
 * meeting. Google Meet, Microsoft Teams and Zoom only hand out a joinable link
 * after the organizer creates the meeting in their own account, so for those
 * we open the provider's start page and ask the user to paste the resulting
 * invite link back (see `MEETING_START_URLS` / `isProviderMeetingUrl`). We
 * never insert a provider's "start a new meeting" URL as the invite: every
 * guest who opened it would land in a different, freshly created meeting.
 */

import { meetingProviderOf } from "./event-links";

export type VideoMeetingProviderId = "jitsi" | "google-meet" | "teams" | "zoom" | "nextcloud" | "custom";

/** Providers whose meeting must be created in the provider's own UI first. */
export type LinkedMeetingProviderId = "google-meet" | "teams" | "zoom";

export interface VideoMeetingProviderMeta {
  id: VideoMeetingProviderId;
  /** Brand name, or "" for an unrecognised host (UI shows a localized fallback). */
  name: string;
  brandColor: string;
}

const PROVIDER_META: Record<Exclude<VideoMeetingProviderId, "custom">, VideoMeetingProviderMeta> = {
  "google-meet": { id: "google-meet", name: "Google Meet", brandColor: "#00AC47" },
  teams: { id: "teams", name: "Microsoft Teams", brandColor: "#5059C9" },
  zoom: { id: "zoom", name: "Zoom", brandColor: "#2D8CFF" },
  jitsi: { id: "jitsi", name: "Jitsi Meet", brandColor: "#17A8F5" },
  nextcloud: { id: "nextcloud", name: "Nextcloud Talk", brandColor: "#0082c9" },
};

const GENERIC_META: VideoMeetingProviderMeta = { id: "custom", name: "", brandColor: "#64748b" };

export function getProviderMeta(id: Exclude<VideoMeetingProviderId, "custom">): VideoMeetingProviderMeta {
  return PROVIDER_META[id];
}

/** Pages where the organizer creates a meeting and can copy its invite link. */
export const MEETING_START_URLS: Record<LinkedMeetingProviderId, string> = {
  "google-meet": "https://meet.google.com/landing",
  teams: "https://teams.microsoft.com/v2/?meetnow=true",
  zoom: "https://zoom.us/meeting/schedule",
};

function randomToken(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/**
 * Room names on the public meet.jit.si instance are the only access control,
 * so the suffix carries ~62 bits of randomness from the platform CSPRNG.
 */
export function generateJitsiRoomName(title?: string): string {
  const cleanTitle = title
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 24)
        .replace(/-$/, "")
    : "";
  const suffix = randomToken(12);
  return cleanTitle ? `comail-${cleanTitle}-${suffix}` : `comail-${suffix}`;
}

export function generateJitsiMeetingUrl(title?: string): string {
  return `https://meet.jit.si/${generateJitsiRoomName(title)}`;
}

function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

const LINKED_PROVIDER_LABEL: Record<LinkedMeetingProviderId, string> = {
  "google-meet": "Google Meet",
  teams: "Teams",
  zoom: "Zoom",
};

/**
 * True if `value` is a joinable invite link for the given provider - i.e.
 * a specific meeting, not the provider's generic "start a meeting" page.
 * Uses the same joinable-meeting patterns the calendar uses to find meeting
 * links in invitations, so what we accept is what we later recognise.
 */
export function isProviderMeetingUrl(provider: LinkedMeetingProviderId, value: string): boolean {
  const url = parseHttpsUrl(value);
  if (!url) return false;
  return meetingProviderOf(url.href) === LINKED_PROVIDER_LABEL[provider];
}

/** Only http(s) meeting links may be rendered as clickable anchors. */
export function isSafeMeetingHref(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function detectMeetingProvider(url: string | null | undefined): VideoMeetingProviderMeta {
  if (!url) return GENERIC_META;

  const detected = meetingProviderOf(url);
  switch (detected) {
    case "Google Meet":
      return PROVIDER_META["google-meet"];
    case "Teams":
      return PROVIDER_META.teams;
    case "Zoom":
      return PROVIDER_META.zoom;
    case "Jitsi":
      return PROVIDER_META.jitsi;
    case "Nextcloud Talk":
      return PROVIDER_META.nextcloud;
    case null:
      break;
    default:
      // Another recognised service (Webex, GoTo, ...): keep its brand name.
      return { id: "custom", name: detected, brandColor: "#0284c7" };
  }

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "meet.google.com") return PROVIDER_META["google-meet"];
    if (hostIs(host, "teams.microsoft.com") || hostIs(host, "teams.live.com")) return PROVIDER_META.teams;
    if (hostIs(host, "zoom.us")) return PROVIDER_META.zoom;
    if (host === "meet.jit.si" || host.includes("jitsi")) return PROVIDER_META.jitsi;
  } catch {
    // Not a URL - fall through to the generic meta.
  }
  return GENERIC_META;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface MeetingSnippetOptions {
  url: string;
  /** Localized heading, e.g. "Sprint planning · Video call". */
  heading: string;
  /** Localized "Join with {provider}" style call to action. */
  joinLabel: string;
}

/**
 * Invitation block inserted into an outgoing message. Inline styles only and
 * a neutral palette, because it is rendered by the recipient's mail client.
 * Every caller-provided string is HTML-escaped.
 */
export function buildMeetingHtmlSnippet({ url, heading, joinLabel }: MeetingSnippetOptions): string {
  const safeUrl = escapeHtml(url);
  return (
    `<div style="margin:14px 0;padding:12px 16px;border:1px solid #e2e8f0;border-left:4px solid #0ea5e9;border-radius:8px;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">` +
    `<div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#0f172a;">${escapeHtml(heading)}</div>` +
    `<div style="font-size:13px;color:#334155;">${escapeHtml(joinLabel)} <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;">${safeUrl}</a></div>` +
    `</div>`
  );
}

export function buildMeetingPlainTextSnippet({ url, heading, joinLabel }: MeetingSnippetOptions): string {
  return `\n${heading}\n${joinLabel} ${url}\n`;
}
