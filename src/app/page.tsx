import type { Metadata } from "next";
import { PhotoBoard } from "@/components/photo-board";

export const metadata: Metadata = {
  title: "Get it on the board",
  description: "Snap the drink. Put it on the board. Barrie votes.",
};

export default function HomePage() {
  return <PhotoBoard />;
}
