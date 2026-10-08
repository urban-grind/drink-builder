import type { DrinkSale } from "@/lib/drink-stats";

/** How often completed Square orders are pulled. */
export const SQUARE_POLL_MS = 10 * 60 * 1000;

const SQUARE_VERSION = "2026-01-22";
const SQUARE_ORIGIN = "https://connect.squareup.com";
const PAGE_LIMIT = 40;

const DRINK_CATEGORIES = new Set(["coffee based beverages", "tea", "kids drinks", "refreshers"]);

type CatalogObject = {
  type?: string;
  id?: string;
  is_deleted?: boolean;
  category_data?: { name?: string };
  image_data?: { url?: string };
  item_data?: {
    category_id?: string;
    categories?: { id?: string }[];
    description?: string;
    description_plaintext?: string;
    image_ids?: string[];
    variations?: { id?: string; is_deleted?: boolean }[];
  };
};

type SquareLine = {
  name?: string;
  quantity?: string;
  catalog_object_id?: string;
  item_type?: string;
};

export type SquareOrder = {
  closed_at?: string;
  created_at?: string;
  line_items?: SquareLine[];
  returns?: { created_at?: string; return_line_items?: SquareLine[] }[];
};

const CACHE_VERSION = 3;

type SalesCache = { version: number; at: number; rangeStart: string; sales: DrinkSale[] };

type SquareSlot = {
  timer?: ReturnType<typeof setInterval>;
  cache?: SalesCache;
  pending?: Promise<DrinkSale[]>;
};

const squareState = globalThis as unknown as { urbanGrindSquare?: SquareSlot };

function slot(): SquareSlot {
  if (!squareState.urbanGrindSquare) squareState.urbanGrindSquare = {};
  return squareState.urbanGrindSquare;
}

export function squareConfigured(): boolean {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN?.trim() && process.env.SQUARE_LOCATION_ID?.trim());
}

/** Keeps the last good pull and refreshes it on a timer. */
export function startSquarePoll(rangeStart: () => string): void {
  const current = slot();
  if (current.timer || !squareConfigured()) return;
  current.timer = setInterval(() => {
    void refreshSquareSales(rangeStart());
  }, SQUARE_POLL_MS);
  current.timer.unref?.();
}

export async function loadCachedSquareSales(rangeStart: string): Promise<DrinkSale[]> {
  if (!squareConfigured()) return [];
  const current = slot();
  if (
    current.cache &&
    current.cache.version === CACHE_VERSION &&
    current.cache.rangeStart === rangeStart &&
    Date.now() - current.cache.at < SQUARE_POLL_MS
  ) {
    return current.cache.sales;
  }
  return refreshSquareSales(rangeStart);
}

async function refreshSquareSales(rangeStart: string): Promise<DrinkSale[]> {
  const current = slot();
  if (current.pending) return current.pending;
  current.pending = fetchSquareDrinkSales(rangeStart)
    .then((sales) => {
      current.cache = { version: CACHE_VERSION, at: Date.now(), rangeStart, sales };
      return sales;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "request failed";
      console.error("Square drink sales didn't refresh.", message);
      return current.cache?.sales ?? [];
    })
    .finally(() => {
      current.pending = undefined;
    });
  return current.pending;
}

export function normalizeCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function categoryNames(objects: readonly CatalogObject[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const object of objects) {
    if (object.type === "CATEGORY" && object.id && object.category_data?.name) {
      names.set(object.id, object.category_data.name);
    }
  }
  return names;
}

function isDrinkItem(object: CatalogObject, names: ReadonlyMap<string, string>): boolean {
  if (object.type !== "ITEM") return false;
  const categoryIds = [
    object.item_data?.category_id,
    ...(object.item_data?.categories ?? []).map((category) => category.id),
  ].filter((id): id is string => Boolean(id));
  return categoryIds.some((id) => DRINK_CATEGORIES.has(normalizeCategory(names.get(id) ?? "")));
}

/** Variation ids whose item sits in one of the drink categories. Sizes stay on that same item. */
export function allowedVariationIds(objects: readonly CatalogObject[]): Set<string> {
  const names = categoryNames(objects);
  const allowed = new Set<string>();
  for (const object of objects) {
    if (!isDrinkItem(object, names)) continue;
    for (const variation of object.item_data?.variations ?? []) {
      if (variation.id && !variation.is_deleted) allowed.add(variation.id);
    }
  }
  return allowed;
}

