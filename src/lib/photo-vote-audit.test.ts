import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import { getDb, resetDbForTests } from "@/lib/db";
import { auditPhotoVotes } from "@/lib/photo-vote-audit";

const previousDb = process.env.DRINK_DB_PATH;
process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-vote-audit-${process.pid}.sqlite`);

function insertEntry() {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO photo_entries (
        id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, public_code
      ) VALUES (?, 'Elena', ?, NULL, 'Latte', '', 'approved', ?, 'image/jpeg', 'vote', 'thumb', ?, ?)`,
    )
    .run(id, `${id}@example.com`, `audit/${id}`, "2026-10-07T15:00:00.000Z", id.replaceAll("-", ""));
  return id;
}

function insertVote(photoId: string, voterId: string, at: string, networkHash: string | null, fromDeck: boolean) {
  getDb()
    .prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at, network_hash) VALUES (?, ?, ?, ?)")
    .run(photoId, voterId, at, networkHash);
  if (!fromDeck) return;
  getDb()
    .prepare("INSERT INTO photo_swipes (voter_id, photo_id, action, created_at) VALUES (?, ?, 'vote', ?)")
    .run(voterId, photoId, at);
}

describe("photo vote audit", () => {
  before(() => {
    resetDbForTests();
  });

  after(() => {
    resetDbForTests();
    if (previousDb === undefined) delete process.env.DRINK_DB_PATH;
    else process.env.DRINK_DB_PATH = previousDb;
  });

  it("groups a photo's votes by network and keeps photo-page votes apart", () => {
    const photoId = insertEntry();
    const otherId = insertEntry();
    const cafe = "hash-cafe";
    const cell = "hash-cell";
    insertVote(photoId, randomUUID(), "2026-10-08T14:00:00.000Z", cafe, true);
    insertVote(photoId, randomUUID(), "2026-10-08T14:10:00.000Z", cafe, true);
    insertVote(photoId, randomUUID(), "2026-10-08T14:20:00.000Z", cafe, true);
    const pageVoter = randomUUID();
    insertVote(photoId, pageVoter, "2026-10-08T14:30:00.000Z", cafe, false);
    insertVote(photoId, randomUUID(), "2026-10-08T15:00:00.000Z", null, true);
    const shared = randomUUID();
    insertVote(photoId, shared, "2026-10-08T16:00:00.000Z", cell, true);
    insertVote(otherId, shared, "2026-10-08T16:05:00.000Z", cell, true);

    const audit = auditPhotoVotes(photoId);
    assert.ok(audit);
    assert.equal(audit.voteCount, 6);
    assert.equal(audit.networkCount, 2);
    assert.equal(audit.missingNetwork, 1);
    assert.equal(audit.fromPhotoPage, 1);
    assert.equal(audit.onlyThisPhoto, 5);
    assert.equal(audit.networks[0]?.label, "Network 1");
    assert.equal(audit.networks[0]?.votes, 4);
    assert.match(audit.networks[0]?.when ?? "", /10:00/);
    assert.match(audit.networks[0]?.when ?? "", /10:30/);
    assert.equal(audit.networks[1]?.label, "No network recorded");
    assert.equal(audit.networks[2]?.label, "Network 2");
    assert.equal(audit.votes[0]?.browserId, shared);
    assert.equal(audit.votes[0]?.page, "Swipe");
    const fromPage = audit.votes.find((vote) => vote.browserId === pageVoter);
    assert.equal(fromPage?.page, "Photo page");
    assert.match(fromPage?.at ?? "", /10:30:00/);
    assert.equal(auditPhotoVotes(randomUUID()), null);
  });
});
