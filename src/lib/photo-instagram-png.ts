import { instagramFileName, type InstagramSize } from "@/lib/instagram-png";
import { deliverPng } from "@/lib/share-png";

const GREEN = "#274b3a";
const CREAM = "#f3f2ef";
const KICKER = "URBAN GRIND";

const canvases: Record<InstagramSize, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

function fontFamily(sample: Element | null, fallback: string): string {
  if (!sample) return fallback;
  return getComputedStyle(sample).fontFamily || fallback;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function loadPicture(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The photo didn't draw."));
    image.src = src;
  });
}

/**
 * Story 1080×1920 and square 1080×1080.
 * The whole photo stays in frame (contained, never cropped). No email.
 */
export async function renderPhotoInstagramPng(
  photo: { drinkName: string; photoUrl: string },
  size: InstagramSize,
): Promise<Blob> {
  await document.fonts.ready;
  const { width, height } = canvases[size];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser couldn't build the picture.");

  const heading = fontFamily(document.querySelector(".font-heading"), "Georgia, serif");
  const body = fontFamily(document.body, "sans-serif");
  const tall = height > width;
  const image = await loadPicture(photo.photoUrl);

  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const kickerSize = tall ? 28 : 22;
  ctx.letterSpacing = "0.22em";
  ctx.font = `700 ${kickerSize}px ${body}`;
  const kickerY = tall ? 120 : 72;
  ctx.fillText(KICKER, width / 2, kickerY);
  ctx.letterSpacing = "0px";

  const nameSize = tall ? 84 : 64;
  ctx.font = `600 ${nameSize}px ${heading}`;
  const lines = wrapLines(ctx, photo.drinkName, width - 160);
  const lineGap = nameSize * 1.08;
  const side = tall ? 84 : 72;
  const nameBlock = lineGap * Math.max(lines.length, 1) + (tall ? 120 : 80);
  const photoTop = kickerY + kickerSize + (tall ? 56 : 36);
  const photoBottom = height - nameBlock;
  const boxWidth = width - side * 2;
  const boxHeight = Math.max(1, photoBottom - photoTop);
  const scale = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = photoTop + (boxHeight - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  ctx.fillStyle = CREAM;
  ctx.font = `600 ${nameSize}px ${heading}`;
  const nameTop = photoBottom + (tall ? 36 : 24) + nameSize / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, nameTop + index * lineGap);
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture didn't save.");
  return blob;
}

export async function savePhotoInstagramPng(
  photo: { drinkName: string; photoUrl: string },
  size: InstagramSize,
  share: boolean,
): Promise<void> {
  const blob = await renderPhotoInstagramPng(photo, size);
  await deliverPng(blob, instagramFileName(photo.drinkName, size), share);
}
