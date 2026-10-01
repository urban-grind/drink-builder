import type { Metadata } from "next";
import { PhotoDetail } from "@/components/photo-detail";

export const metadata: Metadata = {
  title: "Photo",
  description: "A drink photo from Urban Grind.",
};

export default async function ShortPhotoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PhotoDetail key={code} code={code} />;
}
