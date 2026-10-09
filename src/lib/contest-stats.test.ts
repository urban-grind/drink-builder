import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import { contestReport, recordContestEvent } from "./contest-stats";
import { getDb, resetDbForTests } from "./db";

const previousDb = process.env.DRINK_DB_PATH;
process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-contest-stats-${process.pid}.sqlite`);

describe("contest visits", () => {
  before(() => {
    resetDbForTests();
  });

  after(() => {
    resetDbForTests();
    if (previousDb === undefined) delete process.env.DRINK_DB_PATH;
    else process.env.DRINK_DB_PATH = previousDb;
  });

  it("counts unique people and total visits, and keeps a signup name", () => {
    const named = randomUUID();
    const quiet = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO draw_entrants (voter_id, person_name, email, phone, created_at)
         VALUES (?, 'Elena', 'elena@example.com', NULL, ?)`,
      )
      .run(named, "2026-10-07T20:00:00.000Z");

    assert.equal(recordContestEvent(named, "visit", "vote"), true);
    assert.equal(recordContestEvent(named, "visit", "vote"), true);
    assert.equal(recordContestEvent(quiet, "visit", "vote"), true);
    assert.equal(recordContestEvent(named, "visit", "leaderboard"), true);
    assert.equal(recordContestEvent(quiet, "visit", "photo"), true);
    assert.equal(recordContestEvent(named, "click", "share-link"), true);
    assert.equal(recordContestEvent(named, "click", "download-story"), true);
    assert.equal(recordContestEvent(named, "click", "download-post"), true);
    assert.equal(recordContestEvent(named, "visit", "popular"), true);
    assert.equal(recordContestEvent(named, "click", "popular-today"), true);
    assert.equal(recordContestEvent(named, "click", "popular-week"), true);
    assert.equal(recordContestEvent(named, "click", "popular-month"), true);
    assert.equal(recordContestEvent(named, "click", "popular-drink:Tiramisu Latte"), true);
    assert.equal(recordContestEvent(named, "click", "popular-order:Tiramisu Latte"), true);
    assert.equal(recordContestEvent(quiet, "click", "popular-order:Salty Blonde Latte"), true);
    assert.equal(recordContestEvent(named, "visit", "faq"), false);
    assert.equal(recordContestEvent(named, "click", "copy"), false);
    assert.equal(recordContestEvent(named, "click", "popular-order:"), false);
    assert.equal(recordContestEvent(named, "click", "popular-today:Latte"), false);
    assert.equal(recordContestEvent(named, "click", `popular-drink:${"x".repeat(81)}`), false);
    assert.equal(recordContestEvent("not-a-person", "visit", "vote"), false);

    const report = contestReport();
    const vote = report.pages.find((page) => page.id === "vote");
    const board = report.pages.find((page) => page.id === "leaderboard");
    const photo = report.pages.find((page) => page.id === "photo");
    assert.equal(vote?.visitors, 2);
    assert.equal(vote?.visits, 2);
    assert.equal(board?.visitors, 1);
    assert.equal(board?.visits, 1);
    assert.equal(photo?.visitors, 1);
    assert.equal(photo?.visits, 1);
    const popular = report.pages.find((page) => page.id === "popular");
    assert.equal(popular?.visitors, 1);
    assert.equal(popular?.visits, 1);
    assert.equal(report.clicks.find((click) => click.id === "share-link")?.count, 1);
    assert.equal(report.clicks.find((click) => click.id === "download-story")?.count, 1);
    assert.equal(report.clicks.find((click) => click.id === "download-post")?.count, 1);
    assert.equal(report.clicks.find((click) => click.id === "popular-today")?.count, 1);
    assert.equal(report.clicks.find((click) => click.id === "popular-week")?.count, 1);
    assert.equal(report.clicks.find((click) => click.id === "popular-month")?.count, 1);
    assert.equal(report.clicks.find((click) => click.id === "popular-drink")?.count, 1);
    assert.equal(report.clicks.find((click) => click.id === "popular-order")?.count, 2);
    assert.deepEqual(report.drinks, [
      { name: "Tiramisu Latte", opens: 1, orders: 1 },
      { name: "Salty Blonde Latte", opens: 0, orders: 1 },
    ]);

    const namedVisit = report.recent.find((visit) => visit.personName === "Elena" && visit.label === "Vote");
    const quietVisit = report.recent.find((visit) => visit.personName === null && visit.label === "Photo pages");
    assert.ok(namedVisit);
    assert.ok(quietVisit);
    assert.equal(report.recent.some((visit) => visit.label === "Share link" && visit.personName === "Elena"), true);
    assert.equal(report.recent.some((visit) => visit.label === "Order · Tiramisu Latte" && visit.personName === "Elena"), true);
    assert.equal(report.recent.some((visit) => visit.label === "Popular" && visit.personName === "Elena"), true);
  });
});
