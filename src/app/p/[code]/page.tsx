import type { Metadata } from "next";
import { PhotoDeck } from "@/components/photo-deck";

export const metadata: Metadata = {
  title: "Photo",
  description: "A drink photo from Urban Grind.",
};

export default async function ShortPhotoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PhotoDeck entryCode={code} />;
}
