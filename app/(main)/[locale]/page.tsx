import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { HomePageClient } from "@/components/landing/home-page-client";
import { generateLiteLocaleParams } from "@/lib/lite-static-params";

export const generateStaticParams = generateLiteLocaleParams;

export const metadata: Metadata = {
  title: "comail — Modern Webmail & Unified Productivity Suite",
  description:
    "Open-source, privacy-first webmail with two-way Google Workspace synchronization for Calendar, Contacts, and Tasks.",
  robots: { index: true, follow: true },
};

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  let hasSessionCookie = false;
  try {
    const cookieStore = await cookies();
    hasSessionCookie = cookieStore
      .getAll()
      .some((c) => c.name === SESSION_COOKIE || c.name.startsWith(`${SESSION_COOKIE}_`));
  } catch {
    hasSessionCookie = false;
  }

  return <HomePageClient locale={locale} initialHasSession={hasSessionCookie} />;
}
