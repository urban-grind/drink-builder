import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { easternDayRange, easternDaySpan } from "@/lib/eastern-day";

describe("eastern day", () => {
  it("runs from midnight Eastern to the next midnight", () => {
    const afternoon = easternDayRange(new Date("2026-10-05T22:00:00.000Z"));
    assert.deepEqual(afternoon, {
      start: "2026-10-05T04:00:00.000Z",
      end: "2026-10-06T04:00:00.000Z",
    });
    const late = easternDayRange(new Date("2026-10-06T03:59:00.000Z"));
    assert.equal(late.start, afternoon.start);
    const nextMorning = easternDayRange(new Date("2026-10-06T04:00:00.000Z"));
    assert.equal(nextMorning.start, "2026-10-06T04:00:00.000Z");
  });

  it("counts each Eastern day a photo has been up, including today", () => {
    const afternoon = new Date("2026-10-05T22:00:00.000Z");
    assert.equal(easternDaySpan(afternoon, new Date("2026-10-06T03:59:00.000Z")), 1);
    assert.equal(easternDaySpan(afternoon, new Date("2026-10-06T04:00:00.000Z")), 2);
    assert.equal(easternDaySpan(afternoon, new Date("2026-10-08T15:00:00.000Z")), 4);
  });
});
