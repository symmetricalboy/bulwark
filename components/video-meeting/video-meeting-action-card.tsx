"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "@/components/icons";
import { detectMeetingProvider } from "@/lib/video-meetings";
import { MeetingProviderIcon } from "./meeting-provider-icon";
import { toast } from "@/stores/toast-store";

interface VideoMeetingActionCardProps {
  url: string;
  compact?: boolean;
  className?: string;
}

export function VideoMeetingActionCard({ url, compact = false, className }: VideoMeetingActionCardProps) {
  const [copied, setCopied] = useState(false);
  const meta = detectMeetingProvider(url);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Meeting link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-2 p-2 rounded-lg border border-border/70 bg-muted/30 ${className || ""}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${meta.brandColor}18`, color: meta.brandColor }}
          >
            <MeetingProviderIcon providerId={meta.id} className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-foreground block truncate">{meta.name}</span>
            <span className="text-[11px] text-muted-foreground block truncate font-mono">{url}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Copy meeting link"
            aria-label="Copy meeting link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <span>Join</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-muted/20 space-y-2.5 shadow-2xs ${className || ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
            style={{ backgroundColor: `${meta.brandColor}20`, color: meta.brandColor }}
          >
            <MeetingProviderIcon providerId={meta.id} className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">{meta.name}</span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${meta.brandColor}18`, color: meta.brandColor }}
              >
                Video Conference
              </span>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors truncate block max-w-[280px] font-mono mt-0.5"
              title={url}
            >
              {url}
            </a>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="Copy meeting link"
            aria-label="Copy meeting link"
          >
            {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs transition-all"
          >
            <span>Join Meeting</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
