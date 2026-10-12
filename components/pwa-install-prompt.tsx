"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Download } from "@/components/icons";
import { useConfig } from "@/hooks/use-config";
import { withBasePath } from "@/lib/browser-navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const SNOOZE_KEY = "pwa-install-snoozed-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const PWA_INSTALL_PROMPT_VISIBILITY_EVENT =
  "bulwark:pwa-install-prompt-visibility";

function isSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

// Mirrors the last dispatched visibility so a listener that mounts after the
// event was fired can still read the current state instead of assuming hidden.
let promptVisible = false;

export function isPWAInstallPromptVisible(): boolean {
  return promptVisible;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { appName, faviconUrl, appLogoLightUrl, appLogoDarkUrl } = useConfig();
  const t = useTranslations("pwa_install");

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (isSnoozed()) return;
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  useEffect(() => {
    promptVisible = showPrompt;
    window.dispatchEvent(
      new CustomEvent(PWA_INSTALL_PROMPT_VISIBILITY_EVENT, {
        detail: { visible: showPrompt },
      }),
    );
    return () => {
      if (showPrompt) promptVisible = false;
    };
  }, [showPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    // A beforeinstallprompt event can only be consumed once. Close the card
    // whether the browser prompt was accepted or dismissed so the next
    // onboarding step can continue in the same session.
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // The prompt still closes for this session when storage is unavailable.
    }
    setShowPrompt(false);
  };

  const handleDismissForever = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShowPrompt(false);
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  const logoSrc = withBasePath(appLogoLightUrl || faviconUrl);
  const darkLogoSrc = withBasePath(appLogoDarkUrl || faviconUrl);

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      className="fixed end-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] lg:bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-md p-3 animate-spring-fade-in"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
          {logoSrc ? (
            <>
              <img src={logoSrc} alt="" className="w-7 h-7 object-contain dark:hidden" />
              <img src={darkLogoSrc} alt="" className="w-7 h-7 object-contain hidden dark:block" />
            </>
          ) : (
            <Download className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="pwa-install-title" className="font-semibold text-sm leading-tight truncate">
            {t("title", { appName })}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {t("description")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="self-start p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={t("dismiss_aria")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleDismissForever}
          className="me-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("dont_remind")}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-foreground hover:bg-muted transition-colors"
        >
          {t("not_now")}
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("install")}
        </button>
      </div>
    </div>
  );
}
