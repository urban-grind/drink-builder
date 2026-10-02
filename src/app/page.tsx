import type { Metadata } from "next";
import { PhotoDeck } from "@/components/photo-deck";

export const metadata: Metadata = {
  title: "Sip. Snap. Swipe.",
  description: "Swiping that won't get you in trouble.",
};

export default function HomePage() {
  return <PhotoDeck />;
}
