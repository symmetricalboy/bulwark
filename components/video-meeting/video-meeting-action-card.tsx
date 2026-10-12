"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Copy, Check } from "@/components/icons";
import { detectMeetingProvider, isSafeMeetingHref } from "@/lib/video-meetings";
import { MeetingProviderIcon } from "./meeting-provider-icon";
import { toast } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

interface VideoMeetingActionCardProps {
  url: string;
  compact?: boolean;
  className?: string;
}

export function VideoMeetingActionCard({ url, compact = false, className }: VideoMeetingActionCardProps) {
  const t = useTranslations("video_meeting");
  const [copied, setCopied] = useState(false);
  const meta = detectMeetingProvider(url);
  const name = meta.name || t("generic_name");
  // Event data comes from other people's invitations: never render a
  // javascript:/data: "meeting link" as something clickable.
  const canOpen = isSafeMeetingHref(url);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copy_failed"));
    }
  };

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        compact ? "p-1" : "p-1.5",
      )}
      title={t("copy_link")}
      aria-label={t("copy_link")}
    >
      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  const joinButton = canOpen ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
        compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs",
      )}
    >
      <span>{compact ? t("join") : t("join_meeting")}</span>
      <ExternalLink className="w-3.5 h-3.5" />
    </a>
  ) : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30",
        compact ? "p-2" : "p-3",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={cn("rounded-lg flex items-center justify-center shrink-0", compact ? "w-7 h-7" : "w-9 h-9")}
          style={{ backgroundColor: `${meta.brandColor}1f`, color: meta.brandColor }}
        >
          <MeetingProviderIcon providerId={meta.id} className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-semibold text-foreground block truncate">{name}</span>
          <span className="text-xs text-muted-foreground block truncate" title={url}>{url}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {copyButton}
        {joinButton}
      </div>
    </div>
  );
}
