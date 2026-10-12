/**
 * Video Meeting Helpers and Connectors for Comail
 * Supports sovereign Jitsi Meet, Google Meet, Microsoft Teams, Zoom, and Nextcloud Talk.
 */

import { meetingProviderOf } from "./event-links";

export type VideoMeetingProviderId = "jitsi" | "google-meet" | "teams" | "zoom" | "nextcloud" | "custom";

export interface VideoMeetingProviderMeta {
  id: VideoMeetingProviderId;
  name: string;
  badgeLabel: string;
  brandColor: string;
}

export function generateJitsiRoomName(title?: string): string {
  const cleanTitle = title
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 24)
    : "";
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return cleanTitle ? `comail-${cleanTitle}-${randomSuffix}` : `comail-${randomSuffix}`;
}

export function generateJitsiMeetingUrl(title?: string): string {
  const roomName = generateJitsiRoomName(title);
  return `https://meet.jit.si/${roomName}`;
}

export function getGoogleMeetNewUrl(): string {
  return "https://meet.google.com/new";
}

export function getTeamsNewUrl(): string {
  return "https://teams.live.com/meet/";
}

export function getZoomNewUrl(): string {
  return "https://zoom.us/start/videomeeting";
}

export function getNextcloudTalkUrl(baseUrl?: string): string {
  const host = baseUrl?.replace(/\/+$/, "") || "https://cloud.comail.at";
  return `${host}/call/`;
}

export function detectMeetingProvider(url: string | null | undefined): VideoMeetingProviderMeta {
  if (!url) {
    return {
      id: "custom",
      name: "Video Meeting",
      badgeLabel: "Meeting",
      brandColor: "#64748b",
    };
  }

  const detectedName = meetingProviderOf(url);
  if (detectedName) {
    switch (detectedName) {
      case "Google Meet":
        return { id: "google-meet", name: "Google Meet", badgeLabel: "Google Meet", brandColor: "#00AC47" };
      case "Teams":
        return { id: "teams", name: "Microsoft Teams", badgeLabel: "MS Teams", brandColor: "#5059C9" };
      case "Zoom":
        return { id: "zoom", name: "Zoom", badgeLabel: "Zoom", brandColor: "#2D8CFF" };
      case "Jitsi":
        return { id: "jitsi", name: "Jitsi Meet", badgeLabel: "Jitsi Meet", brandColor: "#17A8F5" };
      case "Nextcloud Talk":
        return { id: "nextcloud", name: "Nextcloud Talk", badgeLabel: "Nextcloud Talk", brandColor: "#0082c9" };
      default:
        return { id: "custom", name: detectedName, badgeLabel: detectedName, brandColor: "#0284c7" };
    }
  }

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("meet.google.com")) {
      return { id: "google-meet", name: "Google Meet", badgeLabel: "Google Meet", brandColor: "#00AC47" };
    }
    if (host.includes("teams.microsoft.com") || host.includes("teams.live.com")) {
      return { id: "teams", name: "Microsoft Teams", badgeLabel: "MS Teams", brandColor: "#5059C9" };
    }
    if (host.includes("zoom.us")) {
      return { id: "zoom", name: "Zoom", badgeLabel: "Zoom", brandColor: "#2D8CFF" };
    }
    if (host.includes("jit.si") || host.includes("jitsi")) {
      return { id: "jitsi", name: "Jitsi Meet", badgeLabel: "Jitsi Meet", brandColor: "#17A8F5" };
    }
    if (host.includes("talk") || host.includes("nextcloud")) {
      return { id: "nextcloud", name: "Nextcloud Talk", badgeLabel: "Nextcloud Talk", brandColor: "#0082c9" };
    }
  } catch {
    // ignore URL parsing error
  }

  return {
    id: "custom",
    name: "Video Meeting",
    badgeLabel: "Meeting",
    brandColor: "#64748b",
  };
}

export function buildMeetingHtmlSnippet(options: { url: string; title?: string; providerName?: string }): string {
  const provider = options.providerName || detectMeetingProvider(options.url).name;
  const label = options.title ? `${options.title} – Video Meeting` : `Join Video Meeting (${provider})`;

  return (
    `<div style="margin: 14px 0; padding: 12px 16px; border: 1px solid rgba(0,0,0,0.12); border-left: 4px solid #1185FE; border-radius: 8px; background-color: #f8fafc; font-family: sans-serif;">` +
    `<div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #0f172a;">📹 ${label}</div>` +
    `<div style="font-size: 13px; margin-bottom: 6px; color: #334155;">Meeting Link: <a href="${options.url}" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: underline;">${options.url}</a></div>` +
    `<div style="font-size: 11px; color: #64748b;">Hosted on ${provider} • Created with Comail</div>` +
    `</div>`
  );
}

export function buildMeetingPlainTextSnippet(options: { url: string; title?: string; providerName?: string }): string {
  const provider = options.providerName || detectMeetingProvider(options.url).name;
  const header = options.title ? `${options.title} - Video Meeting` : `Video Meeting (${provider})`;
  return `\n${header}\nMeeting Link: ${options.url}\n`;
}
