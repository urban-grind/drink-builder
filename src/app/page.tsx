import type { Metadata } from "next";
import { PhotoDeck } from "@/components/photo-deck";
import { drinkStatsEnabled } from "@/lib/drink-stats";

export const metadata: Metadata = {
  title: { absolute: "Urban Grind Photo Content" },
  description: "Swiping that won't get you in trouble.",
};

export default function HomePage() {
  return <PhotoDeck drinkStats={drinkStatsEnabled()} />;
}
