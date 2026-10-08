import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dealDeck, deckDealKey, deckWeight } from "@/lib/deck-order";

describe("deck order", () => {
  it("gives a photo with fewer swipes a larger key for the same random number", () => {
    assert.equal(deckWeight(0), 1);
    assert.equal(deckWeight(5), 1 / 6);
    assert.ok(deckDealKey(5, 0.4) > deckDealKey(80, 0.4));
  });

  it("keeps every photo and deals a lightly swiped photo ahead of an old leader most of the time", () => {
    const photos = [
      { id: "new", swipes: 5 },
      { id: "old", swipes: 80 },
      { id: "mid", swipes: 20 },
    ];
    const once = dealDeck(photos, () => 0.5);
    assert.deepEqual(
      once.map((photo) => photo.id),
      ["new", "mid", "old"],
    );

    let newerFirst = 0;
    const trials = 400;
    for (let trial = 0; trial < trials; trial += 1) {
      const [first] = dealDeck([
        { id: "new", swipes: 5 },
        { id: "old", swipes: 80 },
      ]);
      assert.equal(new Set(dealDeck(photos).map((photo) => photo.id)).size, photos.length);
      if (first?.id === "new") newerFirst += 1;
    }
    assert.ok(newerFirst / trials > 0.8);
  });

  it("can put either photo first when both have been swiped the same amount", () => {
    const seen = new Set<string>();
    for (let trial = 0; trial < 40; trial += 1) {
      const [first] = dealDeck([
        { id: "a", swipes: 5 },
        { id: "b", swipes: 5 },
      ]);
      if (first) seen.add(first.id);
    }
    assert.equal(seen.size, 2);
  });
});
