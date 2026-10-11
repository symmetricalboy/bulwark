import React from "react";
import Image from "next/image";
import Link from "next/link";

export interface LegalPageLayoutProps {
  title: string;
  effectiveDate: string;
  lede: React.ReactNode;
  children: React.ReactNode;
}

export function LegalPageLayout({
  title,
  effectiveDate,
  lede,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#121214] text-[#1c1c1f] dark:text-[#f2f2f3] flex flex-col font-['Atkinson_Hyperlegible',sans-serif] selection:bg-primary/20">
      {/* Top Header */}
      <header className="border-b border-[#e6e4df] dark:border-[#27272a] bg-[#faf9f5]/80 dark:bg-[#121214]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[760px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-foreground hover:opacity-85 transition-opacity"
            title="Comail Webmail"
          >
            <div className="w-7 h-7 relative flex items-center justify-center">
              <Image
                src="/branding/comail/cammie-icon.png"
                alt="Comail"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </div>
            <span
              className="font-normal text-lg tracking-tight"
              style={{ fontFamily: "var(--comail-font-display, 'Young Serif', Georgia, serif)" }}
            >
              comail
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Webmail</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[760px] w-full mx-auto px-6 py-10 md:py-16">
        <h1
          className="text-3xl md:text-5xl font-normal tracking-tight text-foreground mb-2"
          style={{ fontFamily: "var(--comail-font-display, 'Young Serif', Georgia, serif)" }}
        >
          {title}
        </h1>
        <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-8">
          {effectiveDate}
        </p>

        <div className="text-lg md:text-xl leading-relaxed text-foreground/90 font-medium mb-12 pb-8 border-b border-[#e6e4df] dark:border-[#27272a]">
          {lede}
        </div>

        <div className="space-y-12 leading-relaxed text-foreground/85">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e6e4df] dark:border-[#27272a] mt-auto py-8 text-xs text-muted-foreground bg-[#faf9f5] dark:bg-[#121214]">
        <div className="max-w-[760px] mx-auto px-6 flex flex-col md:flex-row items-baseline justify-between gap-4">
          <p className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">comail</span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>Atmosphere Mail LLC</span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>cooperative email for atproto</span>
          </p>
          <nav className="flex items-center gap-3.5 flex-wrap" aria-label="Legal & Information">
            <Link href="/terms" className="hover:text-foreground underline underline-offset-4 decoration-[#e6e4df] dark:decoration-[#27272a] hover:decoration-foreground transition-colors">
              Terms
            </Link>
            <span aria-hidden="true" className="opacity-40">·</span>
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-4 decoration-[#e6e4df] dark:decoration-[#27272a] hover:decoration-foreground transition-colors">
              Privacy
            </Link>
            <span aria-hidden="true" className="opacity-40">·</span>
            <Link href="/" className="hover:text-foreground underline underline-offset-4 decoration-[#e6e4df] dark:decoration-[#27272a] hover:decoration-foreground transition-colors">
              Webmail
            </Link>
            <span aria-hidden="true" className="opacity-40">·</span>
            <a
              href="https://comail.at"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-4 decoration-[#e6e4df] dark:decoration-[#27272a] hover:decoration-foreground transition-colors"
            >
              comail.at
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  marker,
  title,
  children,
}: {
  marker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 pt-2">
      <span className="text-[11px] font-mono tracking-widest uppercase text-primary/90 dark:text-primary-foreground/80 block font-semibold">
        {marker}
      </span>
      <h2
        className="text-2xl font-normal tracking-tight text-foreground"
        style={{ fontFamily: "var(--comail-font-display, 'Young Serif', Georgia, serif)" }}
      >
        {title}
      </h2>
      <div className="space-y-4 text-[15px] md:text-base leading-relaxed text-foreground/85 [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_code]:bg-muted/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono">
        {children}
      </div>
    </section>
  );
}
