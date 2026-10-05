import { firstName } from "@/lib/first-name";
import { instagramFileName, type InstagramSize } from "@/lib/instagram-png";
import { deliverPng } from "@/lib/share-png";

const GREEN = "#274b3a";
const CREAM = "#f7f4ec";
const WHITE = "#ffffff";
const LOGO = "/urban-grind-logo.png";

/** Visible wordmark width on a 1080-wide card. Tall enough to read, short of the headline. */
const LOGO_WIDTH: Record<InstagramSize, number> = {
  square: 460,
  story: 500,
};

type CardLayout = {
  width: number;
  height: number;
  top: number;
  logoGap: number;
  kickerSize: number;
  kickerGap: number;
  lines: { text: string; size: number; gap: number }[];
  photoGap: number;
  photoSize: number;
  radius: number;
  nameSize: number;
  nameGap: number;
  cta: "pill" | "story";
  ctaSize: number;
};

const cards: Record<InstagramSize, CardLayout> = {
  square: {
    width: 1080,
    height: 1080,
    top: 40,
    logoGap: 18,
    kickerSize: 26,
    kickerGap: 20,
    lines: [
      { text: "HELP ME WIN", size: 92, gap: 6 },
      { text: "FREE COFFEE FOR A MONTH", size: 46, gap: 24 },
    ],
    photoGap: 18,
    photoSize: 530,
    radius: 52,
    nameSize: 32,
    nameGap: 18,
    cta: "pill",
    ctaSize: 36,
  },
  story: {
    width: 1080,
    height: 1920,
    top: 96,
    logoGap: 40,
    kickerSize: 30,
    kickerGap: 44,
    lines: [
      { text: "HELP ME WIN", size: 108, gap: 6 },
      { text: "FREE COFFEE", size: 108, gap: 6 },
      { text: "FOR A MONTH", size: 86, gap: 48 },
    ],
    photoGap: 36,
    photoSize: 760,
    radius: 64,
    nameSize: 36,
    nameGap: 28,
    cta: "story",
    ctaSize: 72,
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
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) * 0.62, drawWidth, drawHeight);
  ctx.restore();
}

function fitSize(ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, size: number, maxWidth: number): number {
  let next = size;
  while (next > 24) {
    ctx.font = `${weight} ${next}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return next;
    next -= 2;
  }
  return next;
}

function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.78);
  ctx.bezierCurveTo(cx - s * 0.05, cy + s * 0.35, cx - s * 1.08, cy + s * 0.12, cx - s * 1.08, cy - s * 0.32);
  ctx.bezierCurveTo(cx - s * 1.08, cy - s * 0.92, cx - s * 0.32, cy - s * 1.02, cx, cy - s * 0.38);
  ctx.bezierCurveTo(cx + s * 0.32, cy - s * 1.02, cx + s * 1.08, cy - s * 0.92, cx + s * 1.08, cy - s * 0.32);
  ctx.bezierCurveTo(cx + s * 1.08, cy + s * 0.12, cx + s * 0.05, cy + s * 0.35, cx, cy + s * 0.78);
  ctx.closePath();
  ctx.fill();
}

function drawVotePill(ctx: CanvasRenderingContext2D, body: string, centerX: number, top: number, size: number) {
  const label = "VOTE FOR ME";
  ctx.font = `700 ${size}px ${body}`;
  ctx.letterSpacing = `${size * 0.04}px`;
  const textWidth = ctx.measureText(label).width;
  const heart = size * 0.92;
  const gap = size * 0.38;
  const padX = size * 1.05;
  const height = size * 2.05;
  const width = padX * 2 + heart + gap + textWidth;
  const x = centerX - width / 2;
  ctx.fillStyle = GREEN;
  roundRect(ctx, x, top, width, height, height / 2);
  ctx.fill();
  ctx.fillStyle = WHITE;
  drawHeart(ctx, x + padX + heart / 2, top + height / 2 + size * 0.04, heart);
  ctx.fillStyle = WHITE;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px ${body}`;
  ctx.fillText(label, x + padX + heart + gap, top + height / 2 + size * 0.04);
  ctx.letterSpacing = "0px";
}

function drawStoryCta(ctx: CanvasRenderingContext2D, heading: string, centerX: number, top: number, size: number) {
  const label = "VOTE FOR ME";
  const fitted = fitSize(ctx, label, 600, heading, size, 860);
  ctx.font = `600 ${fitted}px ${heading}`;
  const textWidth = ctx.measureText(label).width;
  const heart = fitted * 0.72;
  const gap = fitted * 0.22;
  const total = textWidth + gap + heart;
  const x = centerX - total / 2;
  ctx.fillStyle = GREEN;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, top + fitted * 0.55);
  drawHeart(ctx, x + textWidth + gap + heart / 2, top + fitted * 0.52, heart);
  drawVoteArrow(ctx, x + textWidth + gap + heart * 0.15, top + fitted * 0.95);
}

