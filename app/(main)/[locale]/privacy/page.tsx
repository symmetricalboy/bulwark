import type { Metadata } from "next";
import { PrivacyContent } from "@/components/legal/privacy-content";

export const metadata: Metadata = {
  title: "Privacy Policy — comail",
  description: "Privacy Policy and data practices for comail cooperative email infrastructure.",
  robots: { index: true, follow: true },
};

export default function LocalizedPrivacyPage() {
  return <PrivacyContent />;
}
