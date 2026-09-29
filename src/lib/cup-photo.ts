import fs from "node:fs";
import path from "node:path";
import { parseHTML } from "linkedom";
import { Resvg } from "@resvg/resvg-js";
import { drinkVisualState } from "@/lib/drink-visual";
import type { RecipeSelection } from "@/lib/types";

/** Wide enough for a retina board card, far smaller than the 24MB master. */
const CARD_WIDTH = 560;

type DrinkRenderer = {
  createDrinkRenderer: (svg: Element, options: unknown, initial: ReturnType<typeof drinkVisualState>) => unknown;
};

type SvgAssets = {
  svgText: string;
  options: unknown;
  createDrinkRenderer: DrinkRenderer["createDrinkRenderer"];
};

let assets: SvgAssets | null = null;

function cupsDir(): string {
  return path.join(process.cwd(), "data", "cups");
}

export function cupPhotoPath(id: string): string {
  return path.join(cupsDir(), `${id}.png`);
}

/** Bumps when the drink package changes so cached card photos are fetched again. */
const PHOTO_VERSION = "2";

export function cupPhotoUrl(id: string): string {
  return `/api/drinks/${id}/photo?v=${PHOTO_VERSION}`;
}

export function cupPhotoExists(id: string): boolean {
  return fs.existsSync(cupPhotoPath(id));
}

async function loadAssets(): Promise<SvgAssets> {
  if (assets) return assets;
  const root = path.join(process.cwd(), "public", "drink-builder");
  const svgText = fs.readFileSync(path.join(root, "drink-master.svg"), "utf8");
  const options = JSON.parse(fs.readFileSync(path.join(root, "ingredient-options.json"), "utf8")) as unknown;
  const load = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<DrinkRenderer>;
  const renderer = await load(path.join(root, "drink-renderer.mjs"));
  assets = { svgText, options, createDrinkRenderer: renderer.createDrinkRenderer };
  return assets;
}

/** Rasterize the builder cup for this recipe. The SVG string is not written anywhere. */
export async function renderCupPhoto(recipe: RecipeSelection): Promise<Buffer> {
  const { svgText, options, createDrinkRenderer } = await loadAssets();
  const { window } = parseHTML("<!DOCTYPE html><html><body></body></html>");
  const parsed = new window.DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = parsed.documentElement;
  if (parsed.querySelector("parsererror") || svg.localName !== "svg") {
    throw new Error("Invalid drink SVG");
  }
  createDrinkRenderer(svg, options, drinkVisualState(recipe));
  const png = new Resvg(svg.toString(), { fitTo: { mode: "width", value: CARD_WIDTH } }).render().asPng();
  return Buffer.from(png);
}

export async function writeCupPhoto(id: string, recipe: RecipeSelection): Promise<void> {
  const png = await renderCupPhoto(recipe);
  fs.mkdirSync(cupsDir(), { recursive: true });
  fs.writeFileSync(cupPhotoPath(id), png);
}

export function readCupPhoto(id: string): Buffer | null {
  const file = cupPhotoPath(id);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}
