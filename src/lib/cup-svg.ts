import type { RecipeSelection } from "@/lib/types";

/**
 * The drink page still draws this stack.
 * The builder preview uses the drink-builder SVG module.
 * Board cards, the success page, My drink, and the Instagram downloads use the PNG
 * saved beside the database when the drink was published.
 * The empty cup file is always the cup. Double espresso lays its fill on top,
 * same size and pixel-aligned, with the fill's black left transparent.
 * Other bases stay the empty cup. Milk, sauce, syrup, add-in, and cold foam stay off.
 */
export const cupFrame = { width: 1086, height: 1448 };

const pictureSrc: Record<string, string> = {
  cup: "/cup-layers/cup.png",
  "double-espresso": "/cup-layers/double-espresso-fill.png",
};

export type CupPicture = {
  src: string;
  dx: number;
  dy: number;
  layer: string;
  id: string;
};

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&apos;";
  });
}

function picture(id: string, layer: string, dx = 0, dy = 0): CupPicture | null {
  const src = pictureSrc[id];
  if (!src) return null;
  return { src, dx, dy, layer, id };
}

/** The picture the Instagram PNGs draw. */
export function cupPictureStack(recipe: RecipeSelection): CupPicture[] {
  const layers: Array<CupPicture | null> = [picture("cup", "cup")];
  if (recipe.base === "double-espresso") layers.push(picture("double-espresso", "base"));
  return layers.filter((layer): layer is CupPicture => layer !== null);
}

function landClass(key: string, land?: ReadonlySet<string>): string {
  return land?.has(key) ? ' class="cup-land"' : "";
}

function imageTag(item: CupPicture, land?: ReadonlySet<string>): string {
  const key = item.layer === "cup" ? "" : `${item.layer}:${item.id}`;
  const attrs =
    item.layer === "cup"
      ? `data-layer="cup"`
      : `data-layer="${xml(item.layer)}" data-${xml(item.layer)}="${xml(item.id)}"`;
  const shift = item.dx || item.dy ? ` transform="translate(${item.dx} ${item.dy})"` : "";
  return `<g ${attrs}${shift}><g${landClass(key, land)}><image href="${xml(item.src)}" x="0" y="0" width="${cupFrame.width}" height="${cupFrame.height}"/></g></g>`;
}

export function cupSvgInner(recipe: RecipeSelection, _clipId: string, land?: ReadonlySet<string>): string {
  return cupPictureStack(recipe).map((item) => imageTag(item, land)).join("");
}

export function cupSvgMarkup(recipe: RecipeSelection): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cupFrame.width} ${cupFrame.height}" width="${cupFrame.width}" height="${cupFrame.height}">${cupSvgInner(recipe, "cup-export")}</svg>`;
}
