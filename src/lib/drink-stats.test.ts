import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { DRINK_BOARD_SIZE, drinkShareLabel, drinkStatsEnabled, drinkStatsRangeStart, rankDrinkSales, type DrinkSale } from "@/lib/drink-stats";

const FLAG = "DRINK_STATS";
const previous = process.env[FLAG];

describe("drink stats", () => {
  after(() => {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  });

  it("stays hidden unless the switch is on", () => {
    delete process.env[FLAG];
    assert.equal(drinkStatsEnabled(), false);
    process.env[FLAG] = "";
    assert.equal(drinkStatsEnabled(), false);
    process.env[FLAG] = "0";
    assert.equal(drinkStatsEnabled(), false);
    for (const value of ["1", "true", "yes"]) {
      process.env[FLAG] = value;
      assert.equal(drinkStatsEnabled(), true);
    }
  });

  it("ranks today, this week, and this month in Eastern time", () => {
    const now = new Date("2026-10-08T19:00:00.000Z");
    const sales: DrinkSale[] = [
      { name: "latte", quantity: 2, soldAt: "2026-10-08T13:00:00.000Z" },
      { name: "Latte", quantity: 4, soldAt: "2026-10-08T04:30:00.000Z" },
      { name: "Mocha", quantity: 3, soldAt: "2026-10-08T03:30:00.000Z" },
      { name: "Mocha", quantity: 1, soldAt: "2026-10-05T14:00:00.000Z" },
      { name: "Tea", quantity: 8, soldAt: "2026-10-04T14:00:00.000Z" },
      { name: "Cider", quantity: 5, soldAt: "2026-09-30T16:00:00.000Z" },
      { name: " ", quantity: 9, soldAt: "2026-10-08T15:00:00.000Z" },
    ];
    const ranked = rankDrinkSales(sales, now);
    assert.deepEqual(snapshot(ranked.day), [["Latte", 6, 100, null]]);
    assert.deepEqual(snapshot(ranked.week), [
      ["Latte", 6, 60, null],
      ["Mocha", 4, 40, null],
    ]);
    assert.deepEqual(snapshot(ranked.month), [
      ["Tea", 8, 44, null],
      ["Latte", 6, 33, null],
      ["Mocha", 4, 22, null],
    ]);
    assert.deepEqual(snapshot(ranked.drinks), [
      ["Tea", 8, 35, null],
      ["Latte", 6, 26, null],
      ["Cider", 5, 22, null],
      ["Mocha", 4, 17, null],
    ]);
    assert.equal(drinkStatsRangeStart(now), "2026-10-01T04:00:00.000Z");
    assert.equal(drinkStatsRangeStart(new Date("2026-10-01T15:00:00.000Z")), "2026-09-28T04:00:00.000Z");
  });

  it("keeps the top 10 and measures each share against every drink sold", () => {
    const now = new Date("2026-10-08T19:00:00.000Z");
    const sales: DrinkSale[] = Array.from({ length: 12 }, (_, index) => ({
      name: `Drink ${String(index + 1).padStart(2, "0")}`,
      quantity: 12 - index,
      soldAt: "2026-10-08T15:00:00.000Z",
      imageUrl: index === 0 ? "https://cdn.example/one.jpg" : undefined,
    }));
    const day = rankDrinkSales(sales, now).day;
    assert.equal(day.length, DRINK_BOARD_SIZE);
    assert.equal(day[0]?.name, "Drink 01");
    assert.equal(day[0]?.imageUrl, "https://cdn.example/one.jpg");
    assert.equal(day.some((drink) => drink.name === "Drink 12"), false);
    const sold = (12 * 13) / 2;
    assert.equal(Math.round(day[0]?.share ?? 0), Math.round((12 / sold) * 100));
    assert.equal(drinkShareLabel(0), "0%");
    assert.equal(drinkShareLabel(0.4), "<1%");
    assert.equal(drinkShareLabel(18.6), "19%");
    assert.equal(drinkShareLabel(100), "100%");
  });
});

function snapshot(drinks: { name: string; quantity: number; share: number; imageUrl: string | null }[]) {
  return drinks.map((drink) => [drink.name, drink.quantity, Math.round(drink.share), drink.imageUrl]);
}
