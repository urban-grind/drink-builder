import { NextResponse } from "next/server";
import { readOrCreateCupPhoto } from "@/lib/drinks";
import { isUuid } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const png = await readOrCreateCupPhoto(id);
    if (!png) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to read cup photo", error);
    return new NextResponse(null, { status: 500 });
  }
}
