import type { Metadata } from "next";
import { PhotoBoard } from "@/components/photo-board";

export const metadata: Metadata = {
  title: "Show your drink",
  description: "A photo of what you ordered at Urban Grind. Add yours.",
};

export default function HomePage() {
  return <PhotoBoard />;
}
