import type { Metadata } from "next";
import { PhotoBoard } from "@/components/photo-board";

export const metadata: Metadata = {
  title: "Photos",
  description: "Photos of drinks from Urban Grind. Add yours.",
};

export default function PhotosPage() {
  return <PhotoBoard />;
}
