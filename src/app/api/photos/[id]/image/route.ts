import { NextResponse } from "next/server";
import { requestIsReviewer } from "@/lib/photo-auth";
import { photoImageKey } from "@/lib/photos";
import { getPhotoStorage } from "@/lib/r2";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const variant = new URL(request.url).searchParams.get("variant");
  if (!isUuid(id) || (variant !== "thumb" && variant !== "vote")) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const image = photoImageKey(id, variant, requestIsReviewer(request));
    if (!image) return new NextResponse(null, { status: 404 });
    const storage = getPhotoStorage();
    if (!storage) return new NextResponse(null, { status: 404 });
    const bytes = await storage.get(image.key);
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": image.approved ? "public, max-age=86400" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to read photo", safeErrorText(error));
    return new NextResponse(null, { status: 500 });
  }
}
