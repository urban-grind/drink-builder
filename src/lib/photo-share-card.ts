import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { photoImageKey } from "@/lib/photos";
import { getPhotoStorage } from "@/lib/r2";
import { localSampleAsset } from "@/lib/sample-photos";

const PHOTO_DIR = path.join(process.cwd(), "public", "photos");
const PREVIEW_LONG_EDGE = 1200;

export { photoShareCard } from "@/lib/photo-share-text";

export function photoShareImagePath(code: string): string {
  return `/p/${code}/card.jpg`;
}

/** Absolute site origin from the request Railway or the dev server forwarded. */
export function requestOrigin(headerList: { get(name: string): string | null }): string | null {
  const rawHost = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const host = rawHost?.split(",")[0]?.trim();
  if (!host) return null;
  const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwarded || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

function readLocalSample(key: string): Buffer | null {
  const urlPath = localSampleAsset(key);
  if (!urlPath?.startsWith("/photos/")) return null;
  const file = path.basename(decodeURIComponent(urlPath.slice("/photos/".length)));
  const full = path.join(PHOTO_DIR, file);
  try {
    return fs.readFileSync(full);
  } catch {
    return null;
  }
}

export async function readVoteImage(photoId: string): Promise<Buffer | null> {
  const image = photoImageKey(photoId, "vote", false);
  if (!image) return null;
  const local = readLocalSample(image.key);
  if (local) return local;
  const storage = getPhotoStorage();
  if (!storage) return null;
  return storage.get(image.key);
}

/** A JPEG iMessage can show. WebP vote files stay as they are for the app. */
export async function previewJpeg(bytes: Buffer): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const jpeg = await sharp(bytes, { failOn: "none", animated: false, limitInputPixels: 120_000_000 })
    .rotate()
    .resize({ width: PREVIEW_LONG_EDGE, height: PREVIEW_LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  const meta = await sharp(jpeg).metadata();
  return { jpeg, width: meta.width ?? PREVIEW_LONG_EDGE, height: meta.height ?? PREVIEW_LONG_EDGE };
}
