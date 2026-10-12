"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { toast } from "@/stores/toast-store";
import {
  MEETING_START_URLS,
  getProviderMeta,
  isProviderMeetingUrl,
  type LinkedMeetingProviderId,
} from "@/lib/video-meetings";

/**
 * Google Meet, Teams and Zoom meetings can only be created inside the
 * organizer's own account, so "add a Meet link" means: open the provider in a
 * new tab, let the user create the meeting, and take its invite link back.
 * `start` must run inside the click handler so the new tab isn't blocked.
 */
export function useMeetingLinkFlow(onLink: (url: string, providerName: string) => void): {
  start: (provider: LinkedMeetingProviderId) => void;
  dialog: ReactNode;
} {
  const t = useTranslations("video_meeting");
  const [provider, setProvider] = useState<LinkedMeetingProviderId | null>(null);

  const start = useCallback((next: LinkedMeetingProviderId) => {
    window.open(MEETING_START_URLS[next], "_blank", "noopener,noreferrer");
    setProvider(next);
  }, []);

  const providerName = provider ? getProviderMeta(provider).name : "";

  const dialog = (
    <PromptDialog
      isOpen={provider !== null}
      onClose={() => setProvider(null)}
      onSubmit={(value) => {
        if (!provider) return;
        if (!isProviderMeetingUrl(provider, value)) {
          toast.error(t("invalid_link", { provider: providerName }));
          return;
        }
        onLink(value.trim(), providerName);
      }}
      title={t("paste_title", { provider: providerName })}
      message={t("paste_message", { provider: providerName })}
      placeholder={t("paste_placeholder")}
      confirmText={t("paste_confirm")}
    />
  );

  return { start, dialog };
}
