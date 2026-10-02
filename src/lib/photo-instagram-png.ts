import { firstName } from "@/lib/first-name";
import { instagramFileName, type InstagramSize } from "@/lib/instagram-png";
import { deliverPng } from "@/lib/share-png";

const GREEN = "#274b3a";
const CREAM = "#f7f4ec";
const WHITE = "#ffffff";

const HEADLINE_LINES = ["VOTE FOR", "MY PHOTO."];
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
  }
> = {
  square: {
    width: 1080,
    height: 1080,
    padX: 68,
    headerTop: 52,
    wordSize: 44,
    kickerSize: 20,
    headlineSize: 120,
    headlineY: 176,
    subheadSize: 32,
    photoTop: 412,
    photoBottom: 948,
    radius: 48,
    footerSize: 32,
    footerY: 1014,
    footer: "Urban Grind Photo Contest",
    pillSize: 28,
  },
  story: {
    width: 1080,
    height: 1920,
    padX: 72,
    headerTop: 148,
    wordSize: 48,
    kickerSize: 22,
    headlineSize: 132,
    headlineY: 400,
    subheadSize: 38,
    photoTop: 720,
    photoBottom: 1408,
    radius: 56,
    footerSize: 36,
    footerY: 1504,
    footer: "Tap my link to vote.",
    pillSize: 32,
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

function drawPill(
  ctx: CanvasRenderingContext2D,
  body: string,
  label: string,
  centerX: number,
  centerY: number,
  size: number,
  maxWidth: number,
) {
  let next = size;
  ctx.font = `700 ${next}px ${body}`;
  while (next > 16 && ctx.measureText(label).width + next * 1.6 > maxWidth) {
    next -= 1;
    ctx.font = `700 ${next}px ${body}`;
  }
  const textWidth = ctx.measureText(label).width;
  const padX = next * 0.85;
  const padY = next * 0.48;
  const width = textWidth + padX * 2;
  const height = next + padY * 2;
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  ctx.fillStyle = WHITE;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.fillStyle = GREEN;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${next}px ${body}`;
  ctx.fillText(label, centerX, centerY + next * 0.04);
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
  ctx.letterSpacing = `${layout.wordSize * 0.06}px`;
  ctx.font = `600 ${layout.wordSize}px ${heading}`;
  ctx.fillText("URBAN", layout.padX, layout.headerTop);
  const wordGap = layout.wordSize * 0.9;
  ctx.fillText("GRIND", layout.padX, layout.headerTop + wordGap);
  const serifBlock = wordGap + layout.wordSize * 0.72;
  const coffeeSize = Math.round(layout.wordSize * 0.4);
  ctx.letterSpacing = `${coffeeSize * 0.34}px`;
  ctx.font = `700 ${coffeeSize}px ${body}`;
  ctx.fillText("COFFEE CO.", layout.padX, layout.headerTop + serifBlock + coffeeSize * 0.35);

  ctx.letterSpacing = `${layout.kickerSize * 0.28}px`;
  ctx.font = `700 ${layout.kickerSize}px ${body}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(KICKER, layout.width - layout.padX, layout.headerTop + serifBlock / 2);
  ctx.letterSpacing = "0px";

  let headlineSize = layout.headlineSize;
  const headlineMax = layout.width - layout.padX * 2;
  while (headlineSize > 72) {
    ctx.font = `600 ${headlineSize}px ${heading}`;
    ctx.letterSpacing = `${headlineSize * 0.025}px`;
    const widest = Math.max(...HEADLINE_LINES.map((line) => ctx.measureText(line).width));
    if (widest <= headlineMax) break;
    headlineSize -= 2;
  }
  ctx.font = `600 ${headlineSize}px ${heading}`;
  ctx.letterSpacing = `${headlineSize * 0.025}px`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = GREEN;
  const lineGap = headlineSize * 0.92;
  HEADLINE_LINES.forEach((line, index) => {
    ctx.fillText(line, layout.width / 2, layout.headlineY + index * lineGap);
  });
  ctx.letterSpacing = "0px";
  drawSubhead(
    ctx,
    body,
    layout.subheadSize,
    layout.headlineY + lineGap + headlineSize * 0.62 + layout.subheadSize * 0.7,
    headlineMax,
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
    photoX + photoWidth / 2,
    photoY + photoHeight,
    layout.pillSize,
    photoWidth * 0.8,
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
