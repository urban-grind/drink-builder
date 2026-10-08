import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMING_SOON_AT,
  comingSoonAllowsAsset,
  comingSoonAllowsReview,
  comingSoonEnabled,
  comingSoonHtml,
  comingSoonLabel,
  comingSoonLeft,
} from "@/lib/coming-soon";

const FLAG = "COMING_SOON";

function withFlag(value: string | undefined, run: () => void) {
  const previous = process.env[FLAG];
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  }
}

describe("coming soon gate", () => {
  it("stays off when the variable is missing, empty, or not an on-switch", () => {
    for (const value of [undefined, "", "0", "false", "no", "off"]) {
      withFlag(value, () => assert.equal(comingSoonEnabled(), false));
    }
  });

  it("turns on for 1, true, or yes", () => {
    for (const value of ["1", "true", "TRUE", " yes "]) {
      withFlag(value, () => assert.equal(comingSoonEnabled(), true));
    }
  });

  it("opens Wednesday, October 7, 2026 at 7:00 p.m. Eastern", () => {
    assert.equal(new Date(COMING_SOON_AT).toISOString(), "2026-10-07T23:00:00.000Z");
  });

  it("counts down to that moment and then stays at zero", () => {
    const now = COMING_SOON_AT - ((1 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000);
    assert.deepEqual(comingSoonLeft(now), { open: false, days: 1, hours: 3, minutes: 4, seconds: 5 });
    assert.equal(comingSoonLeft(COMING_SOON_AT - 1000).open, false);
    assert.equal(comingSoonLeft(COMING_SOON_AT).open, true);
    assert.equal(comingSoonLabel(comingSoonLeft(COMING_SOON_AT)), "Opening soon");
  });

  it("lets the page assets through and covers photos and the api", () => {
    assert.equal(comingSoonAllowsAsset("/favicon.ico"), true);
    assert.equal(comingSoonAllowsAsset("/urban-grind-logo.png"), true);
    assert.equal(comingSoonAllowsAsset("/_next/static/chunks/app.js"), true);
    assert.equal(comingSoonAllowsAsset("/coming-soon/latte-lot.jpg"), true);
    assert.equal(comingSoonAllowsAsset("/coming-soon/stats"), true);
    assert.equal(comingSoonAllowsAsset("/api/coming-soon/hit"), true);
    assert.equal(comingSoonAllowsAsset("/api/contest/hit"), true);
    assert.equal(comingSoonAllowsAsset("/photos/cup.jpg"), false);
    assert.equal(comingSoonAllowsAsset("/api/photos"), false);
    assert.equal(comingSoonAllowsAsset("/p/uu3goo"), false);
  });

  it("lets the cafe into review and keeps the contest covered", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    assert.equal(comingSoonAllowsReview("/photos/review", false), true);
    assert.equal(comingSoonAllowsReview("/photos/recap", false), true);
    assert.equal(comingSoonAllowsReview("/api/photos/review", false), true);
    assert.equal(comingSoonAllowsReview("/api/photos/review/race", false), true);
    assert.equal(comingSoonAllowsReview("/api/photos/review/login", false), true);
    assert.equal(comingSoonAllowsReview("/api/photos", false), false);
    assert.equal(comingSoonAllowsReview("/api/photos/upload", false), false);
    assert.equal(comingSoonAllowsReview(`/api/photos/${id}/image`, false), false);
    assert.equal(comingSoonAllowsReview(`/api/photos/${id}/moderate`, false), false);
    assert.equal(comingSoonAllowsReview("/api/photos/deck", false), false);
    assert.equal(comingSoonAllowsReview("/", false), false);
    assert.equal(comingSoonAllowsReview("/api/photos", true), true);
    assert.equal(comingSoonAllowsReview("/api/photos/upload", true), true);
    assert.equal(comingSoonAllowsReview(`/api/photos/upload/${id}/prepare`, true), true);
    assert.equal(comingSoonAllowsReview(`/api/photos/${id}/image`, true), true);
    assert.equal(comingSoonAllowsReview(`/api/photos/${id}/moderate`, true), true);
    assert.equal(comingSoonAllowsReview("/api/photos/deck", true), false);
    assert.equal(comingSoonAllowsReview("/api/photos/leaderboard", true), false);
    assert.equal(comingSoonAllowsReview("/", true), false);
  });

  it("renders a page with the countdown and none of the contest", () => {
    const html = comingSoonHtml(COMING_SOON_AT - 5000);
    assert.match(html, /href="https:\/\/urbangrind\.ca"/);
    assert.match(html, /Need a pick me up\?/);
    assert.match(html, /Sip\. Snap\. Swipe\./);
    assert.match(html, /Win free coffee<br>for a month\./);
    assert.match(html, /Four ways to win\./);
    assert.equal(html.includes("Drops tonight"), false);
    assert.equal(html.includes("How will you win?"), false);
    assert.equal(html.includes("Get in on the fun"), false);
    assert.match(html, /Photo contest winner/);
    assert.match(html, /UG favourite winner/);
    assert.match(html, /Picked Oct 26th/);
    assert.match(html, /class="live">Live</);
    assert.match(html, /Voting draw winner/);
    assert.match(html, /Sharing draw winner/);
    assert.match(html, /Get the most votes/);
    assert.match(html, /Catch our eye/);
    assert.match(html, /Swipe for a chance to win/);
    assert.match(html, /Share to your story/);
    assert.equal(html.match(/class="starts"/g)?.length, 2);
    assert.match(html, /Starts in 00:00:05/);
    assert.equal(html.includes("Get a head start"), false);
    assert.match(html, /Download the story/);
    assert.equal(html.includes("Saved the story image"), false);
    assert.match(html, /\/coming-soon\/sip-snap-swipe\.png/);
    assert.match(html, /\/api\/coming-soon\/hit/);
    assert.match(html, /ug-coming-soon/);
    assert.match(html, /ugTrack\("click", "story"\)/);
    assert.equal(comingSoonAllowsAsset("/coming-soon/sip-snap-swipe.png"), true);
    assert.match(html, /Grab your drink\. Get your photo ready\./);
    assert.match(html, /\/coming-soon\/latte-lot\.jpg/);
    assert.match(html, /Wednesday, October 7/);
    assert.equal(html.includes('id="days"'), false);
    assert.match(html, /7:00 p\.m\. Eastern/);
    assert.match(html, new RegExp(`data-opens="${COMING_SOON_AT}"`));
    assert.equal(html.includes("/api/photos"), false);
    assert.equal(html.includes("Leaderboard"), false);
  });
});
