/** Fractions of the upright photo. The vote card is 3:4. */
export type PhotoCrop = { x: number; y: number; width: number; height: number };

export const CARD_ASPECT = 3 / 4;
const MAX_ZOOM = 4;

export function coverCrop(imageWidth: number, imageHeight: number): PhotoCrop {
  const imageAspect = imageWidth / imageHeight;
  if (imageAspect > CARD_ASPECT) {
    const width = CARD_ASPECT / imageAspect;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = imageAspect / CARD_ASPECT;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

export function roundCrop(crop: PhotoCrop): PhotoCrop {
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return { x: round(crop.x), y: round(crop.y), width: round(crop.width), height: round(crop.height) };
}

export function cropKey(crop: PhotoCrop): string {
  return JSON.stringify(roundCrop(crop));
}

export function parsePhotoCrop(input: unknown): PhotoCrop | null {
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const x = record.x;
  const y = record.y;
  const width = record.width;
  const height = record.height;
  if (![x, y, width, height].every((part) => typeof part === "number" && Number.isFinite(part))) return null;
  if (width < 0.05 || height < 0.05) return null;
  if (x < -0.001 || y < -0.001 || x + width > 1.001 || y + height > 1.001) return null;
  return roundCrop({
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.min(1, width),
    height: Math.min(1, height),
  });
}

export function clampPan(crop: PhotoCrop): PhotoCrop {
  const width = Math.min(1, Math.max(0.05, crop.width));
  const height = Math.min(1, Math.max(0.05, crop.height));
  return {
    x: Math.min(1 - width, Math.max(0, crop.x)),
    y: Math.min(1 - height, Math.max(0, crop.y)),
    width,
    height,
  };
}

/** Moves the frame by a finger drag. Distances are in frame pixels. */
export function panCrop(crop: PhotoCrop, dx: number, dy: number, frameWidth: number, frameHeight: number): PhotoCrop {
  if (frameWidth < 1 || frameHeight < 1) return crop;
  return clampPan({
    ...crop,
    x: crop.x - (dx / frameWidth) * crop.width,
    y: crop.y - (dy / frameHeight) * crop.height,
  });
}

/** Zooms around the current center. `zoom` is 1 for the full card frame, up to 4. */
export function zoomCrop(cover: PhotoCrop, zoom: number, centerX: number, centerY: number): PhotoCrop {
  const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
  const width = cover.width / next;
  const height = cover.height / next;
  return clampPan({ x: centerX - width / 2, y: centerY - height / 2, width, height });
}

export function cropPixels(
  imageWidth: number,
  imageHeight: number,
  crop: PhotoCrop,
): { left: number; top: number; width: number; height: number } {
  const left = Math.min(imageWidth - 1, Math.max(0, Math.round(crop.x * imageWidth)));
  const top = Math.min(imageHeight - 1, Math.max(0, Math.round(crop.y * imageHeight)));
  return {
    left,
    top,
    width: Math.min(imageWidth - left, Math.max(1, Math.round(crop.width * imageWidth))),
    height: Math.min(imageHeight - top, Math.max(1, Math.round(crop.height * imageHeight))),
  };
}
