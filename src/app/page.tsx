import type { Metadata } from "next";
import { PhotoBoard } from "@/components/photo-board";

export const metadata: Metadata = {
  title: "Show us your cup",
  description: "Your drink moment. Snap it, name it, and Barrie votes.",
};

export default function HomePage() {
  return <PhotoBoard />;
}
