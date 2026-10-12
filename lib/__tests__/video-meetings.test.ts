import { describe, it, expect } from "vitest";
import {
  generateJitsiMeetingUrl,
  generateJitsiRoomName,
  getGoogleMeetNewUrl,
  getTeamsNewUrl,
  getZoomNewUrl,
  getNextcloudTalkUrl,
  detectMeetingProvider,
  buildMeetingHtmlSnippet,
  buildMeetingPlainTextSnippet,
} from "../video-meetings";

describe("video-meetings helper", () => {
  describe("Jitsi meeting generator", () => {
    it("generates a valid Jitsi meeting URL with title slug", () => {
      const url = generateJitsiMeetingUrl("Weekly Product Sync!");
      expect(url).toMatch(/^https:\/\/meet\.jit\.si\/comail-weekly-product-sync-[a-z0-9]+$/);
    });

    it("generates a valid Jitsi meeting URL without title", () => {
      const url = generateJitsiMeetingUrl();
      expect(url).toMatch(/^https:\/\/meet\.jit\.si\/comail-[a-z0-9]+$/);
    });

    it("sanitizes special characters in room name", () => {
      const room = generateJitsiRoomName("Special %$# & * () characters @ 123");
      expect(room).toMatch(/^comail-special-characters-123-[a-z0-9]+$/);
    });
  });

  describe("Provider URLs", () => {
    it("returns correct new meeting URLs", () => {
      expect(getGoogleMeetNewUrl()).toBe("https://meet.google.com/new");
      expect(getTeamsNewUrl()).toBe("https://teams.live.com/meet/");
      expect(getZoomNewUrl()).toBe("https://zoom.us/start/videomeeting");
      expect(getNextcloudTalkUrl("https://cloud.acme.org/")).toBe("https://cloud.acme.org/call/");
      expect(getNextcloudTalkUrl()).toBe("https://cloud.comail.at/call/");
    });
  });

  describe("detectMeetingProvider", () => {
    it("detects Google Meet URLs", () => {
      const meta = detectMeetingProvider("https://meet.google.com/abc-defg-hij");
      expect(meta.id).toBe("google-meet");
      expect(meta.name).toBe("Google Meet");
    });

    it("detects Microsoft Teams URLs", () => {
      const meta = detectMeetingProvider("https://teams.microsoft.com/meet/123456");
      expect(meta.id).toBe("teams");
      expect(meta.name).toBe("Microsoft Teams");
    });

    it("detects Zoom URLs", () => {
      const meta = detectMeetingProvider("https://us02web.zoom.us/j/123456789?pwd=abc");
      expect(meta.id).toBe("zoom");
      expect(meta.name).toBe("Zoom");
    });

    it("detects Jitsi URLs", () => {
      const meta = detectMeetingProvider("https://meet.jit.si/comail-planning-xyz");
      expect(meta.id).toBe("jitsi");
      expect(meta.name).toBe("Jitsi Meet");
    });

    it("handles null and undefined gracefully", () => {
      const meta = detectMeetingProvider(null);
      expect(meta.id).toBe("custom");
      expect(meta.name).toBe("Video Meeting");
    });
  });

  describe("Snippets", () => {
    it("builds rich HTML snippet with link and provider name", () => {
      const html = buildMeetingHtmlSnippet({
        url: "https://meet.jit.si/comail-test-123",
        title: "Sprint Planning",
      });
      expect(html).toContain("Sprint Planning");
      expect(html).toContain("https://meet.jit.si/comail-test-123");
      expect(html).toContain("Jitsi Meet");
    });

    it("builds plain text snippet", () => {
      const text = buildMeetingPlainTextSnippet({
        url: "https://meet.google.com/abc-defg-hij",
        title: "Client Sync",
      });
      expect(text).toContain("Client Sync - Video Meeting");
      expect(text).toContain("Meeting Link: https://meet.google.com/abc-defg-hij");
    });
  });
});
