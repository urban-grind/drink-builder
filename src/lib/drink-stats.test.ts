import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { DRINK_BOARD_SIZE, drinkShareLabel, drinkStatsEnabled, drinkStatsRangeStart, drinkUpdatedLabel, rankDrinkSales, type DrinkSale } from "@/lib/drink-stats";

const FLAG = "DRINK_STATS";
const previous = process.env[FLAG];

describe("drink stats", () => {
  after(() => {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  });

  it("says how long ago the café list was pulled", () => {
    const now = Date.parse("2026-10-09T16:00:00.000Z");
    assert.equal(drinkUpdatedLabel(now - 20_000, now), "Updated just now");
    assert.equal(drinkUpdatedLabel(now - 60_000, now), "Updated 1 minute ago");
    assert.equal(drinkUpdatedLabel(now - 6 * 60_000, now), "Updated 6 minutes ago");
    assert.equal(drinkUpdatedLabel(now - 60 * 60_000, now), "Updated 1 hour ago");
    assert.equal(drinkUpdatedLabel(now - 3 * 60 * 60_000, now), "Updated 3 hours ago");
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
    assert.equal(drinkStatsRangeStart(now), "2026-08-01T04:00:00.000Z");
    assert.equal(drinkStatsRangeStart(new Date("2026-10-01T15:00:00.000Z")), "2026-08-01T04:00:00.000Z");
    assert.equal(drinkStatsRangeStart(new Date("2026-01-15T17:00:00.000Z")), "2025-11-01T04:00:00.000Z");
  });

  it("compares today with yesterday up to the same time", () => {
    const now = new Date("2026-10-09T18:00:00.000Z");
    const sales: DrinkSale[] = [
      { name: "Salty Blonde", quantity: 6, soldAt: "2026-10-09T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 3, soldAt: "2026-10-09T15:00:00.000Z" },
      { name: "Mocha", quantity: 1, soldAt: "2026-10-09T14:00:00.000Z" },
      { name: "Cortado", quantity: 1, soldAt: "2026-10-09T14:30:00.000Z" },
      { name: "Tiramisu", quantity: 5, soldAt: "2026-10-08T16:00:00.000Z" },
      { name: "Mocha", quantity: 4, soldAt: "2026-10-08T15:00:00.000Z" },
      { name: "Latte", quantity: 2, soldAt: "2026-10-08T14:00:00.000Z" },
      { name: "Salty Blonde", quantity: 1, soldAt: "2026-10-08T13:00:00.000Z" },
      { name: "Afternoon", quantity: 100, soldAt: "2026-10-08T20:00:00.000Z" },
    ];
    const day = rankDrinkSales(sales, now).day;
    assert.deepEqual(day.find((drink) => drink.name === "Salty Blonde")?.badges, [{ tone: "up", label: "↑ 3 spots" }]);
    assert.deepEqual(day.find((drink) => drink.name === "Tiramisu")?.badges, []);
    assert.deepEqual(day.find((drink) => drink.name === "Cortado")?.badges, [{ tone: "new", label: "New to 3rd place" }]);
    assert.deepEqual(day.find((drink) => drink.name === "Mocha")?.badges, []);
  });

  it("compares equal weeks and months", () => {
    const now = new Date("2026-10-09T18:00:00.000Z");
    const sales: DrinkSale[] = [
      { name: "Salty Blonde", quantity: 6, soldAt: "2026-10-09T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 3, soldAt: "2026-10-09T15:00:00.000Z" },
      { name: "Tiramisu", quantity: 10, soldAt: "2026-10-07T16:00:00.000Z" },
      { name: "Salty Blonde", quantity: 20, soldAt: "2026-10-02T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 8, soldAt: "2026-09-30T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 8, soldAt: "2026-09-03T16:00:00.000Z" },
      { name: "Salty Blonde", quantity: 3, soldAt: "2026-09-04T16:00:00.000Z" },
    ];
    const ranked = rankDrinkSales(sales, now);
    assert.deepEqual(ranked.day.find((drink) => drink.name === "Salty Blonde")?.badges, []);
    assert.deepEqual(ranked.week.find((drink) => drink.name === "Tiramisu")?.badges, []);
    assert.deepEqual(ranked.week.find((drink) => drink.name === "Salty Blonde")?.badges, []);
    assert.deepEqual(ranked.month.find((drink) => drink.name === "Salty Blonde")?.badges, []);
    assert.deepEqual(ranked.month.find((drink) => drink.name === "Tiramisu")?.badges, []);
  });

  it("marks a drink that has held the weekly top spot", () => {
    const now = new Date("2026-10-09T18:00:00.000Z");
    const sales: DrinkSale[] = [
      { name: "Tiramisu", quantity: 10, soldAt: "2026-10-07T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 1, soldAt: "2026-10-09T15:00:00.000Z" },
      { name: "Salty Blonde", quantity: 4, soldAt: "2026-10-09T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 9, soldAt: "2026-09-30T16:00:00.000Z" },
      { name: "Salty Blonde", quantity: 2, soldAt: "2026-10-01T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 8, soldAt: "2026-09-23T16:00:00.000Z" },
      { name: "Latte", quantity: 12, soldAt: "2026-09-16T16:00:00.000Z" },
    ];
    const ranked = rankDrinkSales(sales, now);
    assert.deepEqual(ranked.week[0]?.badges, [{ tone: "streak", label: "3 weeks running" }]);
    assert.deepEqual(ranked.month[0]?.badges, [{ tone: "streak", label: "2 months running" }]);
    assert.deepEqual(ranked.day.find((drink) => drink.name === "Tiramisu")?.badges, []);
  });

  it("marks a drink that has led the last few days", () => {
    const now = new Date("2026-10-09T18:00:00.000Z");
    const sales: DrinkSale[] = [
      { name: "Salty Blonde", quantity: 6, soldAt: "2026-10-09T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 2, soldAt: "2026-10-09T15:00:00.000Z" },
      { name: "Salty Blonde", quantity: 5, soldAt: "2026-10-08T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 3, soldAt: "2026-10-08T15:00:00.000Z" },
      { name: "Salty Blonde", quantity: 4, soldAt: "2026-10-07T16:00:00.000Z" },
      { name: "Mocha", quantity: 1, soldAt: "2026-10-07T15:00:00.000Z" },
      { name: "Tiramisu", quantity: 9, soldAt: "2026-10-06T16:00:00.000Z" },
      { name: "Salty Blonde", quantity: 1, soldAt: "2026-10-06T15:00:00.000Z" },
    ];
    const ranked = rankDrinkSales(sales, now);
    assert.deepEqual(ranked.day[0]?.badges, [{ tone: "streak", label: "3 days running" }]);
    assert.deepEqual(ranked.week[0]?.badges, []);
    assert.deepEqual(ranked.month[0]?.badges, []);
  });

  it("marks a drink that has led the last few months", () => {
    const now = new Date("2026-10-09T18:00:00.000Z");
    const sales: DrinkSale[] = [
      { name: "Salty Blonde", quantity: 10, soldAt: "2026-10-09T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 4, soldAt: "2026-10-09T15:00:00.000Z" },
      { name: "Salty Blonde", quantity: 20, soldAt: "2026-09-15T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 5, soldAt: "2026-09-15T15:00:00.000Z" },
      { name: "Salty Blonde", quantity: 15, soldAt: "2026-08-15T16:00:00.000Z" },
      { name: "Tiramisu", quantity: 9, soldAt: "2026-08-15T15:00:00.000Z" },
      { name: "Tiramisu", quantity: 30, soldAt: "2026-07-15T16:00:00.000Z" },
    ];
    const month = rankDrinkSales(sales, now).month;
    assert.deepEqual(month[0]?.badges, [{ tone: "streak", label: "3 months running" }]);
  });

  it("stays quiet when the earlier period has no sales", () => {
    const now = new Date("2026-10-09T18:00:00.000Z");
    const ranked = rankDrinkSales([{ name: "Latte", quantity: 2, soldAt: "2026-10-09T16:00:00.000Z" }], now);
    assert.deepEqual(ranked.day[0]?.badges, []);
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
