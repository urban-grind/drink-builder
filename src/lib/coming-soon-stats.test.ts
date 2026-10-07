import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import { getDb, resetDbForTests } from "./db";
import { comingSoonStats, recordComingSoonEvent } from "./coming-soon-stats";

const previousDb = process.env.DRINK_DB_PATH;
process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-coming-${process.pid}.sqlite`);

describe("coming soon numbers", () => {
  before(() => {
    resetDbForTests();
  });

  after(() => {
    resetDbForTests();
    if (previousDb === undefined) delete process.env.DRINK_DB_PATH;
    else process.env.DRINK_DB_PATH = previousDb;
  });

  it("counts each visit and each person once", () => {
    const first = randomUUID();
    const second = randomUUID();
    assert.equal(recordComingSoonEvent(first, "visit", "page"), true);
    assert.equal(recordComingSoonEvent(first, "visit", "page"), true);
    assert.equal(recordComingSoonEvent(second, "visit", "ignored"), true);
    const stats = comingSoonStats();
    assert.equal(stats.visitors, 2);
    assert.equal(stats.visits, 2);
    const rows = getDb().prepare("SELECT COUNT(*) AS count FROM coming_soon_events").get() as { count: number };
    assert.equal(Number(rows.count), 2);
  });

  it("counts story taps and ignores anything else", () => {
    const visitor = randomUUID();
    assert.equal(recordComingSoonEvent(visitor, "click", "story"), true);
    assert.equal(recordComingSoonEvent(visitor, "click", "story"), true);
    assert.equal(recordComingSoonEvent(visitor, "click", "other"), false);
    assert.equal(recordComingSoonEvent("not-a-person", "visit", "page"), false);
    assert.equal(comingSoonStats().storyClicks, 1);
  });
});
