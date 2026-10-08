import type { Metadata } from "next";
import { headers } from "next/headers";
import { PhotoDeck } from "@/components/photo-deck";
import { drinkStatsEnabled } from "@/lib/drink-stats";
import { getPublicPhotoByCode } from "@/lib/photos";
import { photoShareCard, photoShareImagePath, requestOrigin } from "@/lib/photo-share-card";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  let photo = null;
  try {
    photo = getPublicPhotoByCode(code, null);
  } catch {
    photo = null;
  }
  const card = photoShareCard(photo?.personName ?? "");
  const origin = requestOrigin(await headers());
  const image = origin ? `${origin}${photoShareImagePath(code)}` : photoShareImagePath(code);
  const pageUrl = origin ? `${origin}/p/${code}` : `/p/${code}`;
  return {
    title: { absolute: "Urban Grind Photo Content" },
    description: card.description,
    openGraph: {
      title: card.title,
      description: card.description,
      url: pageUrl,
      siteName: "Urban Grind",
      type: "website",
      images: photo ? [{ url: image, type: "image/jpeg", alt: card.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: card.title,
      description: card.description,
      images: photo ? [image] : undefined,
    },
  };
}

export default async function ShortPhotoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PhotoDeck entryCode={code} drinkStats={drinkStatsEnabled()} />;
}
