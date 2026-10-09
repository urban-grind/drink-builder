import { getDb } from "@/lib/db";
import type { VoteAudit } from "@/lib/photo-types";

const EASTERN = "America/Toronto";

type VoteRow = {
  voter_id: string;
  created_at: string;
  network_hash: string | null;
  from_deck: number;
  voter_votes: number;
};

/** One photo's votes for the private review page. */
export function auditPhotoVotes(photoId: string): VoteAudit | null {
  const db = getDb();
  const found = db.prepare("SELECT 1 AS found FROM photo_entries WHERE id = ?").get(photoId);
  if (!found) return null;

  const rows = db
    .prepare(
      `SELECT v.voter_id, v.created_at, v.network_hash,
         EXISTS (
           SELECT 1 FROM photo_swipes s
           WHERE s.photo_id = v.photo_id AND s.voter_id = v.voter_id AND s.action = 'vote'
         ) AS from_deck,
         (SELECT COUNT(*) FROM photo_votes other WHERE other.voter_id = v.voter_id) AS voter_votes
       FROM photo_votes v
       WHERE v.photo_id = ?
       ORDER BY v.created_at`,
    )
    .all(photoId) as VoteRow[];

  const groups = new Map<string, { hash: string | null; votes: number; firstAt: string; lastAt: string }>();
  let missingNetwork = 0;
  let fromPhotoPage = 0;
  let onlyThisPhoto = 0;
  for (const row of rows) {
    if (!row.network_hash) missingNetwork += 1;
    if (Number(row.from_deck) !== 1) fromPhotoPage += 1;
    if (Number(row.voter_votes) === 1) onlyThisPhoto += 1;
    const key = row.network_hash ?? "";
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { hash: row.network_hash, votes: 1, firstAt: row.created_at, lastAt: row.created_at });
      continue;
    }
    current.votes += 1;
    current.lastAt = row.created_at;
  }

  const ordered = [...groups.values()].sort(
    (a, b) => b.votes - a.votes || a.firstAt.localeCompare(b.firstAt),
  );
  let networkNumber = 0;
  return {
    voteCount: rows.length,
    networkCount: ordered.filter((group) => group.hash).length,
    missingNetwork,
    fromPhotoPage,
    onlyThisPhoto,
    networks: ordered.map((group) => {
      if (!group.hash) return { label: "No network recorded", votes: group.votes, when: whenLabel(group.firstAt, group.lastAt) };
      networkNumber += 1;
      return { label: `Network ${networkNumber}`, votes: group.votes, when: whenLabel(group.firstAt, group.lastAt) };
    }),
    votes: [...rows].reverse().map((row) => ({
      at: easternStamp(row.created_at, true),
      browserId: row.voter_id,
      networkId: networkLabel(row.network_hash),
      page: Number(row.from_deck) === 1 ? "Swipe" : "Photo page",
    })),
  };
}

function networkLabel(hash: string | null): string {
  return hash || "None";
}

function whenLabel(start: string, end: string): string {
  const from = easternStamp(start, false);
  const to = easternStamp(end, false);
  return from === to ? from : `${from} – ${to}`;
}

function easternStamp(iso: string, withSeconds: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  }).format(new Date(iso));
}