function drawVoteArrow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = GREEN;
  ctx.fillStyle = GREEN;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + 28, y + 10, x + 86, y + 28, x + 62, y + 118);
  ctx.stroke();
  const tipX = x + 62;
  const tipY = y + 118;
  ctx.beginPath();
  ctx.moveTo(tipX - 2, tipY + 2);
  ctx.lineTo(tipX - 30, tipY - 10);
  ctx.lineTo(tipX - 6, tipY - 32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
  const layout = cards[size];
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser couldn't build the picture.");

  const heading = fontFamily(document.querySelector(".font-heading"), "Georgia, serif");
  const body = fontFamily(document.body, "sans-serif");
  await Promise.all([
    document.fonts.load(`600 108px ${heading}`),
    document.fonts.load(`700 ${layout.kickerSize}px ${body}`),
    document.fonts.load(`400 ${layout.nameSize}px ${body}`),
    document.fonts.load(`700 ${layout.ctaSize}px ${body}`),
  ]);
  const [image, logo] = await Promise.all([loadPicture(photo.photoUrl), loadPicture(LOGO)]);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = GREEN;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const logoWidth = LOGO_WIDTH[size];
  const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
  ctx.drawImage(logo, (layout.width - logoWidth) / 2, layout.top, logoWidth, logoHeight);

  let y = layout.top + logoHeight + layout.logoGap;
  ctx.letterSpacing = `${layout.kickerSize * 0.28}px`;
  ctx.font = `700 ${layout.kickerSize}px ${body}`;
  ctx.fillText("SIP. SNAP. SWIPE.", layout.width / 2, y + layout.kickerSize / 2);
  ctx.letterSpacing = "0px";
  y += layout.kickerSize + layout.kickerGap;

  const textMax = layout.width - 96;
  for (const line of layout.lines) {
    const fitted = fitSize(ctx, line.text, 600, heading, line.size, textMax);
    ctx.font = `600 ${fitted}px ${heading}`;
    ctx.fillText(line.text, layout.width / 2, y + fitted / 2);
    y += fitted + line.gap;
  }

  const photoX = (layout.width - layout.photoSize) / 2;
  drawCover(ctx, image, photoX, y, layout.photoSize, layout.photoSize, layout.radius);
  y += layout.photoSize + layout.photoGap;

  const name = firstName(photo.personName) || "Friend";
  ctx.font = `400 ${layout.nameSize}px ${body}`;
  ctx.fillStyle = GREEN;
  ctx.fillText(name, layout.width / 2, y + layout.nameSize / 2);
  y += layout.nameSize + layout.nameGap;

  if (layout.cta === "pill") drawVotePill(ctx, body, layout.width / 2, y, layout.ctaSize);
  else drawStoryCta(ctx, heading, layout.width / 2, y, layout.ctaSize);

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
