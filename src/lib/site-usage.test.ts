import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSiteUsage, orderPathSummary, type UsageEvent } from "./site-usage";

const NOW = new Date("2026-10-09T17:00:00.000Z");

function event(partial: Partial<UsageEvent> & Pick<UsageEvent, "visitorId" | "kind" | "name" | "at">): UsageEvent {
  return { personName: null, ...partial };
}

describe("site usage", () => {
  it("counts people who open Popular, then a drink, then Order", () => {
    const usage = buildSiteUsage(
      [
        event({ visitorId: "a", kind: "visit", name: "popular", at: "2026-10-09T15:00:00.000Z", personName: "Elena" }),
        event({ visitorId: "a", kind: "click", name: "popular-drink:Salty Blonde Latte", at: "2026-10-09T15:01:00.000Z" }),
        event({ visitorId: "a", kind: "click", name: "popular-order:Salty Blonde Latte", at: "2026-10-09T15:02:00.000Z" }),
        event({ visitorId: "b", kind: "visit", name: "popular", at: "2026-10-09T15:03:00.000Z" }),
        event({ visitorId: "b", kind: "click", name: "popular-drink:Tiramisu Latte", at: "2026-10-09T15:04:00.000Z" }),
        event({ visitorId: "c", kind: "visit", name: "popular", at: "2026-10-09T15:05:00.000Z" }),
        event({ visitorId: "d", kind: "click", name: "popular-order:Latte", at: "2026-10-09T15:06:00.000Z" }),
        event({ visitorId: "e", kind: "visit", name: "popular", at: "2026-10-09T16:00:00.000Z" }),
        event({ visitorId: "e", kind: "click", name: "popular-order:Latte", at: "2026-10-09T16:01:00.000Z" }),
        event({ visitorId: "e", kind: "click", name: "popular-drink:Latte", at: "2026-10-09T16:02:00.000Z" }),
      ],
      NOW,
    );

    assert.deepEqual(usage.all.funnel, { popular: 4, openedDrink: 3, ordered: 1 });
    assert.equal(
      orderPathSummary(usage.all.funnel),
      "1 person left to order. 2 people opened a drink and stopped there. 1 person opened Popular and left without a drink.",
    );
    assert.deepEqual(usage.all.drinks, [
      { name: "Latte", opens: 1, orders: 2 },
      { name: "Salty Blonde Latte", opens: 1, orders: 1 },
      { name: "Tiramisu Latte", opens: 1, orders: 0 },
    ]);
    assert.equal(usage.all.paths[0]?.trail.at(-1), "Opened Latte");
    assert.deepEqual(usage.all.paths.find((path) => path.personName === "Elena")?.trail, [
      "Popular",
      "Opened Salty Blonde Latte",
      "Ordered Salty Blonde Latte",
    ]);
  });

  it("keeps yesterday in the contest total and out of today", () => {
    const usage = buildSiteUsage(
      [
        event({ visitorId: "a", kind: "visit", name: "popular", at: "2026-10-08T15:00:00.000Z" }),
        event({ visitorId: "a", kind: "click", name: "popular-drink:Latte", at: "2026-10-08T15:01:00.000Z" }),
        event({ visitorId: "a", kind: "click", name: "popular-order:Latte", at: "2026-10-08T15:02:00.000Z" }),
        event({ visitorId: "b", kind: "visit", name: "vote", at: "2026-10-09T15:00:00.000Z" }),
        event({ visitorId: "b", kind: "visit", name: "vote", at: "2026-10-09T15:05:00.000Z" }),
        event({ visitorId: "b", kind: "visit", name: "leaderboard", at: "2026-10-09T15:06:00.000Z" }),
        event({ visitorId: "b", kind: "click", name: "share-link", at: "2026-10-09T15:07:00.000Z" }),
        event({ visitorId: "b", kind: "click", name: "popular-week", at: "2026-10-09T15:08:00.000Z" }),
      ],
      NOW,
    );

    assert.deepEqual(usage.today.funnel, { popular: 0, openedDrink: 0, ordered: 0 });
    assert.deepEqual(usage.all.funnel, { popular: 1, openedDrink: 1, ordered: 1 });
    assert.deepEqual(usage.today.places.vote, { people: 1, visits: 2 });
    assert.deepEqual(usage.today.places.leaderboard, { people: 1, visits: 1 });
    assert.equal(usage.today.shares.link, 1);
    assert.equal(usage.today.ranges.week, 1);
    assert.deepEqual(usage.today.paths[0]?.trail, ["Popular this week"]);
    assert.deepEqual(usage.today.paths[0]?.also, [
      { label: "Vote", count: 2 },
      { label: "Leaderboard", count: 1 },
      { label: "Shared a link", count: 1 },
    ]);
  });
});
