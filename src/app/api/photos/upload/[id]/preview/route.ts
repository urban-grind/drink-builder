import { NextResponse } from "next/server";
import { readUploadPreview } from "@/lib/photo-prepare";
import { safeErrorText } from "@/lib/safe-log";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return new NextResponse(null, { status: 404 });

  try {
    const bytes = await readUploadPreview(id);
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to preview a photo", safeErrorText(error));
    return new NextResponse(null, { status: 500 });
  }
}
