import type { Metadata } from "next";
import { SiteActivity } from "@/components/site-activity";

export const metadata: Metadata = {
  title: "Site activity",
  description: "Private look at how people use the contest and the menu.",
  robots: { index: false, follow: false },
};

export default function SiteActivityPage() {
  return <SiteActivity />;
}
