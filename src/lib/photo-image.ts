import sharp from "sharp";
import { cropPixels, type PhotoCrop } from "@/lib/photo-crop";
import { PHOTO_CONTENT_TYPES } from "@/lib/photo-validation";

export const VOTE_LONG_EDGE = 1600;
export const THUMB_LONG_EDGE = 640;
export const IMAGE_QUALITY = 85;

const PIXEL_LIMIT = 120_000_000;

export type DetectedImage = "jpeg" | "png" | "webp" | "heic";

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

const TYPE_FOR_KIND: Record<DetectedImage, readonly string[]> = {
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heic: ["image/heic", "image/heif"],
};

export function detectImageType(bytes: Buffer): DetectedImage | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (bytes.toString("ascii", 4, 8) === "ftyp" && HEIF_BRANDS.has(bytes.toString("ascii", 8, 12))) return "heic";
  return null;
}

export function contentTypeMatches(contentType: string, kind: DetectedImage): boolean {
  return TYPE_FOR_KIND[kind].includes(contentType) && (PHOTO_CONTENT_TYPES as readonly string[]).includes(contentType);
}

type HeicConvert = (options: {
  buffer: Buffer | Uint8Array;
  format: "JPEG" | "PNG";
  quality?: number;
}) => Promise<ArrayBuffer>;

async function loadHeicConvert(): Promise<HeicConvert> {
  const imported = (await import("heic-convert")) as { default?: HeicConvert } & HeicConvert;
  return typeof imported.default === "function" ? imported.default : imported;
}

/** Decode HEIC with the wasm libheif build when sharp's native HEIF decoder cannot. */
export async function decodeHeicWithWasm(bytes: Buffer): Promise<Buffer> {
  const convert = await loadHeicConvert();
  const jpeg = await convert({ buffer: bytes, format: "JPEG", quality: 0.92 });
  return Buffer.from(jpeg);
}

const sharpOptions = { failOn: "none" as const, animated: false, limitInputPixels: PIXEL_LIMIT };

async function renderOriented(bytes: Buffer, longEdge: number, crop: PhotoCrop | null): Promise<Buffer> {
  let pipeline = sharp(bytes, sharpOptions);
  if (crop) {
    const meta = await sharp(bytes, sharpOptions).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width > 0 && height > 0) pipeline = pipeline.extract(cropPixels(width, height, crop));
  }
  return pipeline
    .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer();
}

async function renderPair(bytes: Buffer, crop: PhotoCrop | null): Promise<{ vote: Buffer; thumb: Buffer }> {
  const oriented = await sharp(bytes, sharpOptions).rotate().toBuffer();
  const vote = await renderOriented(oriented, VOTE_LONG_EDGE, crop);
  const thumb = await renderOriented(oriented, THUMB_LONG_EDGE, crop);
  return { vote, thumb };
}

export async function makeBoardImages(
  bytes: Buffer,
  crop?: PhotoCrop | null,
): Promise<{ vote: Buffer; thumb: Buffer } | { error: string }> {
  const kind = detectImageType(bytes);
  if (!kind) return { error: "That file isn't a JPEG, PNG, WebP, or HEIC photo." };
  const frame = crop ?? null;

  try {
    return await renderPair(bytes, frame);
  } catch {
    // Sharp's prebuilt libvips often reads the HEIC header but cannot decode HEVC.
    if (kind !== "heic") return { error: "That photo couldn't be prepared. Try a different image." };
  }

  try {
    return await renderPair(await decodeHeicWithWasm(bytes), frame);
  } catch {
    return { error: "That HEIC photo couldn't be prepared. Try a JPEG or PNG." };
  }
}
