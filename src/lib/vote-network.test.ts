import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import { POST as deckPost } from "@/app/api/photos/deck/route";
import { POST as votePost } from "@/app/api/photos/[id]/vote/route";
import { getDb, resetDbForTests } from "@/lib/db";
import { castPhotoVote, swipeDeckPhoto } from "@/lib/photos";
import {
  NETWORK_VOTE_LIMIT_MESSAGE,
  NETWORK_VOTE_WINDOW_MS,
  clientNetworkAddress,
  hashNetwork,
} from "@/lib/vote-network";

const previousDb = process.env.DRINK_DB_PATH;
process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-network-${process.pid}.sqlite`);

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

  it("allows one photo-page vote every five minutes from a network, on any photo", () => {
    const here = hashNetwork(randomUUID());
    const there = hashNetwork(randomUUID());
    const photoId = insertEntry();
    assert.equal(castPhotoVote(photoId, randomUUID(), here).ok, true);
    const samePhoto = castPhotoVote(photoId, randomUUID(), here);
    assert.equal(samePhoto.ok, false);
    if (!samePhoto.ok) assert.equal(samePhoto.code, "NETWORK_LIMIT");

    const otherPhoto = insertEntry();
    const other = castPhotoVote(otherPhoto, randomUUID(), here);
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.code, "NETWORK_LIMIT");

    assert.equal(castPhotoVote(photoId, randomUUID(), there).ok, true);
    assert.equal(voteCount(photoId), 2);
  });

  it("does not limit swipes, and a swipe does not use the photo-page wait", () => {
    const here = hashNetwork(randomUUID());
    const first = insertEntry();
    const second = insertEntry();
    assert.equal(swipeDeckPhoto(first, randomUUID(), "vote", here).ok, true);
    assert.equal(swipeDeckPhoto(second, randomUUID(), "vote", here).ok, true);
    assert.equal(castPhotoVote(insertEntry(), randomUUID(), here).ok, true);
  });

  it("does not count a skip or a vote from outside the five-minute window", () => {
    const here = hashNetwork(randomUUID());
    const photoId = insertEntry();
    assert.equal(swipeDeckPhoto(photoId, randomUUID(), "skip", here).ok, true);
    assert.equal(swipeDeckPhoto(photoId, randomUUID(), "vote", here).ok, true);

    const agedNetwork = hashNetwork(randomUUID());
    const aged = insertEntry();
    const old = new Date(Date.now() - NETWORK_VOTE_WINDOW_MS - 60_000).toISOString();
    getDb()
      .prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at, network_hash) VALUES (?, ?, ?, ?)")
      .run(aged, randomUUID(), old, agedNetwork);
    assert.equal(swipeDeckPhoto(aged, randomUUID(), "vote", agedNetwork).ok, true);

    const recentNetwork = hashNetwork(randomUUID());
    const recent = new Date(Date.now() - NETWORK_VOTE_WINDOW_MS + 60_000).toISOString();
    const fresh = insertEntry();
    getDb()
      .prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at, network_hash) VALUES (?, ?, ?, ?)")
      .run(fresh, randomUUID(), recent, recentNetwork);
    const blocked = castPhotoVote(insertEntry(), randomUUID(), recentNetwork);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, "NETWORK_LIMIT");
  });

  it("lets the next photo-page vote through once the earlier one is gone", () => {
    const here = hashNetwork(randomUUID());
    const photoId = insertEntry();
    const voterId = randomUUID();
    assert.equal(castPhotoVote(photoId, voterId, here).ok, true);
    const repeat = castPhotoVote(photoId, voterId, here);
    assert.equal(repeat.ok, false);
    if (!repeat.ok) assert.equal(repeat.code, "ALREADY_VOTED");

    getDb().prepare("DELETE FROM photo_votes WHERE photo_id = ? AND voter_id = ?").run(photoId, voterId);
    assert.equal(castPhotoVote(insertEntry(), randomUUID(), here).ok, true);
    assert.equal(swipeDeckPhoto(insertEntry(), randomUUID(), "vote", here).ok, true);
  });

  it("stays open when the request has no public address", () => {
    const photoId = insertEntry();
    assert.equal(swipeDeckPhoto(photoId, randomUUID(), "vote").ok, true);
    assert.equal(swipeDeckPhoto(insertEntry(), randomUUID(), "vote").ok, true);
  });

  it("waits on the photo page and lets the swipe through", async () => {
    const headers = { "content-type": "application/json", "x-forwarded-for": "9.9.9.9, 203.0.113.77" };
    const first = insertEntry();
    const opened = await votePost(
      new Request(`http://local/api/photos/${first}/vote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ voterId: randomUUID() }),
      }),
      { params: Promise.resolve({ id: first }) },
    );
    assert.equal(opened.status, 200);

    const swipe = await deckPost(
      new Request("http://local/api/photos/deck", {
        method: "POST",
        headers,
        body: JSON.stringify({ voterId: randomUUID(), photoId: insertEntry(), action: "vote" }),
      }),
    );
    assert.equal(swipe.status, 200);

    const second = insertEntry();
    const blocked = await votePost(
      new Request(`http://local/api/photos/${second}/vote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ voterId: randomUUID() }),
      }),
      { params: Promise.resolve({ id: second }) },
    );
    assert.equal(blocked.status, 429);
    const body = (await blocked.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, "NETWORK_LIMIT");
    assert.equal(body.error.message, NETWORK_VOTE_LIMIT_MESSAGE);
  });
});
