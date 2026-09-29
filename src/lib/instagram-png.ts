/** One deep-green poster. The saved cup is a cutout; the drink name is the only large type. */
export type InstagramSize = "story" | "square";

const GREEN = "#274b3a";
const CREAM = "#f3f2ef";
const KICKER = "BUILD YOUR DRINK  ·  URBAN GRIND";

const canvases: Record<InstagramSize, { width: number; height: number; file: string }> = {
  story: { width: 1080, height: 1920, file: "story" },
  square: { width: 1080, height: 1080, file: "square" },
};

export function instagramFileName(drinkName: string, size: InstagramSize): string {
  const slug = drinkName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${slug || "drink"}-instagram-${canvases[size].file}.png`;
}

function fontFamily(sample: Element | null, fallback: string): string {
  if (!sample) return fallback;
  const family = getComputedStyle(sample).fontFamily;
  return family || fallback;
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
  return lines.slice(0, 4);
}

function loadPicture(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The cup didn't draw."));
    image.src = src;
  });
}

function opaqueBounds(image: HTMLImageElement): { left: number; top: number; right: number; bottom: number; baseWidth: number } {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const empty = {
    left: 0,
    top: 0,
    right: image.naturalWidth - 1,
    bottom: image.naturalHeight - 1,
    baseWidth: image.naturalWidth,
  };
  if (!ctx) return empty;
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const opaque = (x: number, y: number) => data[(y * width + x) * 4 + 3] > 24;
  let top = height;
  let bottom = 0;
  let left = width;
  let right = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!opaque(x, y)) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < top) return empty;
  const start = bottom - Math.max(8, Math.round((bottom - top) * 0.12));
  let baseLeft = left;
  let baseRight = right;
  let baseCount = 0;
  for (let y = bottom; y >= start; y -= 1) {
    let rowLeft = right;
    let rowRight = left;
    let count = 0;
    for (let x = left; x <= right; x += 1) {
      if (!opaque(x, y)) continue;
      count += 1;
      if (x < rowLeft) rowLeft = x;
      if (x > rowRight) rowRight = x;
    }
    if (count > baseCount) {
      baseCount = count;
      baseLeft = rowLeft;
      baseRight = rowRight;
    }
  }
  return { left, top, right, bottom, baseWidth: Math.max(1, baseRight - baseLeft + 1) };
}

export async function renderInstagramPng(
  drink: { name: string; photoUrl: string },
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
  const photo = await loadPicture(drink.photoUrl);
  const bounds = opaqueBounds(photo);
  const opaqueWidth = bounds.right - bounds.left + 1;
  const opaqueHeight = bounds.bottom - bounds.top + 1;

  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let kickerSize = tall ? 26 : 22;
  ctx.letterSpacing = "0.18em";
  ctx.font = `600 ${kickerSize}px ${body}`;
  while (ctx.measureText(KICKER).width > width - 140 && kickerSize > 16) {
    kickerSize -= 1;
    ctx.font = `600 ${kickerSize}px ${body}`;
  }
  const kickerY = tall ? 176 : 88;
  ctx.fillText(KICKER, width / 2, kickerY);
  ctx.letterSpacing = "0px";

  const nameSize = tall ? 108 : 84;
  ctx.font = `500 ${nameSize}px ${heading}`;
  const lines = wrapLines(ctx, drink.name, width - 140).slice(0, 3);
  const lineGap = nameSize * 1.08;
  const nameBlock = lineGap * lines.length;
  const belowName = tall ? 180 : 80;
  const aboveName = tall ? 48 : 36;
  const sidePad = tall ? 110 : 96;
  const areaTop = kickerY + kickerSize + (tall ? 64 : 40);
  const areaBottom = height - belowName - nameBlock - aboveName;
  const shadowRoom = 36;
  const scale = Math.min((width - sidePad * 2) / opaqueWidth, (areaBottom - areaTop - shadowRoom) / opaqueHeight);
  const drawWidth = photo.naturalWidth * scale;
  const drawHeight = photo.naturalHeight * scale;
  const shadowRadius = Math.min(opaqueWidth, bounds.baseWidth * 1.2) * scale * 0.38;
  const shadowRy = Math.max(14, shadowRadius * 0.16);
  const blockHeight = opaqueHeight * scale + shadowRy * 1.7;
  const blockTop = areaTop + Math.max(0, areaBottom - areaTop - blockHeight) / 2;
  const cupY = blockTop - bounds.top * scale;
  const baseY = blockTop + opaqueHeight * scale;

  ctx.save();
  ctx.filter = `blur(${Math.round(shadowRy * 0.7)}px)`;
  ctx.fillStyle = "rgba(8, 22, 16, 0.55)";
  ctx.beginPath();
  ctx.ellipse(width / 2, baseY + shadowRy * 0.2, shadowRadius, shadowRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(photo, (width - drawWidth) / 2, cupY, drawWidth, drawHeight);

  ctx.fillStyle = CREAM;
  ctx.font = `500 ${nameSize}px ${heading}`;
  const nameTop = baseY + shadowRy * 2.2 + aboveName + nameSize / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, nameTop + index * lineGap);
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture didn't save.");
  return blob;
}

export async function downloadInstagramPng(
  drink: { name: string; photoUrl: string },
  size: InstagramSize,
): Promise<void> {
  const blob = await renderInstagramPng(drink, size);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = instagramFileName(drink.name, size);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
