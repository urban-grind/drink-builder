import type { Metadata } from "next";
import { PhotoDeck } from "@/components/photo-deck";

export const metadata: Metadata = {
  title: "Show us your cup",
  description: "Your drink moment. Snap it, name it, and Barrie votes.",
};

export default function HomePage() {
  return <PhotoDeck />;
}
