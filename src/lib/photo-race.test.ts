import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import { getDb, resetDbForTests } from "@/lib/db";
import { CONTEST_OPENS_AT, awakeDuration, displayHour, follow, momentAt, playheadAt, raceMoment, raceTicks, standingsAt } from "@/lib/photo-race";
import { loadVoteRace } from "@/lib/photo-race-load";

const previousDb = process.env.DRINK_DB_PATH;
process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-photo-race-${process.pid}.sqlite`);

function at(minute: number): string {
  return `2026-10-08T14:${String(minute).padStart(2, "0")}:00.000Z`;
}

function insertEntry(status: string, name: string) {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO photo_entries (
        id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, public_code
      ) VALUES (?, ?, ?, NULL, 'Latte', '', ?, ?, 'image/jpeg', 'vote', 'thumb', ?, ?)`,
    )
    .run(id, name, `${id}@example.com`, status, `race/${id}`, "2026-10-07T15:00:00.000Z", id.replaceAll("-", ""));
  return id;
}

function insertVote(photoId: string, when: string) {
  getDb()
    .prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at, network_hash) VALUES (?, ?, ?, NULL)")
    .run(photoId, randomUUID(), when);
}

describe("photo race", () => {
  before(() => {
    resetDbForTests();
  });

  after(() => {
    resetDbForTests();
    if (previousDb === undefined) delete process.env.DRINK_DB_PATH;
    else process.env.DRINK_DB_PATH = previousDb;
  });

  it("keeps the person who reached a tie first, then lets a new vote take the lead", () => {
    const votes = [
      { photoId: "a", at: at(0) },
      { photoId: "b", at: at(1) },
      { photoId: "b", at: at(2) },
    ];
    const tied = standingsAt(votes, Date.parse(at(1)));
    assert.deepEqual(
      tied.map((row) => row.id),
      ["a", "b"],
    );
    const passed = standingsAt(votes, Date.parse(at(2)));
    assert.equal(passed[0]?.id, "b");
    assert.equal(passed[0]?.votes, 2);
    assert.equal(passed[1]?.id, "a");
  });

  it("ticks the score up by one and parks the clock on 5-second marks", () => {
    const votes = [
      { photoId: "a", at: "2026-10-08T14:00:01.000Z" },
      { photoId: "a", at: "2026-10-08T14:00:04.000Z" },
      { photoId: "a", at: "2026-10-08T14:00:09.000Z" },
    ];
    const ticks = raceTicks(votes);
    assert.deepEqual(
      ticks.map((tick) => tick.rows[0]?.votes),
      [1, 2, 3],
    );
    assert.equal(ticks[0]?.atMs, Date.parse("2026-10-08T14:00:00.000Z"));
    assert.equal(ticks[2]?.atMs, Date.parse("2026-10-08T14:00:05.000Z"));
    const mid = raceMoment(votes, 1.5 / 3);
    assert.ok((mid.rows[0]?.votes ?? 0) > 1 && (mid.rows[0]?.votes ?? 0) < 2);
    const end = raceMoment(votes, 1);
    assert.equal(end.rows[0]?.votes, 3);
  });

  it("grows a bar part of the way toward its total", () => {
    const once = follow(0, 10, 0.45, 0.9);
    assert.ok(once > 2 && once < 8);
    const twice = follow(once, 10, 0.45, 0.9);
    assert.ok(twice > once && twice < 10);
  });

  it("slides a passer into the lead while the score is still growing", () => {
    const votes = [
      { photoId: "a", at: at(0) },
      { photoId: "b", at: at(1) },
      { photoId: "b", at: at(2) },
    ];
    const mid = raceMoment(votes, 2.5 / 3);
    const passer = mid.rows.find((row) => row.id === "b");
    const leader = mid.rows.find((row) => row.id === "a");
    assert.ok(passer && leader);
    assert.ok(passer.votes > 1 && passer.votes < 2);
    assert.equal(leader.votes, 1);
    assert.ok(passer.place > 0 && passer.place < 1);
    assert.ok(leader.place > 0 && leader.place < 1);
    const end = raceMoment(votes, 1);
    assert.equal(end.rows[0]?.id, "b");
    assert.equal(end.rows[0]?.place, 0);
    assert.equal(end.rows[0]?.votes, 2);
  });

  it("shows eight racers and drops the one who arrived last", () => {
    const votes = Array.from({ length: 9 }, (_, index) => ({ photoId: `p${index}`, at: at(index) }));
    const frame = standingsAt(votes, Date.parse(at(8)));
    assert.equal(frame.length, 8);
    assert.equal(frame.some((row) => row.id === "p8"), false);
    const surge = standingsAt([...votes, { photoId: "p8", at: at(9) }], Date.parse(at(9)));
    assert.equal(surge[0]?.id, "p8");
    assert.equal(surge[0]?.votes, 2);
  });

  it("loads approved photos only, oldest vote first", () => {
    const leader = insertEntry("approved", "Maya");
    const waiting = insertEntry("pending", "Jonah");
    insertVote(leader, "2026-08-01T12:00:00.000Z");
    insertVote(leader, at(1));
    insertVote(waiting, at(0));
    insertVote(leader, at(3));

    const race = loadVoteRace();
    const maya = race.photos.find((photo) => photo.id === leader);
    assert.ok(maya);
    assert.equal(maya.personName, "Maya");
    assert.equal(maya.thumbUrl, `/api/photos/${leader}/image?variant=thumb`);
    assert.equal(
      race.photos.some((photo) => photo.id === waiting),
      false,
    );
    assert.deepEqual(
      race.votes.filter((vote) => vote.photoId === leader).map((vote) => vote.at),
      [at(1), at(3)],
    );
    assert.equal(
      race.votes.some((vote) => vote.photoId === waiting),
      false,
    );
    assert.equal(
      race.votes.some((vote) => vote.at.startsWith("2026-08-01")),
      false,
    );
    assert.equal(race.from, new Date(CONTEST_OPENS_AT).toISOString());
  });

  it("starts at 7 p.m. Eastern and shows the hour while counting the exact second", () => {
    assert.equal(new Date(CONTEST_OPENS_AT).toISOString(), "2026-10-07T23:00:00.000Z");
    const votes = [
      { photoId: "a", at: "2026-10-07T23:30:12.000Z" },
      { photoId: "a", at: "2026-10-08T15:00:00.000Z" },
    ];
    const open = momentAt(votes, CONTEST_OPENS_AT);
    assert.equal(open.rows.length, 0);
    assert.equal(momentAt(votes, Date.parse("2026-10-07T23:30:12.000Z")).rows[0]?.votes, 1);
    const during = Date.parse("2026-10-07T23:33:12.000Z");
    assert.equal(displayHour(during), Date.parse("2026-10-07T23:00:00.000Z"));
    assert.equal(displayHour(during + 27 * 60 * 1000), Date.parse("2026-10-08T00:00:00.000Z"));
    assert.equal(momentAt(votes, Date.parse("2026-10-08T16:00:00.000Z")).rows[0]?.votes, 2);
  });

  it("skips 11 p.m. to 5 a.m. Eastern and still counts that night at 5", () => {
    const from = CONTEST_OPENS_AT;
    const to = Date.parse("2026-10-08T20:00:00-04:00");
    const eleven = Date.parse("2026-10-08T03:00:00.000Z");
    const five = Date.parse("2026-10-08T09:00:00.000Z");
    const awake = eleven - from + (to - five);
    assert.equal(awakeDuration(from, to), awake);
    assert.equal(playheadAt(from, to, 0), from);
    assert.equal(playheadAt(from, to, (eleven - from) / awake), five);
    const evening = playheadAt(from, to, (eleven - from - 30_000) / awake);
    assert.ok(evening >= eleven - 30_000 && evening < eleven);
    assert.equal(playheadAt(from, to, 90_000 / awake), from + 90_000);
    assert.equal(playheadAt(from, to, 1), to);

    const overnight = [{ photoId: "a", at: "2026-10-08T06:30:00.000Z" }];
    assert.equal(momentAt(overnight, eleven).rows.length, 0);
    assert.equal(momentAt(overnight, five).rows[0]?.votes, 1);
  });
});
