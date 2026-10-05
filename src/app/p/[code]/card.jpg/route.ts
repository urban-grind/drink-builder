import { NextResponse } from "next/server";
import { getPublicPhotoByCode } from "@/lib/photos";
import { previewJpeg, readVoteImage } from "@/lib/photo-share-card";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  try {
    const photo = getPublicPhotoByCode(code, null);
    if (!photo) return new NextResponse(null, { status: 404 });
    const bytes = await readVoteImage(photo.id);
    if (!bytes) return new NextResponse(null, { status: 404 });
    const { jpeg } = await previewJpeg(bytes);
    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to build share card", safeErrorText(error));
    return new NextResponse(null, { status: 500 });
  }
}
