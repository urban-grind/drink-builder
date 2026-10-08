import { getDb } from "@/lib/db";
import { CONTEST_OPENS_AT, type RacePhoto, type RaceVote, type VoteRace } from "@/lib/photo-race";
import { ensureSamplePhotos, localSampleAsset, samplePhotosEnabled } from "@/lib/sample-photos";

type PhotoRow = {
  id: string;
  person_name: string;
  drink_name: string;
  thumb_key: string;
};

type VoteRow = {
  photo_id: string;
  created_at: string;
};

function thumbUrl(row: PhotoRow): string {
  return localSampleAsset(row.thumb_key) ?? `/api/photos/${row.id}/image?variant=thumb`;
}

/** Approved photos and the votes cast from the contest open through `toMs`. */
export function loadVoteRace(fromMs = CONTEST_OPENS_AT, toMs = Date.now()): VoteRace {
  ensureSamplePhotos();
  const db = getDb();
  const visible = samplePhotosEnabled() ? 1 : 0;
  const from = new Date(fromMs).toISOString();
  const to = new Date(toMs).toISOString();
  const where = `e.status = 'approved' AND (? = 1 OR e.original_key NOT LIKE 'local-sample/%')
    AND v.created_at >= ? AND v.created_at <= ?`;
  const photos = (
    db
      .prepare(
        `SELECT DISTINCT e.id, e.person_name, e.drink_name, e.thumb_key, e.created_at
         FROM photo_entries e
         JOIN photo_votes v ON v.photo_id = e.id
         WHERE ${where}
         ORDER BY e.created_at, e.id`,
      )
      .all(visible, from, to) as PhotoRow[]
  ).map(
    (row): RacePhoto => ({
      id: row.id,
      personName: row.person_name,
      drinkName: row.drink_name,
      thumbUrl: thumbUrl(row),
    }),
  );
  const votes = (
    db
      .prepare(
        `SELECT v.photo_id, v.created_at
         FROM photo_votes v
         JOIN photo_entries e ON e.id = v.photo_id
         WHERE ${where}
         ORDER BY v.created_at ASC, v.photo_id ASC`,
      )
      .all(visible, from, to) as VoteRow[]
  ).map((row): RaceVote => ({ photoId: row.photo_id, at: row.created_at }));
  return { photos, votes, from, to };
}
