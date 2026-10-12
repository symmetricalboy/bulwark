"use client";

import {
  generateJitsiMeetingUrl,
  getGoogleMeetNewUrl,
  getTeamsNewUrl,
  getZoomNewUrl,
  type VideoMeetingProviderId,
} from "@/lib/video-meetings";
import { MeetingProviderIcon } from "./meeting-provider-icon";
import { toast } from "@/stores/toast-store";
import { X, ExternalLink } from "@/components/icons";

interface VideoMeetingCreatorButtonsProps {
  currentUrl?: string;
  eventTitle?: string;
  onSelectUrl: (url: string) => void;
  onClearUrl?: () => void;
}

export function VideoMeetingCreatorButtons({
  currentUrl,
  eventTitle,
  onSelectUrl,
  onClearUrl,
}: VideoMeetingCreatorButtonsProps) {
  const handleCreate = (providerId: VideoMeetingProviderId) => {
    let generated = "";
    let providerName = "";

    switch (providerId) {
      case "jitsi":
        generated = generateJitsiMeetingUrl(eventTitle);
        providerName = "Instant Jitsi Meet";
        break;
      case "google-meet":
        generated = getGoogleMeetNewUrl();
        providerName = "Google Meet";
        break;
      case "teams":
        generated = getTeamsNewUrl();
        providerName = "Microsoft Teams";
        break;
      case "zoom":
        generated = getZoomNewUrl();
        providerName = "Zoom";
        break;
    }

    if (generated) {
      onSelectUrl(generated);
      toast.success(`${providerName} attached`);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
      <span className="text-[11px] font-medium text-muted-foreground mr-1">Quick Add:</span>
      <button
        type="button"
        onClick={() => handleCreate("jitsi")}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors"
        title="Add Instant Sovereign Jitsi Meet room (no login required)"
      >
        <MeetingProviderIcon providerId="jitsi" className="w-3 h-3 text-[#17A8F5]" />
        <span>Instant Jitsi</span>
      </button>

      <button
        type="button"
        onClick={() => handleCreate("google-meet")}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors"
        title="Add Google Meet link"
      >
        <MeetingProviderIcon providerId="google-meet" className="w-3 h-3" />
        <span>Google Meet</span>
      </button>

      <button
        type="button"
        onClick={() => handleCreate("teams")}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors"
        title="Add Microsoft Teams meeting link"
      >
        <MeetingProviderIcon providerId="teams" className="w-3 h-3" />
        <span>MS Teams</span>
      </button>

      <button
        type="button"
        onClick={() => handleCreate("zoom")}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors"
        title="Add Zoom meeting link"
      >
        <MeetingProviderIcon providerId="zoom" className="w-3 h-3" />
        <span>Zoom</span>
      </button>

      {currentUrl && (
        <div className="flex items-center gap-1 ml-auto">
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Test link in new tab"
            aria-label="Test link in new tab"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
          {onClearUrl && (
            <button
              type="button"
              onClick={onClearUrl}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove meeting link"
              aria-label="Remove meeting link"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
