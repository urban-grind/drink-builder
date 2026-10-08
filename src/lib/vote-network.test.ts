import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import { POST as deckPost } from "@/app/api/photos/deck/route";
import { POST as votePost } from "@/app/api/photos/[id]/vote/route";
import { getDb, resetDbForTests } from "@/lib/db";
import { castPhotoVote, swipeDeckPhoto, undoDeckSwipe } from "@/lib/photos";
import {
  NETWORK_VOTE_LIMIT_MESSAGE,
  NETWORK_VOTE_WINDOW_MS,
  NETWORK_VOTES_PER_PHOTO,
  clientNetworkAddress,
  hashNetwork,
} from "@/lib/vote-network";

const previousDb = process.env.DRINK_DB_PATH;
process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-network-${process.pid}.sqlite`);

const cafe = hashNetwork("203.0.113.10");
const cell = hashNetwork("198.51.100.20");

function insertEntry() {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO photo_entries (
        id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, public_code
      ) VALUES (?, 'Elena', ?, NULL, 'Latte', '', 'approved', ?, 'image/jpeg', 'vote', 'thumb', ?, ?)`,
    )
    .run(id, `${id}@example.com`, `network/${id}`, "2026-10-07T15:00:00.000Z", id.replaceAll("-", ""));
  return id;
}

function voteCount(photoId: string) {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM photo_votes WHERE photo_id = ?").get(photoId) as {
    count: number;
  };
  return Number(row.count);
}

describe("network address", () => {
  it("keeps the last public address and ignores a spoofed one", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.10, 10.0.0.4" });
    assert.equal(clientNetworkAddress(headers), "203.0.113.10");
    assert.equal(clientNetworkAddress(new Headers({ "x-real-ip": "198.51.100.8" })), "198.51.100.8");
    assert.equal(clientNetworkAddress(new Headers({ "x-forwarded-for": "192.168.1.9" })), null);
    assert.equal(clientNetworkAddress(new Headers()), null);
    assert.equal(hashNetwork("203.0.113.10") === hashNetwork("198.51.100.8"), false);
  });
});

describe("votes from one network", () => {
  before(() => {
    resetDbForTests();
  });

  after(() => {
    resetDbForTests();
    if (previousDb === undefined) delete process.env.DRINK_DB_PATH;
    else process.env.DRINK_DB_PATH = previousDb;
  });

  it("allows three votes on a photo every ten minutes, then waits", () => {
    const photoId = insertEntry();
    for (let index = 0; index < NETWORK_VOTES_PER_PHOTO; index += 1) {
      const saved = swipeDeckPhoto(photoId, randomUUID(), "vote", cafe);
      assert.equal(saved.ok, true);
    }
    const blocked = swipeDeckPhoto(photoId, randomUUID(), "vote", cafe);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, "NETWORK_LIMIT");
    assert.equal(voteCount(photoId), NETWORK_VOTES_PER_PHOTO);

    const otherPhoto = insertEntry();
    assert.equal(swipeDeckPhoto(otherPhoto, randomUUID(), "vote", cafe).ok, true);
    assert.equal(swipeDeckPhoto(photoId, randomUUID(), "vote", cell).ok, true);
    assert.equal(voteCount(photoId), NETWORK_VOTES_PER_PHOTO + 1);
  });

  it("does not count a skip or a vote from outside the ten-minute window", () => {
    const photoId = insertEntry();
    for (let index = 0; index < NETWORK_VOTES_PER_PHOTO; index += 1) {
      assert.equal(swipeDeckPhoto(photoId, randomUUID(), "skip", cafe).ok, true);
    }
    assert.equal(swipeDeckPhoto(photoId, randomUUID(), "vote", cafe).ok, true);

    const aged = insertEntry();
    const old = new Date(Date.now() - NETWORK_VOTE_WINDOW_MS - 60_000).toISOString();
    for (let index = 0; index < NETWORK_VOTES_PER_PHOTO; index += 1) {
      const voterId = randomUUID();
      getDb()
        .prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at, network_hash) VALUES (?, ?, ?, ?)")
        .run(aged, voterId, old, cafe);
    }
    assert.equal(swipeDeckPhoto(aged, randomUUID(), "vote", cafe).ok, true);

    const recent = new Date(Date.now() - NETWORK_VOTE_WINDOW_MS + 60_000).toISOString();
    const fresh = insertEntry();
    for (let index = 0; index < NETWORK_VOTES_PER_PHOTO; index += 1) {
      getDb()
        .prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at, network_hash) VALUES (?, ?, ?, ?)")
        .run(fresh, randomUUID(), recent, cafe);
    }
    const blocked = castPhotoVote(fresh, randomUUID(), cafe);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, "NETWORK_LIMIT");
  });

  it("frees a slot when the latest swipe is undone and leaves a repeat vote alone", () => {
    const photoId = insertEntry();
    const voters = Array.from({ length: NETWORK_VOTES_PER_PHOTO }, () => randomUUID());
    for (const voterId of voters) {
      assert.equal(swipeDeckPhoto(photoId, voterId, "vote", cafe).ok, true);
    }
    const repeat = swipeDeckPhoto(photoId, voters[0]!, "vote", cafe);
    assert.equal(repeat.ok, false);
    if (!repeat.ok) assert.equal(repeat.code, "ALREADY_ACTED");

    assert.equal(undoDeckSwipe(voters[NETWORK_VOTES_PER_PHOTO - 1]!, photoId).ok, true);
    assert.equal(swipeDeckPhoto(photoId, randomUUID(), "vote", cafe).ok, true);
    const blocked = castPhotoVote(photoId, randomUUID(), cafe);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, "NETWORK_LIMIT");
  });

  it("stays open when the request has no public address", () => {
    const photoId = insertEntry();
    for (let index = 0; index < NETWORK_VOTES_PER_PHOTO + 1; index += 1) {
      assert.equal(swipeDeckPhoto(photoId, randomUUID(), "vote").ok, true);
    }
  });

  it("answers the swipe and the photo page with the same wait", async () => {
    const photoId = insertEntry();
    const headers = { "content-type": "application/json", "x-forwarded-for": "9.9.9.9, 203.0.113.77" };
    for (let index = 0; index < NETWORK_VOTES_PER_PHOTO; index += 1) {
      const response = await deckPost(
        new Request("http://local/api/photos/deck", {
          method: "POST",
          headers,
          body: JSON.stringify({ voterId: randomUUID(), photoId, action: "vote" }),
        }),
      );
      assert.equal(response.status, 200);
    }
    const blocked = await votePost(
      new Request(`http://local/api/photos/${photoId}/vote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ voterId: randomUUID() }),
      }),
      { params: Promise.resolve({ id: photoId }) },
    );
    assert.equal(blocked.status, 429);
    const body = (await blocked.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, "NETWORK_LIMIT");
    assert.equal(body.error.message, NETWORK_VOTE_LIMIT_MESSAGE);
  });
});
