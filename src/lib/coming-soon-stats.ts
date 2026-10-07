import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/validation";

const VISIT = "visit";
const CLICK = "click";
const PAGE = "page";
const STORY = "story";
const DEDUPE_MS = 2000;

const CLICKS = new Set([STORY]);

export type ComingSoonStats = {
  visitors: number;
  visits: number;
  storyClicks: number;
};

/** Counts a page load or the story button. The same tap twice in a moment counts once. */
export function recordComingSoonEvent(visitorId: string, kind: unknown, name: unknown): boolean {
  if (!isUuid(visitorId)) return false;
  if (kind !== VISIT && kind !== CLICK) return false;
  const label = kind === VISIT ? PAGE : name;
  if (typeof label !== "string" || (kind === CLICK && !CLICKS.has(label))) return false;

  const db = getDb();
  const recent = db
    .prepare(
      `SELECT created_at FROM coming_soon_events
       WHERE visitor_id = ? AND kind = ? AND name = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(visitorId, kind, label) as { created_at: string } | undefined;
  if (recent) {
    const then = Date.parse(recent.created_at);
    if (Number.isFinite(then) && Date.now() - then < DEDUPE_MS) return true;
  }
  db.prepare(
    `INSERT INTO coming_soon_events (visitor_id, kind, name, created_at) VALUES (?, ?, ?, ?)`,
  ).run(visitorId, kind, label, new Date().toISOString());
  return true;
}

export function comingSoonStats(): ComingSoonStats {
  const db = getDb();
  const visits = db.prepare("SELECT COUNT(*) AS count FROM coming_soon_events WHERE kind = 'visit'").get() as {
    count: number;
  };
  const visitors = db
    .prepare("SELECT COUNT(DISTINCT visitor_id) AS count FROM coming_soon_events WHERE kind = 'visit'")
    .get() as { count: number };
  const story = db
    .prepare("SELECT COUNT(*) AS count FROM coming_soon_events WHERE kind = 'click' AND name = 'story'")
    .get() as { count: number };
  return {
    visitors: Number(visitors.count),
    visits: Number(visits.count),
    storyClicks: Number(story.count),
  };
}
