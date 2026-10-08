import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import { getDb, resetDbForTests } from "./db";
import { listPeople } from "./people";

const previousDb = process.env.DRINK_DB_PATH;
process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-people-${process.pid}.sqlite`);

function insertPhoto(input: { name: string; email?: string | null; phone?: string | null; at: string; sample?: boolean }) {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO photo_entries (
        id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, public_code
      ) VALUES (?, ?, ?, ?, 'Latte', '', 'approved', ?, 'image/jpeg', 'vote', 'thumb', ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.sample ? `local-sample/${id}` : `photos/${id}`,
      input.at,
      id.replaceAll("-", "").slice(0, 12),
    );
  return id;
}

function insertSwipe(voterId: string, photoId: string) {
  getDb()
    .prepare("INSERT INTO photo_swipes (voter_id, photo_id, action, created_at) VALUES (?, ?, 'skip', ?)")
    .run(voterId, photoId, "2026-10-08T12:00:00.000Z");
}

describe("people list", () => {
  before(() => {
    resetDbForTests();
  });

  after(() => {
    resetDbForTests();
    if (previousDb === undefined) delete process.env.DRINK_DB_PATH;
    else process.env.DRINK_DB_PATH = previousDb;
  });

  it("joins a photo and a draw signup that share an email, and keeps a phone signup separate", () => {
    const firstPhoto = insertPhoto({ name: "Elena", email: "elena@example.com", at: "2026-10-07T15:00:00.000Z" });
    const secondPhoto = insertPhoto({ name: "Elena V.", email: "elena@example.com", at: "2026-10-08T15:00:00.000Z" });
    insertPhoto({ name: "Sample", email: "sample@preview.invalid", at: "2026-10-01T15:00:00.000Z", sample: true });
    const voterId = randomUUID();
    const otherPhone = randomUUID();
    getDb()
      .prepare("INSERT INTO draw_entrants (voter_id, person_name, email, phone, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(voterId, "Elena M.", "elena@example.com", null, "2026-10-09T15:00:00.000Z");
    getDb()
      .prepare("INSERT INTO draw_entrants (voter_id, person_name, email, phone, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(otherPhone, "Elena M.", "elena@example.com", null, "2026-10-09T16:00:00.000Z");
    const jonahId = randomUUID();
    getDb()
      .prepare("INSERT INTO draw_entrants (voter_id, person_name, email, phone, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(jonahId, "Jonah", null, "7055550199", "2026-10-06T15:00:00.000Z");
    insertSwipe(voterId, firstPhoto);
    insertSwipe(voterId, secondPhoto);
    insertSwipe(otherPhone, firstPhoto);

    const people = listPeople();
    assert.equal(people.length, 2);
    assert.deepEqual(people[0], {
      name: "Elena M.",
      email: "elena@example.com",
      phone: null,
      photoCount: 2,
      swipeCount: 3,
      inDraw: true,
      signedUpAt: "2026-10-07T15:00:00.000Z",
    });
    assert.deepEqual(people[1], {
      name: "Jonah",
      email: null,
      phone: "7055550199",
      photoCount: 0,
      swipeCount: 0,
      inDraw: true,
      signedUpAt: "2026-10-06T15:00:00.000Z",
    });
  });
});
