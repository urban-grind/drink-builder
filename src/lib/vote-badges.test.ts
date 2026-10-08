import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VOTE_BADGES, badgeEarned } from "@/lib/vote-badges";

describe("vote badges", () => {
  it("turns each badge on at its vote count", () => {
    assert.deepEqual(
      VOTE_BADGES.map((badge) => badge.votes),
      [50, 100, 250, 500],
    );
    assert.deepEqual(
      VOTE_BADGES.map((badge) => badgeEarned(49, badge.votes)),
      [false, false, false, false],
    );
    assert.deepEqual(
      VOTE_BADGES.map((badge) => badgeEarned(100, badge.votes)),
      [true, true, false, false],
    );
    assert.equal(badgeEarned(500, 500), true);
  });
});
