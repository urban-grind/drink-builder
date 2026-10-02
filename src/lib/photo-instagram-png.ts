import { firstName } from "@/lib/first-name";
import { instagramFileName, type InstagramSize } from "@/lib/instagram-png";
import { deliverPng } from "@/lib/share-png";

const GREEN = "#274b3a";
const CREAM = "#f7f4ec";
const WHITE = "#ffffff";

const HEADLINE = "VOTE FOR MY PHOTO";
const SUBHEAD_BEFORE = "Help me win ";
const SUBHEAD_BOLD = "free coffee";
const SUBHEAD_AFTER = " for a month.";
const KICKER = "PHOTO CONTEST";

const canvases: Record<
  InstagramSize,
  {
    width: number;
    height: number;
    padX: number;
    headerTop: number;
    wordSize: number;
    kickerSize: number;
    headlineSize: number;
    headlineY: number;
    subheadSize: number;
    photoTop: number;
    photoBottom: number;
    radius: number;
    footerSize: number;
    footerY: number;
    footer: string;
    pillSize: number;
    pillInset: number;
  }
> = {
  square: {
    width: 1080,
    height: 1080,
    padX: 68,
    headerTop: 52,
    wordSize: 44,
    kickerSize: 20,
    headlineSize: 92,
    headlineY: 248,
    subheadSize: 32,
    photoTop: 390,
    photoBottom: 948,
    radius: 48,
    footerSize: 32,
    footerY: 1014,
    footer: "Urban Grind Photo Contest",
    pillSize: 28,
    pillInset: 28,
  },
  story: {
    width: 1080,
    height: 1920,
    padX: 72,
    headerTop: 148,
    wordSize: 48,
    kickerSize: 22,
    headlineSize: 100,
    headlineY: 430,
    subheadSize: 38,
    photoTop: 640,
    photoBottom: 1408,
    radius: 56,
    footerSize: 36,
    footerY: 1504,
    footer: "Tap my link to vote.",
    pillSize: 30,
    pillInset: 36,
  },
};

function fontFamily(sample: Element | null, fallback: string): string {
  if (!sample) return fallback;
  return getComputedStyle(sample).fontFamily || fallback;
}

function loadPicture(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The photo didn't draw."));
    image.src = src;
  });
}

