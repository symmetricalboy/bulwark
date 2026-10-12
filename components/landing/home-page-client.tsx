"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { MailApp } from "@/components/mail/mail-app";
import { LandingPage } from "@/components/landing/landing-page";

interface HomePageClientProps {
  locale: string;
  initialHasSession: boolean;
}

export function HomePageClient({ locale, initialHasSession }: HomePageClientProps) {
  const { isAuthenticated, client, checkAuth } = useAuthStore();
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    const state = useAuthStore.getState();
    if (state.isAuthenticated && state.client) {
      setInitialCheckDone(true);
      return;
    }
    checkAuth().finally(() => {
      setInitialCheckDone(true);
    });
  }, [checkAuth]);

  // If user is actively authenticated with a valid client, render the webmail app
  if (isAuthenticated && client) {
    return <MailApp />;
  }

  // During initial hydration for a user that sent a session cookie, show a clean loader
  // while checkAuth verifies the session. Crucially, do NOT mount MailApp before
  // authentication is verified, because MailApp's internal unauthenticated redirect
  // would bounce users to /login.
  if (initialHasSession && !initialCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // For unauthenticated visitors, bots, or expired sessions: render the public landing page.
  // This satisfies Google verification requirements:
  // 1. Homepage is not behind a login page.
  // 2. Homepage explains the purpose of the application.
  return <LandingPage locale={locale} />;
}
