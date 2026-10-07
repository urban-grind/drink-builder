import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contestClockLabel, contestDaysLeftLabel, contestTimeLeft, VOTING_CLOSES_AT } from "@/lib/contest-clock";

const DAY = 86400 * 1000;

describe("contest clock", () => {
  it("closes at 11:59 p.m. Eastern on October 23, 2026", () => {
    assert.equal(new Date(VOTING_CLOSES_AT).toISOString(), "2026-10-24T03:59:00.000Z");
  });

  it("counts whole days left, then hours and minutes", () => {
    const now = VOTING_CLOSES_AT - (16 * DAY + 9 * 3600 * 1000 + 40 * 60 * 1000);
    assert.deepEqual(contestTimeLeft(now), { closed: false, days: 16, hours: 9, minutes: 40 });
    assert.equal(contestDaysLeftLabel(contestTimeLeft(now)), "16 days left");
  });

  it("says one day left, ends today, then closed", () => {
    const oneDay = contestTimeLeft(VOTING_CLOSES_AT - DAY - 1000);
    assert.equal(oneDay.days, 1);
    assert.equal(contestDaysLeftLabel(oneDay), "1 day left");
    const today = contestTimeLeft(VOTING_CLOSES_AT - 2 * 3600 * 1000);
    assert.equal(today.days, 0);
    assert.equal(today.closed, false);
    assert.equal(contestDaysLeftLabel(today), "Ends today");
    const closed = contestTimeLeft(VOTING_CLOSES_AT);
    assert.equal(closed.closed, true);
    assert.equal(contestDaysLeftLabel(closed), "Closed");
    assert.equal(contestClockLabel(closed), "Voting has closed");
  });
});
