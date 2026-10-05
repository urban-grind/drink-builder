import type { Metadata } from "next";
import { ContestTerms } from "@/components/contest-terms";

export const metadata: Metadata = {
  title: "Contest terms",
  description: "Sip. Snap. Swipe. contest terms and conditions.",
};

export default function TermsPage() {
  return <ContestTerms />;
}
