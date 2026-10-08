import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import { getDb, resetDbForTests } from "./db";
import { claimDrawEntrant, countDrawSwipes, drawEntrantKnown, drawEntrantProfile, saveDrawEntrant } from "./draw-entry";
import { DRAW_ASK_EVERY, nextDrawAsk, shouldAskDraw } from "./draw-prompt";

const previousDb = process.env.DRINK_DB_PATH;
process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-draw-${process.pid}.sqlite`);

function insertEntry(input: {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  createdAt?: string;
}) {
  const id = input.id ?? randomUUID();
  getDb()
    .prepare(
      `INSERT INTO photo_entries (
        id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, public_code
      ) VALUES (?, ?, ?, ?, 'Latte', '', ?, ?, 'image/jpeg', 'vote', 'thumb', ?, ?)`,
    )
    .run(
      id,
      input.name ?? "Elena",
      input.email === undefined ? "elena@example.com" : input.email,
      input.phone === undefined ? null : input.phone,
      input.status ?? "approved",
      `draw/${id}`,
      input.createdAt ?? "2026-10-07T15:00:00.000Z",
      id.replaceAll("-", ""),
    );
  return id;
}

function insertSwipe(voterId: string, photoId: string) {
  getDb()
    .prepare("INSERT OR IGNORE INTO photo_swipes (voter_id, photo_id, action, created_at) VALUES (?, ?, 'skip', ?)")
    .run(voterId, photoId, new Date().toISOString());
}

describe("draw prompt", () => {
  it("asks on the fifth swipe, then five later if they close it", () => {
    assert.equal(shouldAskDraw(4, false, DRAW_ASK_EVERY), false);
    assert.equal(shouldAskDraw(5, false, DRAW_ASK_EVERY), true);
    assert.equal(shouldAskDraw(5, true, DRAW_ASK_EVERY), false);
    assert.equal(nextDrawAsk(5), 10);
    assert.equal(shouldAskDraw(9, false, 10), false);
    assert.equal(shouldAskDraw(10, false, 10), true);
  });
});

describe("draw entrants", () => {
  before(() => {
    resetDbForTests();
  });

  after(() => {
    resetDbForTests();
    if (previousDb === undefined) delete process.env.DRINK_DB_PATH;
    else process.env.DRINK_DB_PATH = previousDb;
  });

  it("saves a name with an email or a phone and keeps the first identity", () => {
    const voterId = randomUUID();
    const saved = saveDrawEntrant(voterId, { personName: " Elena ", email: "Elena@Example.com", phone: "" });
    assert.equal(saved.ok, true);
    assert.equal(drawEntrantKnown(voterId), true);
    const again = saveDrawEntrant(voterId, { personName: "Someone else", phone: "7055550199" });
    assert.equal(again.ok, true);
    const row = getDb().prepare("SELECT person_name, email, phone FROM draw_entrants WHERE voter_id = ?").get(voterId) as {
      person_name: string;
      email: string | null;
      phone: string | null;
    };
    assert.equal(row.person_name, "Elena");
    assert.equal(row.email, "elena@example.com");
    assert.equal(row.phone, null);
    assert.deepEqual(drawEntrantProfile(voterId), { personName: "Elena", contact: "elena@example.com" });
    assert.equal(drawEntrantProfile(randomUUID()), null);
  });

  it("returns a saved phone in the form people already type", () => {
    const voterId = randomUUID();
    const saved = saveDrawEntrant(voterId, { personName: "Sam", phone: "705-555-0199" });
    assert.equal(saved.ok, true);
    assert.deepEqual(drawEntrantProfile(voterId), { personName: "Sam", contact: "(705) 555-0199" });
  });

  it("rejects a missing name or contact", () => {
    const missing = saveDrawEntrant(randomUUID(), { personName: "", email: "", phone: "" });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.fields.personName, "Add your name.");
      assert.ok(missing.fields.contact);
    }
  });

  it("claims the newest photo from this phone and skips the prompt", () => {
    const voterId = randomUUID();
    const older = insertEntry({
      name: "Older",
      email: "older@example.com",
      createdAt: "2026-10-01T15:00:00.000Z",
    });
    const newer = insertEntry({
      name: "Newer",
      phone: "7055550199",
      email: null,
      createdAt: "2026-10-06T15:00:00.000Z",
    });
    const blank = insertEntry({ name: "Nope", email: null, phone: null, createdAt: "2026-10-07T15:00:00.000Z" });
    assert.equal(claimDrawEntrant(voterId, [older, blank]), true);
    const first = getDb().prepare("SELECT person_name, email FROM draw_entrants WHERE voter_id = ?").get(voterId) as {
      person_name: string;
      email: string | null;
    };
    assert.equal(first.person_name, "Older");
    assert.equal(first.email, "older@example.com");
    assert.equal(claimDrawEntrant(voterId, [newer]), true);
    const stuck = getDb().prepare("SELECT person_name FROM draw_entrants WHERE voter_id = ?").get(voterId) as {
      person_name: string;
    };
    assert.equal(stuck.person_name, "Older");
  });

  it("counts each swipe once and drops it when the swipe is removed", () => {
    const voterId = randomUUID();
    const photoId = insertEntry({ email: null, phone: "7055550100" });
    assert.equal(countDrawSwipes(voterId), 0);
    insertSwipe(voterId, photoId);
    insertSwipe(voterId, photoId);
    assert.equal(countDrawSwipes(voterId), 1);
    getDb().prepare("DELETE FROM photo_swipes WHERE voter_id = ? AND photo_id = ?").run(voterId, photoId);
    assert.equal(countDrawSwipes(voterId), 0);
    assert.equal(claimDrawEntrant(voterId, []), false);
  });
});