/** Square photo for each drink size. Regular and Large share the item photo. */
export function variationImageUrls(objects: readonly CatalogObject[]): Map<string, string> {
  const urls = new Map<string, string>();
  for (const object of objects) {
    const url = httpsUrl(object.image_data?.url);
    if (object.type === "IMAGE" && object.id && url) urls.set(object.id, url);
  }
  const names = categoryNames(objects);
  const images = new Map<string, string>();
  for (const object of objects) {
    if (!isDrinkItem(object, names)) continue;
    const imageId = (object.item_data?.image_ids ?? []).find((id) => urls.has(id));
    const url = imageId ? urls.get(imageId) : undefined;
    if (!url) continue;
    for (const variation of object.item_data?.variations ?? []) {
      if (variation.id && !variation.is_deleted) images.set(variation.id, url);
    }
  }
  return images;
}

/** Square description for each drink size. Regular and Large share the item text. */
export function variationDescriptions(objects: readonly CatalogObject[]): Map<string, string> {
  const names = categoryNames(objects);
  const descriptions = new Map<string, string>();
  for (const object of objects) {
    if (!isDrinkItem(object, names)) continue;
    const description = itemDescription(object);
    if (!description) continue;
    for (const variation of object.item_data?.variations ?? []) {
      if (variation.id && !variation.is_deleted) descriptions.set(variation.id, description);
    }
  }
  return descriptions;
}

function itemDescription(object: CatalogObject): string | null {
  const plain = object.item_data?.description_plaintext?.trim();
  if (plain) return plain;
  const description = object.item_data?.description?.trim();
  if (description && !description.includes("<")) return description;
  return null;
}

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** One row per product. Regular and Large both count toward that product. Returns come off the total. */
export function salesFromOrders(
  orders: readonly SquareOrder[],
  allowed: ReadonlySet<string>,
  images: ReadonlyMap<string, string> = new Map(),
  descriptions: ReadonlyMap<string, string> = new Map(),
): DrinkSale[] {
  const sales: DrinkSale[] = [];
  for (const order of orders) {
    const soldAt = order.closed_at || order.created_at;
    if (soldAt) pushLines(sales, order.line_items ?? [], allowed, images, descriptions, soldAt, 1);
    for (const returned of order.returns ?? []) {
      const when = returned.created_at || soldAt;
      if (when) pushLines(sales, returned.return_line_items ?? [], allowed, images, descriptions, when, -1);
    }
  }
  return sales;
}

function pushLines(
  sales: DrinkSale[],
  lines: readonly SquareLine[],
  allowed: ReadonlySet<string>,
  images: ReadonlyMap<string, string>,
  descriptions: ReadonlyMap<string, string>,
  soldAt: string,
  sign: 1 | -1,
): void {
  for (const line of lines) {
    if (line.item_type && line.item_type !== "ITEM") continue;
    const id = line.catalog_object_id;
    const name = line.name?.trim() ?? "";
    const quantity = Number(line.quantity);
    if (!id || !allowed.has(id) || !name || !Number.isFinite(quantity) || quantity <= 0) continue;
    const imageUrl = images.get(id);
    const description = descriptions.get(id);
    sales.push({
      name,
      quantity: sign * quantity,
      soldAt,
      ...(imageUrl ? { imageUrl } : {}),
      ...(description ? { description } : {}),
    });
  }
}

async function fetchSquareDrinkSales(rangeStart: string): Promise<DrinkSale[]> {
  const locationId = process.env.SQUARE_LOCATION_ID?.trim() ?? "";
  const catalog = await listCatalog();
  const orders = await listCompletedOrders(locationId, rangeStart);
  return salesFromOrders(orders, allowedVariationIds(catalog), variationImageUrls(catalog), variationDescriptions(catalog));
}

async function listCatalog(): Promise<CatalogObject[]> {
  const objects: CatalogObject[] = [];
  let cursor = "";
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const params = new URLSearchParams({ types: "CATEGORY,ITEM,IMAGE" });
    if (cursor) params.set("cursor", cursor);
    const data = await squareRequest<{ objects?: CatalogObject[]; cursor?: string }>(`/v2/catalog/list?${params.toString()}`);
    objects.push(...(data.objects ?? []));
    cursor = data.cursor ?? "";
    if (!cursor) break;
  }
  return objects;
}

async function listCompletedOrders(locationId: string, rangeStart: string): Promise<SquareOrder[]> {
  const orders: SquareOrder[] = [];
  let cursor = "";
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const data = await squareRequest<{ orders?: SquareOrder[]; cursor?: string }>("/v2/orders/search", {
      location_ids: [locationId],
      limit: 500,
      cursor: cursor || undefined,
      query: {
        filter: {
          state_filter: { states: ["COMPLETED"] },
          date_time_filter: { closed_at: { start_at: rangeStart } },
        },
      },
    });
    orders.push(...(data.orders ?? []));
    cursor = data.cursor ?? "";
    if (!cursor) break;
  }
  return orders;
}

async function squareRequest<T>(path: string, body?: unknown): Promise<T> {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim() ?? "";
  const response = await fetch(`${SQUARE_ORIGIN}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_VERSION,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Square request failed (${response.status}).`);
  return (await response.json()) as T;
}
