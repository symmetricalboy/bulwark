import type { Metadata } from "next";
import { TermsContent } from "@/components/legal/terms-content";

export const metadata: Metadata = {
  title: "Terms of Service — comail",
  description: "Terms of Service for comail cooperative email infrastructure.",
  robots: { index: true, follow: true },
};

export default function LocalizedTermsPage() {
  return <TermsContent />;
}
