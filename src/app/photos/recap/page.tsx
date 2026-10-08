import type { Metadata } from "next";
import { DailyRecap } from "@/components/daily-recap";

export const metadata: Metadata = {
  title: "Daily Recap",
  description: "The photo contest from the opening until now.",
  robots: { index: false, follow: false },
};

export default function DailyRecapPage() {
  return <DailyRecap />;
}
