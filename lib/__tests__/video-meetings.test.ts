import { describe, it, expect } from "vitest";
import {
  generateJitsiMeetingUrl,
  generateJitsiRoomName,
  detectMeetingProvider,
  isProviderMeetingUrl,
  isSafeMeetingHref,
  MEETING_START_URLS,
  buildMeetingHtmlSnippet,
  buildMeetingPlainTextSnippet,
} from "../video-meetings";

describe("video-meetings helper", () => {
  describe("Jitsi meeting generator", () => {
    it("generates a valid Jitsi meeting URL with title slug", () => {
      const url = generateJitsiMeetingUrl("Weekly Product Sync!");
      expect(url).toMatch(/^https:\/\/meet\.jit\.si\/comail-weekly-product-sync-[a-z0-9]{12}$/);
    });

    it("generates a valid Jitsi meeting URL without title", () => {
      expect(generateJitsiMeetingUrl()).toMatch(/^https:\/\/meet\.jit\.si\/comail-[a-z0-9]{12}$/);
    });

    it("sanitizes special characters in room name", () => {
      const room = generateJitsiRoomName("Special %$# & * () characters @ 123");
      expect(room).toMatch(/^comail-special-characters-123-[a-z0-9]{12}$/);
    });

    it("never produces the same room twice", () => {
      const rooms = new Set(Array.from({ length: 200 }, () => generateJitsiRoomName("x")));
      expect(rooms.size).toBe(200);
    });
  });

  describe("linked providers", () => {
    it("start pages are not themselves accepted as invite links", () => {
      expect(isProviderMeetingUrl("google-meet", MEETING_START_URLS["google-meet"])).toBe(false);
      expect(isProviderMeetingUrl("teams", MEETING_START_URLS.teams)).toBe(false);
      expect(isProviderMeetingUrl("zoom", MEETING_START_URLS.zoom)).toBe(false);
      expect(isProviderMeetingUrl("google-meet", "https://meet.google.com/new")).toBe(false);
    });

    it("accepts real invite links for the matching provider only", () => {
      expect(isProviderMeetingUrl("google-meet", "https://meet.google.com/abc-defg-hij")).toBe(true);
      expect(isProviderMeetingUrl("zoom", "https://us02web.zoom.us/j/123456789?pwd=abc")).toBe(true);
      expect(isProviderMeetingUrl("teams", "https://teams.microsoft.com/l/meetup-join/19%3ameeting_x/0")).toBe(true);
      expect(isProviderMeetingUrl("teams", "https://meet.google.com/abc-defg-hij")).toBe(false);
    });

    it("rejects non-https links", () => {
      expect(isProviderMeetingUrl("google-meet", "http://meet.google.com/abc-defg-hij")).toBe(false);
      expect(isProviderMeetingUrl("zoom", "javascript:alert(1)")).toBe(false);
    });
  });

  describe("isSafeMeetingHref", () => {
    it("only allows http(s)", () => {
      expect(isSafeMeetingHref("https://meet.jit.si/x")).toBe(true);
      expect(isSafeMeetingHref("javascript:alert(1)")).toBe(false);
      expect(isSafeMeetingHref("data:text/html,hi")).toBe(false);
      expect(isSafeMeetingHref(undefined)).toBe(false);
    });
  });

  describe("detectMeetingProvider", () => {
    it("detects known providers", () => {
      expect(detectMeetingProvider("https://meet.google.com/abc-defg-hij").id).toBe("google-meet");
      expect(detectMeetingProvider("https://teams.microsoft.com/meet/123456").id).toBe("teams");
      expect(detectMeetingProvider("https://us02web.zoom.us/j/123456789?pwd=abc").id).toBe("zoom");
      expect(detectMeetingProvider("https://meet.jit.si/comail-planning-xyz").id).toBe("jitsi");
    });

    it("keeps the brand name of other recognised services", () => {
      const meta = detectMeetingProvider("https://whereby.com/team-room");
      expect(meta.id).toBe("custom");
      expect(meta.name).toBe("Whereby");
    });

    it("returns a nameless generic meta for unknown or missing links", () => {
      expect(detectMeetingProvider(null)).toMatchObject({ id: "custom", name: "" });
      expect(detectMeetingProvider("https://example.com/room")).toMatchObject({ id: "custom", name: "" });
    });
  });

  describe("snippets", () => {
    const opts = {
      url: "https://meet.jit.si/comail-test-123",
      heading: "Sprint Planning · Video call",
      joinLabel: "Join with Jitsi Meet:",
    };

    it("builds an HTML snippet with the heading and link", () => {
      const html = buildMeetingHtmlSnippet(opts);
      expect(html).toContain("Sprint Planning · Video call");
      expect(html).toContain('href="https://meet.jit.si/comail-test-123"');
    });

    it("escapes caller-provided text", () => {
      const html = buildMeetingHtmlSnippet({ ...opts, heading: '<img src=x onerror="alert(1)">' });
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img");
    });

    it("builds a plain text snippet", () => {
      const text = buildMeetingPlainTextSnippet(opts);
      expect(text).toContain("Sprint Planning · Video call");
      expect(text).toContain("Join with Jitsi Meet: https://meet.jit.si/comail-test-123");
    });
  });
});
