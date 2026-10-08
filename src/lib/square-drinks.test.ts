import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowedVariationIds, normalizeCategory, salesFromOrders, variationImageUrls } from "@/lib/square-drinks";
import { rankDrinkSales } from "@/lib/drink-stats";

describe("square drinks", () => {
  it("keeps drink categories and treats a hyphen like a space", () => {
    assert.equal(normalizeCategory("Coffee-Based Beverages"), "coffee based beverages");
    assert.equal(normalizeCategory("Kids' Drinks"), "kids drinks");
    const allowed = allowedVariationIds([
      { type: "CATEGORY", id: "coffee", category_data: { name: "Coffee-Based Beverages" } },
      { type: "CATEGORY", id: "baked", category_data: { name: "Baked Goods" } },
      {
        type: "ITEM",
        id: "latte",
        item_data: {
          category_id: "coffee",
          variations: [
            { id: "regular", is_deleted: false },
            { id: "large", is_deleted: false },
          ],
        },
      },
      {
        type: "ITEM",
        id: "cookie",
        item_data: { categories: [{ id: "baked" }], variations: [{ id: "cookie-single" }] },
      },
    ]);
    assert.deepEqual([...allowed].sort(), ["large", "regular"]);
    const images = variationImageUrls([
      { type: "CATEGORY", id: "coffee", category_data: { name: "Coffee Based Beverages" } },
      { type: "CATEGORY", id: "baked", category_data: { name: "Baked Goods" } },
      { type: "IMAGE", id: "latte-photo", image_data: { url: "https://cdn.example/latte.jpg" } },
      { type: "IMAGE", id: "bad-photo", image_data: { url: "http://cdn.example/latte.jpg" } },
      {
        type: "ITEM",
        id: "latte",
        item_data: {
          category_id: "coffee",
          image_ids: ["latte-photo"],
          variations: [
            { id: "regular", is_deleted: false },
            { id: "large", is_deleted: false },
          ],
        },
      },
      {
        type: "ITEM",
        id: "cookie",
        item_data: { categories: [{ id: "baked" }], image_ids: ["latte-photo"], variations: [{ id: "cookie-single" }] },
      },
      {
        type: "ITEM",
        id: "tea",
        item_data: { category_id: "coffee", image_ids: ["bad-photo"], variations: [{ id: "tea-regular" }] },
      },
    ]);
    assert.equal(images.get("regular"), "https://cdn.example/latte.jpg");
    assert.equal(images.get("large"), "https://cdn.example/latte.jpg");
    assert.equal(images.has("cookie-single"), false);
    assert.equal(images.has("tea-regular"), false);
  });

  it("counts each size toward the product and removes a return", () => {
    const allowed = new Set(["regular", "large"]);
    const sales = salesFromOrders(
      [
        {
          closed_at: "2026-10-08T15:00:00.000Z",
          line_items: [
            { name: "Salty Blonde Latte", quantity: "1", catalog_object_id: "regular", item_type: "ITEM" },
            { name: "Salty Blonde Latte", quantity: "2", catalog_object_id: "large", item_type: "ITEM" },
            { name: "Cookie", quantity: "1", catalog_object_id: "cookie-single", item_type: "ITEM" },
          ],
          returns: [
            {
              created_at: "2026-10-08T18:00:00.000Z",
              return_line_items: [{ name: "Salty Blonde Latte", quantity: "1", catalog_object_id: "regular", item_type: "ITEM" }],
            },
          ],
        },
      ],
      allowed,
      new Map([["large", "https://cdn.example/latte.jpg"]]),
    );
    const ranked = rankDrinkSales(sales, new Date("2026-10-08T19:00:00.000Z"));
    assert.equal(ranked.day[0]?.name, "Salty Blonde Latte");
    assert.equal(ranked.day[0]?.quantity, 2);
    assert.equal(ranked.day[0]?.share, 100);
    assert.equal(ranked.day[0]?.imageUrl, "https://cdn.example/latte.jpg");
  });
});
