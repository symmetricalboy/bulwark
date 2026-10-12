"use client";

import React from "react";
import Link from "next/link";
import {
  Mail,
  Calendar,
  Users,
  CheckSquare,
  ShieldCheck,
  Lock,
  ArrowRight,
  LogIn,
  CheckCircle2,
  FolderClosed,
  Sparkles,
  ExternalLink,
  Layers,
  Database,
  EyeOff,
} from "lucide-react";
import { withBasePath } from "@/lib/browser-navigation";
import { useAuthStore } from "@/stores/auth-store";

interface LandingPageProps {
  locale?: string;
}

export function LandingPage({ locale = "en" }: LandingPageProps) {
  const { isAuthenticated } = useAuthStore();
  const mailUrl = withBasePath(`/${locale}/mail`);
  const loginUrl = withBasePath(`/${locale}/login`);
  const primaryActionUrl = isAuthenticated ? mailUrl : loginUrl;
  const primaryActionLabel = isAuthenticated ? "Open Webmail" : "Sign In";
  const privacyUrl = withBasePath(`/${locale}/privacy`);
  const termsUrl = withBasePath(`/${locale}/terms`);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src={withBasePath("/branding/comail/cammie-mark.png")}
              alt="Comail Mascot"
              className="h-9 w-9 object-contain"
            />
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-2xl font-bold tracking-tight text-foreground">
                comail
              </span>
              <span className="hidden text-xs font-medium uppercase tracking-wider text-muted-foreground sm:inline-block">
                Workspace
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main Navigation">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#google-workspace"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Google Workspace
            </a>
            <a
              href="#security"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Security
            </a>
            <Link
              href={privacyUrl}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href={termsUrl}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms of Service
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={primaryActionUrl}
              id="header-sign-in-btn"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
            >
              <LogIn className="h-4 w-4" />
              <span>{primaryActionLabel}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
          {/* Subtle gradient background glows */}
          <div
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
            aria-hidden="true"
          />

          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary mb-6 animate-fade-in">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Modern Webmail &amp; Unified Productivity Suite</span>
            </div>

            <h1 className="mx-auto max-w-4xl font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:leading-[1.15]">
              Your Inbox, Calendar &amp; Tasks in One Private Workspace
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Comail is an open-source, privacy-first webmail application and personal
              productivity suite. Experience modern JMAP email with seamless two-way
              synchronization for your Google Calendar, Google Contacts, and Google Tasks.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={primaryActionUrl}
                id="hero-launch-webmail-btn"
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-primary px-7 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{primaryActionLabel === "Sign In" ? "Launch Webmail" : "Open Webmail"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-6 text-base font-medium text-card-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Explore Features
              </a>
              <Link
                href={privacyUrl}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-border/60 bg-muted/30 px-6 text-base font-medium text-foreground transition-colors hover:bg-muted"
              >
                Privacy Policy
              </Link>
            </div>

            {/* Interactive Workspace Preview Mockup */}
            <div className="mt-14 mx-auto max-w-5xl rounded-2xl border border-border/80 bg-card/60 p-2 shadow-2xl backdrop-blur-sm sm:p-4">
              <div className="overflow-hidden rounded-xl border border-border bg-background shadow-inner">
                {/* Mock UI Top Window Bar */}
                <div className="flex h-10 items-center justify-between border-b border-border bg-muted/40 px-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-destructive/60" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/60" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
                    <span className="ml-2 text-xs font-mono text-muted-foreground">
                      comail.symmetricalboy.com/mail
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Google Workspace Connected</span>
                  </div>
                </div>

                {/* Mock App Shell */}
                <div className="grid grid-cols-1 md:grid-cols-12 min-h-[300px] text-left">
                  {/* Left Rail */}
                  <div className="col-span-3 border-r border-border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                      <Mail className="h-4 w-4" />
                      <span>Inbox (3)</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted text-sm font-medium">
                      <Calendar className="h-4 w-4 text-sky-500" />
                      <span>Google Calendar</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted text-sm font-medium">
                      <Users className="h-4 w-4 text-emerald-500" />
                      <span>Google Contacts</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted text-sm font-medium">
                      <CheckSquare className="h-4 w-4 text-amber-500" />
                      <span>Google Tasks</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted text-sm font-medium">
                      <FolderClosed className="h-4 w-4 text-indigo-500" />
                      <span>Files &amp; Drive</span>
                    </div>
                  </div>

                  {/* Middle Content */}
                  <div className="col-span-5 border-r border-border p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Activity
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3 shadow-sm hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Design Review Sync</span>
                        <span>10:30 AM</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        Calendar event synchronized with Google Calendar
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3 shadow-sm hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Sprint Action Items</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        Task marked done, updated in Google Tasks
                      </p>
                    </div>
                  </div>

                  {/* Right Detail Pane */}
                  <div className="col-span-4 p-5 bg-card/40 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Private &amp; Secure</span>
                      </div>
                      <h4 className="mt-3 text-base font-semibold text-foreground">
                        Unified Productivity
                      </h4>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        All communications and schedule items are organized side-by-side with zero tracking,
                        encrypted credentials, and modern JMAP protocols.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-border/60">
                      <Link
                        href={loginUrl}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background py-2 text-xs font-semibold hover:bg-foreground/90 transition-colors"
                      >
                        <span>Open Your Inbox</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Purpose & Application Features Section */}
        <section id="features" className="border-t border-border bg-muted/20 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Engineered for Modern Email &amp; Productivity
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Comail brings together open protocols and your essential Google Workspace tools
                into a single, unified client designed with high performance and privacy at its core.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1: Email */}
              <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-card-foreground">
                  JMAP-Native Webmail
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground flex-1">
                  Enjoy blazing-fast email powered by the open JMAP standard. Built-in conversation
                  threading, instant full-text search, keyboard shortcuts, and seamless Stalwart mail
                  server compatibility.
                </p>
              </div>

              {/* Feature 2: Calendar */}
              <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-card-foreground">
                  Google Calendar Sync
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground flex-1">
                  Full two-way synchronization with Google Calendar. View schedules in day, week,
                  and month grids, create new appointments, update meeting times, and manage invites
                  directly from your webmail.
                </p>
              </div>

              {/* Feature 3: Contacts */}
              <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-card-foreground">
                  Google Contacts Integration
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground flex-1">
                  Sync your Google Contacts to your address book. Automatically autocomplete recipient
                  email addresses while drafting messages and manage unified contact cards.
                </p>
              </div>

              {/* Feature 4: Tasks */}
              <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <CheckSquare className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-card-foreground">
                  Google Tasks Management
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground flex-1">
                  Keep action items right alongside your messages. Real-time synchronization with
                  Google Tasks lets you view lists, create to-dos, and check off completed work.
                </p>
              </div>

              {/* Feature 5: Privacy */}
              <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-card-foreground">
                  Privacy-First Philosophy
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground flex-1">
                  No third-party advertisements, no cross-site tracking pixels, and no behavioral
                  profiling. Your data stays between your browser and your authenticated services.
                </p>
              </div>

              {/* Feature 6: Files & Attachments */}
              <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                  <FolderClosed className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-card-foreground">
                  Files &amp; Attachments Hub
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground flex-1">
                  Easily browse, download, and organize incoming email attachments, documents, and
                  stored files in a unified file manager.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Google Workspace & Data Policy Compliance Section */}
        <section id="google-workspace" className="py-20 border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background p-8 md:p-12 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Google API Services Compliance
                </span>
              </div>

              <h2 className="mt-4 font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Google User Data &amp; Security Commitments
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                When you choose to connect your Google account with Comail to sync your Calendar,
                Contacts, or Tasks, we handle your data with strict adherence to Google&apos;s API
                Services User Data Policy.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Limited Use Compliance
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Comail&apos;s use and transfer of information received from Google APIs adheres to the{" "}
                      <a
                        href="https://developers.google.com/terms/api-services-user-data-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground font-medium"
                      >
                        Google API Services User Data Policy
                      </a>
                      , including the Limited Use requirements.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Strictly User-Facing Functionality
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Requested permissions are used exclusively to display and synchronize your calendar
                      events, contacts, and tasks inside your personal session.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      No Advertising or Data Selling
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      We never sell, rent, or transfer your Google user data to data brokers or third-party
                      advertisers.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      No AI Model Training
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Your communications and Google account data are never used to train, retrain, or
                      fine-tune generalized AI or machine learning models.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4 pt-6 border-t border-border/60">
                <Link
                  href={`${privacyUrl}#google-workspace`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <span>Read our detailed Google User Data Privacy terms (§9)</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={termsUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
                >
                  <span>Terms of Service</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Open Standards Section */}
        <section id="security" className="py-20 border-t border-border bg-muted/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  <Database className="h-3.5 w-3.5 text-primary" />
                  <span>Open Architecture</span>
                </div>
                <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Built on Open Protocols and Strong Cryptography
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Unlike proprietary walled gardens, Comail operates on verifiable open standards.
                  Whether connecting via Stalwart JMAP, atproto decentralized identity, or standard
                  OAuth 2.0 authorization, you retain full ownership of your data and credentials.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>AES-256 encrypted credential tokens stored in httpOnly session cookies</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Cross-Origin Resource Sharing (CORS) and strict Content Security Policies (CSP)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Direct client-to-server operations with no intermediate tracking proxies</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-sm font-semibold text-foreground">Transparency Guarantee</span>
                    <span className="text-xs text-primary font-mono font-medium">AGPL-3.0 License</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Comail&apos;s source code is publicly accessible, allowing users and security researchers
                    to inspect our network calls, audit token handling, and verify our privacy commitments.
                  </p>
                  <div className="pt-2 flex items-center gap-3">
                    <Link
                      href={loginUrl}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Sign In</span>
                    </Link>
                    <Link
                      href={privacyUrl}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      <span>Review Privacy Policy</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="border-t border-border bg-gradient-to-b from-background to-muted/30 py-16 text-center">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Experience the Future of Cooperative Email
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Sign in to your Comail mailbox to access your mail, calendars, contacts, and tasks.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href={primaryActionUrl}
                id="footer-sign-in-btn"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition-all hover:bg-primary/90"
              >
                <LogIn className="h-4 w-4" />
                <span>{primaryActionLabel === "Sign In" ? "Sign In to Webmail" : "Open Webmail"}</span>
              </Link>
              <Link
                href={privacyUrl}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
              >
                <span>Privacy Policy</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-10 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <img
                src={withBasePath("/branding/comail/cammie-mark.png")}
                alt=""
                className="h-6 w-6 object-contain opacity-80"
              />
              <span className="font-medium text-foreground">Comail</span>
              <span>·</span>
              <span>Atmosphere Mail LLC</span>
            </div>

            <nav className="flex flex-wrap items-center gap-6" aria-label="Footer Navigation">
              <Link href={privacyUrl} className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href={termsUrl} className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <Link href={`${privacyUrl}#google-workspace`} className="hover:text-foreground transition-colors">
                Google API Disclosure
              </Link>
              <Link href={loginUrl} className="hover:text-foreground transition-colors">
                Sign In
              </Link>
            </nav>
          </div>

          <div className="mt-8 border-t border-border/40 pt-6 text-center text-muted-foreground/80">
            <p>
              &copy; {new Date().getFullYear()} Atmosphere Mail LLC. All rights reserved. Cooperative email
              infrastructure for open communication.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
