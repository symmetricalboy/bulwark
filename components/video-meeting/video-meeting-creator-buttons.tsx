"use client";

import { useTranslations } from "next-intl";
import {
  generateJitsiMeetingUrl,
  getProviderMeta,
  isSafeMeetingHref,
  type LinkedMeetingProviderId,
} from "@/lib/video-meetings";
import { MeetingProviderIcon } from "./meeting-provider-icon";
import { useMeetingLinkFlow } from "./use-meeting-link-flow";
import { toast } from "@/stores/toast-store";
import { X, ExternalLink } from "@/components/icons";

interface VideoMeetingCreatorButtonsProps {
  currentUrl?: string;
  eventTitle?: string;
  onSelectUrl: (url: string) => void;
  onClearUrl?: () => void;
}

const LINKED_PROVIDERS: LinkedMeetingProviderId[] = ["google-meet", "teams", "zoom"];

const chipClass =
  "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium bg-muted/50 hover:bg-muted text-foreground border border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function VideoMeetingCreatorButtons({
  currentUrl,
  eventTitle,
  onSelectUrl,
  onClearUrl,
}: VideoMeetingCreatorButtonsProps) {
  const t = useTranslations("video_meeting");

  const attach = (url: string, providerName: string) => {
    onSelectUrl(url);
    toast.success(t("attached", { provider: providerName }));
  };
  const { start, dialog } = useMeetingLinkFlow(attach);

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
      <span className="text-xs text-muted-foreground me-1">{t("quick_add")}</span>
      <button
        type="button"
        onClick={() => attach(generateJitsiMeetingUrl(eventTitle), getProviderMeta("jitsi").name)}
        className={chipClass}
        title={t("jitsi_hint")}
      >
        <MeetingProviderIcon providerId="jitsi" className="w-3.5 h-3.5 text-sky-500" />
        <span>{t("jitsi_label")}</span>
      </button>

      {LINKED_PROVIDERS.map((id) => {
        const meta = getProviderMeta(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => start(id)}
            className={chipClass}
            title={t("provider_hint", { provider: meta.name })}
          >
            <MeetingProviderIcon providerId={id} className="w-3.5 h-3.5" />
            <span>{meta.name}</span>
          </button>
        );
      })}

      {currentUrl && (
        <div className="flex items-center gap-1 ms-auto">
          {isSafeMeetingHref(currentUrl) && (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={t("open_link")}
              aria-label={t("open_link")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {onClearUrl && (
            <button
              type="button"
              onClick={onClearUrl}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={t("remove_link")}
              aria-label={t("remove_link")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {dialog}
    </div>
  );
}
