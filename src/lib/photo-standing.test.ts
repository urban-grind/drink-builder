import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ownerPaceLine } from "@/lib/photo-standing";

describe("owner pace", () => {
  it("shows today, then the daily pace after the first day", () => {
    assert.equal(ownerPaceLine({ voteCount: 0, votesToday: 0, daysLive: 3 }), null);
    assert.equal(ownerPaceLine({ voteCount: 4, votesToday: 4, daysLive: 1 }), "4 today");
    assert.equal(ownerPaceLine({ voteCount: 12, votesToday: 3, daysLive: 4 }), "3 today · about 3 a day");
    assert.equal(ownerPaceLine({ voteCount: 2, votesToday: 0, daysLive: 5 }), "0 today · about 0.4 a day");
    assert.equal(ownerPaceLine({ voteCount: 25, votesToday: 1, daysLive: 3 }), "1 today · about 8.3 a day");
    assert.equal(ownerPaceLine({ voteCount: 30, votesToday: 2, daysLive: 3 }), "2 today · about 10 a day");
  });
});
