import type { Metadata } from "next";
import { PhotoDetail } from "@/components/photo-detail";

export const metadata: Metadata = {
  title: "Photo",
  description: "A drink photo from Urban Grind.",
};

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhotoDetail key={id} id={id} />;
}
