import { contestClickLabel, contestPageLabel, emptyContestReport, type ContestReport } from "@/lib/contest-report";
import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/validation";

const VISIT = "visit";
const CLICK = "click";
const DEDUPE_MS = 2000;

const pageSet = new Set(["vote", "leaderboard", "photo"]);
const clickSet = new Set(["share-link", "download-story", "download-post"]);

export { emptyContestReport, type ContestReport };

/** Counts a page view or a share/download tap. The same action twice in a moment counts once. */
export function recordContestEvent(visitorId: string, kind: unknown, name: unknown): boolean {
  if (!isUuid(visitorId)) return false;
  if (kind !== VISIT && kind !== CLICK) return false;
  if (typeof name !== "string") return false;
  if (kind === VISIT && !pageSet.has(name)) return false;
  if (kind === CLICK && !clickSet.has(name)) return false;

  const db = getDb();
  const recent = db
    .prepare(
      `SELECT created_at FROM contest_events
       WHERE visitor_id = ? AND kind = ? AND name = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(visitorId, kind, name) as { created_at: string } | undefined;
  if (recent) {
    const then = Date.parse(recent.created_at);
    if (Number.isFinite(then) && Date.now() - then < DEDUPE_MS) return true;
  }
  db.prepare(`INSERT INTO contest_events (visitor_id, kind, name, created_at) VALUES (?, ?, ?, ?)`).run(
    visitorId,
    kind,
    name,
    new Date().toISOString(),
  );
  return true;
}

/** Totals for the private review page. A name is included only when this browser signed up. */
export function contestReport(): ContestReport {
  const db = getDb();
  const pages = db
    .prepare(
      `SELECT name, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors
       FROM contest_events
       WHERE kind = 'visit'
       GROUP BY name`,
    )
    .all() as { name: string; visits: number; visitors: number }[];
  const clicks = db
    .prepare(
      `SELECT name, COUNT(*) AS count
       FROM contest_events
       WHERE kind = 'click'
       GROUP BY name`,
    )
    .all() as { name: string; count: number }[];
  const recent = db
    .prepare(
      `SELECT e.id, e.kind, e.name, e.created_at, d.person_name
       FROM contest_events e
       LEFT JOIN draw_entrants d ON d.voter_id = e.visitor_id
       ORDER BY e.id DESC
       LIMIT 40`,
    )
    .all() as { id: number; kind: string; name: string; created_at: string; person_name: string | null }[];

  const pageCounts = new Map(pages.map((row) => [row.name, row]));
  const clickCounts = new Map(clicks.map((row) => [row.name, Number(row.count)]));
  const report = emptyContestReport();
  report.pages = report.pages.map((page) => {
    const row = pageCounts.get(page.id);
    return row ? { ...page, visitors: Number(row.visitors), visits: Number(row.visits) } : page;
  });
  report.clicks = report.clicks.map((click) => ({ ...click, count: clickCounts.get(click.id) ?? 0 }));
  report.recent = recent.flatMap((row) => {
    const label = row.kind === VISIT ? contestPageLabel(row.name) : contestClickLabel(row.name);
    if (!label) return [];
    const personName = row.person_name?.trim() || null;
    return [{ id: Number(row.id), at: row.created_at, label, personName }];
  });
  return report;
}