function entryLabel(personName: string): string {
  const name = firstName(personName);
  if (!name) return "My entry";
  return `${name}\u2019s entry`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

function fitSize(ctx: CanvasRenderingContext2D, text: string, font: string, size: number, maxWidth: number, min: number): number {
  let next = size;
  ctx.font = font.replace("SIZE", String(next));
  while (next > min && ctx.measureText(text).width > maxWidth) {
    next -= 2;
    ctx.font = font.replace("SIZE", String(next));
  }
  return next;
}

function drawSubhead(
  ctx: CanvasRenderingContext2D,
  body: string,
  size: number,
  y: number,
  maxWidth: number,
  canvasWidth: number,
) {
  let next = size;
  const widthOf = (px: number) => {
    ctx.font = `400 ${px}px ${body}`;
    const before = ctx.measureText(SUBHEAD_BEFORE).width;
    const after = ctx.measureText(SUBHEAD_AFTER).width;
    ctx.font = `700 ${px}px ${body}`;
    return before + ctx.measureText(SUBHEAD_BOLD).width + after;
  };
  while (next > 20 && widthOf(next) > maxWidth) next -= 1;
  const total = widthOf(next);
  let x = (canvasWidth - total) / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = GREEN;
  ctx.font = `400 ${next}px ${body}`;
  ctx.fillText(SUBHEAD_BEFORE, x, y);
  x += ctx.measureText(SUBHEAD_BEFORE).width;
  ctx.font = `700 ${next}px ${body}`;
  ctx.fillText(SUBHEAD_BOLD, x, y);
  x += ctx.measureText(SUBHEAD_BOLD).width;
  ctx.font = `400 ${next}px ${body}`;
  ctx.fillText(SUBHEAD_AFTER, x, y);
}

function drawPill(ctx: CanvasRenderingContext2D, body: string, label: string, x: number, y: number, size: number, maxWidth: number) {
  let next = size;
  ctx.font = `700 ${next}px ${body}`;
  while (next > 16 && ctx.measureText(label).width + next > maxWidth) {
    next -= 1;
    ctx.font = `700 ${next}px ${body}`;
  }
  const textWidth = ctx.measureText(label).width;
  const padX = next * 0.72;
  const padY = next * 0.42;
  const width = textWidth + padX * 2;
  const height = next + padY * 2;
  ctx.fillStyle = WHITE;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.fillStyle = GREEN;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${next}px ${body}`;
  ctx.fillText(label, x + padX, y + height / 2 + next * 0.04);
}

/**
 * Cream contest card. Square 1080×1080, story 1080×1920.
 * Phone share and computer download both use this picture.
 */
export async function renderPhotoInstagramPng(
  photo: { personName: string; drinkName: string; photoUrl: string },
  size: InstagramSize,
): Promise<Blob> {
  await document.fonts.ready;
  const layout = canvases[size];
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser couldn't build the picture.");

  const heading = fontFamily(document.querySelector(".font-heading"), "Georgia, serif");
  const body = fontFamily(document.body, "sans-serif");
  await Promise.all([
    document.fonts.load(`600 ${layout.headlineSize}px ${heading}`),
    document.fonts.load(`400 ${layout.subheadSize}px ${body}`),
    document.fonts.load(`700 ${layout.subheadSize}px ${body}`),
  ]);
  const image = await loadPicture(photo.photoUrl);

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = GREEN;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.letterSpacing = `${layout.wordSize * 0.12}px`;
  ctx.font = `600 ${layout.wordSize}px ${heading}`;
  ctx.fillText("URBAN", layout.padX, layout.headerTop);
  const wordGap = layout.wordSize * 0.96;
  ctx.fillText("GRIND", layout.padX, layout.headerTop + wordGap);
  const wordBlock = wordGap + layout.wordSize * 0.78;

  ctx.letterSpacing = `${layout.kickerSize * 0.28}px`;
  ctx.font = `700 ${layout.kickerSize}px ${body}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(KICKER, layout.width - layout.padX, layout.headerTop + wordBlock / 2);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "center";

  const headlineSize = fitSize(
    ctx,
    HEADLINE,
    `600 SIZE px ${heading}`,
    layout.headlineSize,
    layout.width - layout.padX * 2,
    48,
  );
  ctx.font = `600 ${headlineSize}px ${heading}`;
  ctx.textBaseline = "middle";
  ctx.fillText(HEADLINE, layout.width / 2, layout.headlineY);
  drawSubhead(
    ctx,
    body,
    layout.subheadSize,
    layout.headlineY + headlineSize * 0.7 + layout.subheadSize * 0.55,
    layout.width - layout.padX * 2,
    layout.width,
  );

  const photoX = layout.padX;
  const photoY = layout.photoTop;
  const photoWidth = layout.width - layout.padX * 2;
  const photoHeight = layout.photoBottom - layout.photoTop;
  drawCover(ctx, image, photoX, photoY, photoWidth, photoHeight, layout.radius);

  drawPill(
    ctx,
    body,
    entryLabel(photo.personName),
    photoX + layout.pillInset,
    photoY + layout.pillInset,
    layout.pillSize,
    photoWidth - layout.pillInset * 2,
  );

  ctx.fillStyle = GREEN;
  ctx.font = `700 ${layout.footerSize}px ${body}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(layout.footer, layout.width / 2, layout.footerY);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture didn't save.");
  return blob;
}

export async function savePhotoInstagramPng(
  photo: { personName: string; drinkName: string; photoUrl: string },
  size: InstagramSize,
  share: boolean,
): Promise<void> {
  const blob = await renderPhotoInstagramPng(photo, size);
  await deliverPng(blob, instagramFileName(photo.drinkName, size), share);
}
