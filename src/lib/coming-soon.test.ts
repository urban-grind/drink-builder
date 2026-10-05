import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMING_SOON_AT,
  comingSoonAllowsAsset,
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
    assert.equal(comingSoonAllowsAsset("/photos/cup.jpg"), false);
    assert.equal(comingSoonAllowsAsset("/api/photos"), false);
    assert.equal(comingSoonAllowsAsset("/p/uu3goo"), false);
  });

  it("renders a page with the countdown and none of the contest", () => {
    const html = comingSoonHtml(COMING_SOON_AT - 5000);
    assert.match(html, /Coming soon/);
    assert.match(html, /Wednesday, October 7/);
    assert.match(html, /7:00 p\.m\. Eastern/);
    assert.match(html, new RegExp(`data-opens="${COMING_SOON_AT}"`));
    assert.equal(html.includes("/api/photos"), false);
    assert.equal(html.includes("Top picks"), false);
  });
});
