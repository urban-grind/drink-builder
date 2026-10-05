import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENTRY_CLOSE_AT, entryCountdownLabel, entryTimeLeft } from "@/lib/entry-countdown";

const DAY = 86400 * 1000;

describe("entry countdown", () => {
  it("closes at midnight Eastern on October 19, 2026", () => {
    assert.equal(new Date(ENTRY_CLOSE_AT).toISOString(), "2026-10-19T04:00:00.000Z");
  });

  it("breaks the time left into days, hours, minutes, and seconds", () => {
    const now = ENTRY_CLOSE_AT - (10 * DAY + 2 * 3600 * 1000 + 23 * 60 * 1000 + 45 * 1000);
    assert.deepEqual(entryTimeLeft(now), { closed: false, days: 10, hours: 2, minutes: 23, seconds: 45 });
  });

  it("stays open through the last second and closes at the deadline", () => {
    assert.equal(entryTimeLeft(ENTRY_CLOSE_AT - 1000).closed, false);
    assert.equal(entryTimeLeft(ENTRY_CLOSE_AT - 1000).seconds, 1);
    assert.equal(entryTimeLeft(ENTRY_CLOSE_AT).closed, true);
    assert.equal(entryCountdownLabel(entryTimeLeft(ENTRY_CLOSE_AT)), "Entries are closed");
  });
});
