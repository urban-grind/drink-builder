import type { DatabaseSync } from "node:sqlite";
import { beginImmediate, getDb, isUniqueConstraint, rollbackQuietly } from "@/lib/db";
import { DRAW_REQUIRED_AT } from "@/lib/draw-prompt";
import { NETWORK_VOTES_PER_PHOTO, networkVoteCutoff } from "@/lib/vote-network";
import type { PhotoCrop } from "@/lib/photo-crop";
import { discardUpload, prepareUpload, saveUploadCrop, UPLOAD_TTL_MS, voteKeyForUpload, thumbKeyForUpload } from "@/lib/photo-prepare";
import { isPhotoCode, takePhotoCode } from "@/lib/photo-code";
import { ensureSamplePhotos, localSampleAsset, samplePhotosEnabled } from "@/lib/sample-photos";
import { isUuid } from "@/lib/validation";
import { getPhotoStorage } from "@/lib/r2";
import type { ContestActivity, LeaderboardEntry, OwnedPhoto, PhotoStatus, PublicPhoto, ReviewPhoto } from "@/lib/photo-types";
import { easternDayRange } from "@/lib/eastern-day";
import { parsePhotoContact, validatePhotoEntry } from "@/lib/photo-validation";
import type { FieldErrors } from "@/lib/types";

export const NEW_PHOTO_LIMIT = 10;

/**
 * Local preview only. Unset, empty, or anything other than true/1/yes stays off,
 * so a new photo waits for cafe approval. Ignored when NODE_ENV is production.
 */
export function photoReviewBypassed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const value = process.env.PHOTO_SKIP_REVIEW?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

type UploadRow = {
  id: string;
  object_key: string;
  content_type: string;
  content_length: number;
  created_at: string;
  consumed_at: string | null;
  vote_key: string | null;
  thumb_key: string | null;
  prepare_status: string | null;
  prepare_error: string | null;
  prepare_generation: number | bigint | null;
};

type EntryRow = {
  id: string;
  person_name: string;
  email: string | null;
  phone: string | null;
  drink_name: string;
  caption: string;
  status: PhotoStatus;
  original_key: string;
  content_type: string;
  vote_key: string;
  thumb_key: string;
  created_at: string;
  reviewed_at: string | null;
  public_code: string | null;
  vote_count: number;
  voted: number;
};

function thumbUrl(id: string): string {
  return `/api/photos/${id}/image?variant=thumb`;
}

function imageUrl(id: string): string {
  return `/api/photos/${id}/image?variant=vote`;
}

function toPublic(row: EntryRow): PublicPhoto {
  const localThumb = localSampleAsset(row.thumb_key);
  const localVote = localSampleAsset(row.vote_key);
  return {
    id: row.id,
    personName: row.person_name,
    drinkName: row.drink_name,
    caption: row.caption,
    createdAt: row.created_at,
    voteCount: Number(row.vote_count),
    voted: Number(row.voted) === 1,
    code: row.public_code ?? "",
    thumbUrl: localThumb ?? thumbUrl(row.id),
    imageUrl: localVote ?? imageUrl(row.id),
  };
}

function toReview(row: EntryRow): ReviewPhoto {
  return { ...toPublic(row), email: row.email, phone: row.phone, status: row.status };
}

const selectEntry = `
  SELECT
    e.id,
    e.person_name,
    e.email,
    e.phone,
    e.drink_name,
    e.caption,
    e.status,
    e.original_key,
    e.content_type,
    e.vote_key,
    e.thumb_key,
    e.created_at,
    e.reviewed_at,
    e.public_code,
    (SELECT COUNT(*) FROM photo_votes v WHERE v.photo_id = e.id) AS vote_count,
    EXISTS(
      SELECT 1 FROM photo_votes v WHERE v.photo_id = e.id AND v.voter_id = ?
    ) AS voted
  FROM photo_entries e
`;

/** Samples stay on the local preview. Any other environment skips those rows. */
function sampleVisibilitySql(): string {
  return "(? = 1 OR e.original_key NOT LIKE 'local-sample/%')";
}

/** A short link works while the cafe is still reviewing. Rejected and removed photos do not. */
function linkedPhotoSql(): string {
  return "e.status IN ('pending', 'approved')";
}

function sampleVisibilityFlag(): number {
  return samplePhotosEnabled() ? 1 : 0;
}

function queryPhotos(sort: "top" | "newest", voterId: string): PublicPhoto[] {
  const order =
    sort === "top" ? "ORDER BY vote_count DESC, e.created_at DESC" : "ORDER BY e.created_at DESC";
  const rows = getDb()
    .prepare(`${selectEntry} WHERE e.status = 'approved' AND ${sampleVisibilitySql()} ${order}`)
    .all(voterId, sampleVisibilityFlag()) as EntryRow[];
  return rows.map(toPublic);
}

export function listPhotoBoard(voterId: string | null): { popular: PublicPhoto[]; newest: PublicPhoto[] } {
  ensureSamplePhotos();
  const voter = voterId ?? "";
  return {
    popular: queryPhotos("top", voter),
    newest: queryPhotos("newest", voter).slice(0, NEW_PHOTO_LIMIT),
  };
}

export function getPublicPhoto(id: string, voterId: string | null): PublicPhoto | null {
  ensureSamplePhotos();
  const row = getDb()
    .prepare(`${selectEntry} WHERE e.id = ? AND ${linkedPhotoSql()} AND ${sampleVisibilitySql()}`)
    .get(voterId ?? "", id, sampleVisibilityFlag()) as EntryRow | undefined;
  return row ? toPublic(row) : null;
}

/** Votes divided by votes plus skips. Null when nobody has acted on the photo. */
export function likeRate(voteCount: number, skipCount: number): number | null {
  const seen = voteCount + skipCount;
  if (seen === 0) return null;
  return voteCount / seen;
}

/** Rank and the vote gap to second place. A tie on votes has no useful gap. */
export function standingsFor(ordered: { id: string; voteCount: number }[]): Map<string, { rank: number; votesFromTopTwo: number | null }> {
  const secondVotes = ordered.length >= 2 ? ordered[1].voteCount : 0;
  const standings = new Map<string, { rank: number; votesFromTopTwo: number | null }>();
  ordered.forEach((photo, index) => {
    const rank = index + 1;
    const votesFromTopTwo = rank > 2 && secondVotes > photo.voteCount ? secondVotes - photo.voteCount : null;
    standings.set(photo.id, { rank, votesFromTopTwo });
  });
  return standings;
}

/** Highest yes-vote count first. Equal counts use the higher like percentage. */
export function compareLeaderboard(
  a: { voteCount: number; skipCount: number },
  b: { voteCount: number; skipCount: number },
): number {
  if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
  return (likeRate(b.voteCount, b.skipCount) ?? -1) - (likeRate(a.voteCount, a.skipCount) ?? -1);
}

/** How many top photos one request returns when the caller does not ask for a page. */
export const LEADERBOARD_LIMIT = 20;

/** How many leaderboard photos the phone asks for as the list scrolls. */
export const LEADERBOARD_PAGE_SIZE = 4;

const LEADERBOARD_MAX_PAGE = 24;

/** How many cards a phone asks for at once. */
export const DECK_PAGE_SIZE = 5;

function pageBound(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined || !Number.isInteger(value) || value < 0) return fallback;
  return Math.min(value, max);
}

/**
 * One page of the leaderboard. Pending, rejected, and removed photos stay off this list.
 * Samples stay off in production. The order is stable so later pages do not repeat a photo.
 */
export function listPhotoLeaderboard(options?: { offset?: number; limit?: number }): {
  photos: LeaderboardEntry[];
  hasMore: boolean;
} {
  ensureSamplePhotos();
  const limit = pageBound(options?.limit, LEADERBOARD_LIMIT, LEADERBOARD_MAX_PAGE);
  const offset = pageBound(options?.offset, 0, 10_000);
  const rows = getDb()
    .prepare(
      `SELECT
         e.id,
         e.public_code,
         e.person_name,
         e.drink_name,
         e.created_at,
         e.thumb_key,
         (SELECT COUNT(*) FROM photo_votes v WHERE v.photo_id = e.id) AS vote_count,
         (SELECT COUNT(*) FROM photo_swipes s WHERE s.photo_id = e.id AND s.action = 'skip') AS skip_count
       FROM photo_entries e
       WHERE e.status = 'approved' AND ${sampleVisibilitySql()}
       ORDER BY vote_count DESC,
         CASE
           WHEN vote_count + skip_count = 0 THEN -1.0
           ELSE CAST(vote_count AS REAL) / (vote_count + skip_count)
         END DESC,
         e.created_at DESC,
         e.id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(sampleVisibilityFlag(), limit + 1, offset) as {
    id: string;
    public_code: string | null;
    person_name: string;
    drink_name: string;
    created_at: string;
    thumb_key: string;
    vote_count: number;
    skip_count: number;
  }[];
  const hasMore = rows.length > limit;
  const photos = rows.slice(0, limit).map((row) => {
    const voteCount = Number(row.vote_count);
    const skipCount = Number(row.skip_count);
    const rate = likeRate(voteCount, skipCount);
    const localThumb = localSampleAsset(row.thumb_key);
    return {
      id: row.id,
      code: row.public_code ?? "",
      personName: row.person_name,
      drinkName: row.drink_name,
      createdAt: row.created_at,
      thumbUrl: localThumb ?? thumbUrl(row.id),
      voteCount,
      skipCount,
      likePercent: rate === null ? null : Math.round(rate * 100),
    };
  });
  return { photos, hasMore };
}

/**
 * Photos on the public board, and votes on those photos.
 * Today is midnight to midnight Eastern. Pending and removed photos stay out.
 */
export function contestActivity(now = new Date()): ContestActivity {
  ensureSamplePhotos();
  const day = easternDayRange(now);
  const flag = sampleVisibilityFlag();
  const row = getDb()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM photo_entries e
           WHERE e.status = 'approved' AND ${sampleVisibilitySql()}) AS photos,
         (SELECT COUNT(*) FROM photo_entries e
           WHERE e.status = 'approved' AND ${sampleVisibilitySql()}
             AND e.created_at >= ? AND e.created_at < ?) AS photos_today,
         (SELECT COUNT(*) FROM photo_votes v
           JOIN photo_entries e ON e.id = v.photo_id
           WHERE e.status = 'approved' AND ${sampleVisibilitySql()}) AS votes,
         (SELECT COUNT(*) FROM photo_votes v
           JOIN photo_entries e ON e.id = v.photo_id
           WHERE e.status = 'approved' AND ${sampleVisibilitySql()}
             AND v.created_at >= ? AND v.created_at < ?) AS votes_today,
         (SELECT COUNT(*) FROM photo_swipes s
           JOIN photo_entries e ON e.id = s.photo_id
           WHERE s.action = 'skip' AND e.status = 'approved' AND ${sampleVisibilitySql()}) AS skips,
         (SELECT COUNT(*) FROM photo_swipes s
           JOIN photo_entries e ON e.id = s.photo_id
           WHERE s.action = 'skip' AND e.status = 'approved' AND ${sampleVisibilitySql()}
             AND s.created_at >= ? AND s.created_at < ?) AS skips_today`,
    )
    .get(flag, flag, day.start, day.end, flag, flag, day.start, day.end, flag, flag, day.start, day.end) as {
    photos: number;
    photos_today: number;
    votes: number;
    votes_today: number;
    skips: number;
    skips_today: number;
  };
  return {
    photos: Number(row.photos),
    votes: Number(row.votes) + Number(row.skips),
    photosToday: Number(row.photos_today),
    votesToday: Number(row.votes_today) + Number(row.skips_today),
  };
}

/**
 * The next few approved photos this voter has not voted on or skipped.
 * Pending uploads stay off the deck until the cafe approves them.
 * `except` is the small stack already on the phone, so those images are not sent again.
 */
export function listPhotoDeck(
  voterId: string,
  options?: { limit?: number; except?: string[] },
): PublicPhoto[] {
  ensureSamplePhotos();
  const limit = Math.min(Math.max(options?.limit ?? DECK_PAGE_SIZE, 1), 8);
  const except = (options?.except ?? []).filter((id) => isUuid(id)).slice(0, 32);
  const exceptSql = except.length > 0 ? ` AND e.id NOT IN (${except.map(() => "?").join(", ")})` : "";
  const rows = getDb()
    .prepare(
      `${selectEntry}
       WHERE e.status = 'approved'
         AND ${sampleVisibilitySql()}
         AND e.id NOT IN (
           SELECT photo_id FROM photo_votes WHERE voter_id = ?
           UNION
           SELECT photo_id FROM photo_swipes WHERE voter_id = ?
         )
         ${exceptSql}
       ORDER BY RANDOM()
       LIMIT ?`,
    )
    .all(voterId, sampleVisibilityFlag(), voterId, voterId, ...except, limit) as EntryRow[];
  return rows.map(toPublic);
}

function networkVoteLimitReached(
  db: DatabaseSync,
  photoId: string,
  networkHash: string | null | undefined,
  now: string,
): boolean {
  if (!networkHash) return false;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM photo_votes
       WHERE photo_id = ? AND network_hash = ? AND created_at > ?`,
    )
    .get(photoId, networkHash, networkVoteCutoff(new Date(now))) as { count: number };
  return Number(row.count) >= NETWORK_VOTES_PER_PHOTO;
}

export function swipeDeckPhoto(
  photoId: string,
  voterId: string,
  action: "vote" | "skip",
  networkHash?: string | null,
):
  | { ok: true; photo: PublicPhoto }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_ACTED" | "SIGNUP_REQUIRED" | "NETWORK_LIMIT" } {
  const db = beginImmediate();
  try {
    const photo = db
      .prepare("SELECT 1 AS found FROM photo_entries WHERE id = ? AND status = 'approved'")
      .get(photoId);
    if (!photo) {
      db.exec("ROLLBACK");
      return { ok: false, code: "NOT_FOUND" };
    }
    const gate = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM photo_swipes WHERE voter_id = ?) AS swipes,
           (SELECT COUNT(*) FROM draw_entrants WHERE voter_id = ?) AS known`,
      )
      .get(voterId, voterId) as { swipes: number; known: number };
    if (Number(gate.swipes) >= DRAW_REQUIRED_AT && Number(gate.known) === 0) {
      db.exec("ROLLBACK");
      return { ok: false, code: "SIGNUP_REQUIRED" };
    }
    const acted = db
      .prepare(
        `SELECT 1 AS found FROM photo_swipes WHERE photo_id = ? AND voter_id = ?
         UNION
         SELECT 1 AS found FROM photo_votes WHERE photo_id = ? AND voter_id = ?`,
      )
      .get(photoId, voterId, photoId, voterId);
    if (acted) {
      db.exec("ROLLBACK");
      return { ok: false, code: "ALREADY_ACTED" };
    }
    const now = new Date().toISOString();
    if (action === "vote") {
      if (networkVoteLimitReached(db, photoId, networkHash, now)) {
        db.exec("ROLLBACK");
        return { ok: false, code: "NETWORK_LIMIT" };
      }
      db.prepare(
        "INSERT INTO photo_votes (photo_id, voter_id, created_at, network_hash) VALUES (?, ?, ?, ?)",
      ).run(photoId, voterId, now, networkHash ?? null);
    }
    db.prepare("INSERT INTO photo_swipes (voter_id, photo_id, action, created_at) VALUES (?, ?, ?, ?)").run(
      voterId,
      photoId,
      action,
      now,
    );
    db.exec("COMMIT");
  } catch (error) {
    rollbackQuietly();
    if (isUniqueConstraint(error)) return { ok: false, code: "ALREADY_ACTED" };
    throw error;
  }
  const photo = getPublicPhoto(photoId, voterId);
  if (!photo) return { ok: false, code: "NOT_FOUND" };
  return { ok: true, photo };
}

/** Reverses only this voter's latest swipe. A right swipe drops that vote. A left swipe only returns the photo. */
export function undoDeckSwipe(
  voterId: string,
  photoId: string,
):
  | { ok: true; action: "vote" | "skip"; photo: PublicPhoto }
  | { ok: false; code: "NOT_LAST" | "NOT_FOUND" } {
  const db = beginImmediate();
  let action: "vote" | "skip" = "skip";
  try {
    const latest = db
      .prepare(
        `SELECT photo_id, action FROM photo_swipes
         WHERE voter_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(voterId) as { photo_id: string; action: string } | undefined;
    if (!latest || latest.photo_id !== photoId) {
      db.exec("ROLLBACK");
      return { ok: false, code: "NOT_LAST" };
    }
    action = latest.action === "vote" ? "vote" : "skip";
    if (action === "vote") {
      db.prepare("DELETE FROM photo_votes WHERE photo_id = ? AND voter_id = ?").run(photoId, voterId);
    }
    db.prepare("DELETE FROM photo_swipes WHERE photo_id = ? AND voter_id = ?").run(photoId, voterId);
    db.exec("COMMIT");
  } catch (error) {
    rollbackQuietly();
    throw error;
  }
  const photo = getPublicPhoto(photoId, voterId);
  if (!photo) return { ok: false, code: "NOT_FOUND" };
  return { ok: true, action, photo };
}

export function getPublicPhotoByCode(code: string, voterId: string | null): PublicPhoto | null {
  if (!isPhotoCode(code)) return null;
  ensureSamplePhotos();
  const row = getDb()
    .prepare(`${selectEntry} WHERE e.public_code = ? AND ${linkedPhotoSql()} AND ${sampleVisibilitySql()}`)
    .get(voterId ?? "", code, sampleVisibilityFlag()) as EntryRow | undefined;
  return row ? toPublic(row) : null;
}

export function photoCodeForId(id: string): string | null {
  ensureSamplePhotos();
  const row = getDb()
    .prepare(`SELECT public_code FROM photo_entries e WHERE e.id = ? AND ${sampleVisibilitySql()}`)
    .get(id, sampleVisibilityFlag()) as { public_code: string | null } | undefined;
  return row?.public_code || null;
}

export function listReviewPhotos(): ReviewPhoto[] {
  ensureSamplePhotos();
  const rows = getDb()
    .prepare(`${selectEntry} WHERE ${sampleVisibilitySql()} ORDER BY e.created_at DESC`)
    .all("", sampleVisibilityFlag()) as EntryRow[];
  return rows.map(toReview);
}

export type ImageVariant = "thumb" | "vote";

export function photoImageKey(
  id: string,
  variant: ImageVariant,
  reviewer: boolean,
): { key: string; approved: boolean } | null {
  const row = getDb()
    .prepare("SELECT status, vote_key, thumb_key FROM photo_entries WHERE id = ?")
    .get(id) as { status: PhotoStatus; vote_key: string; thumb_key: string } | undefined;
  if (!row) return null;
  const onAPublicLink = row.status === "pending" || row.status === "approved";
  if (!onAPublicLink && !reviewer) return null;
  if ((row.vote_key.startsWith("local-sample/") || row.thumb_key.startsWith("local-sample/")) && !samplePhotosEnabled()) {
    return null;
  }
  return {
    key: variant === "thumb" ? row.thumb_key : row.vote_key,
    approved: row.status === "approved",
  };
}

export async function createUpload(input: {
  contentType: string;
  contentLength: number;
}): Promise<
  | { ok: true; uploadId: string; uploadUrl: string; contentType: string }
  | { ok: false; code: "PHOTOS_UNAVAILABLE"; message: string }
> {
  const storage = getPhotoStorage();
  if (!storage) {
    return {
      ok: false,
      code: "PHOTOS_UNAVAILABLE",
      message: "Photo uploads aren't available right now.",
    };
  }

  const uploadId = crypto.randomUUID();
  const objectKey = `originals/${uploadId}`;
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO photo_uploads (id, object_key, content_type, content_length, created_at, consumed_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
    .run(uploadId, objectKey, input.contentType, input.contentLength, createdAt);

  try {
    const uploadUrl = await storage.presignPut(objectKey, input.contentType, input.contentLength);
    return { ok: true, uploadId, uploadUrl, contentType: input.contentType };
  } catch (error) {
    getDb().prepare("DELETE FROM photo_uploads WHERE id = ?").run(uploadId);
    throw error;
  }
}

function loadUpload(uploadId: string): UploadRow | undefined {
  return getDb().prepare("SELECT * FROM photo_uploads WHERE id = ?").get(uploadId) as UploadRow | undefined;
}

/** Checks that an email or phone is usable. The same contact may enter again. */
export function checkPhotoContact(input: {
  email?: unknown;
  phone?: unknown;
}): { ok: true } | { ok: false; code: string; message: string; fields: FieldErrors } {
  const contact = parsePhotoContact(input);
  if (Object.keys(contact.fields).length > 0 || (!contact.email && !contact.phone)) {
    const messages = [...new Set(Object.values(contact.fields))];
    return {
      ok: false,
      code: "VALIDATION",
      message: messages.length === 1 ? messages[0] : "Check the fields below and try again.",
      fields: contact.fields,
    };
  }
  return { ok: true };
}

const OWNED_PHOTO_LIMIT = 40;

function boardStandings(): Map<string, { rank: number; votesFromTopTwo: number | null }> {
  ensureSamplePhotos();
  const rows = getDb()
    .prepare(
      `SELECT
         e.id,
         e.created_at,
         (SELECT COUNT(*) FROM photo_votes v WHERE v.photo_id = e.id) AS vote_count,
         (SELECT COUNT(*) FROM photo_swipes s WHERE s.photo_id = e.id AND s.action = 'skip') AS skip_count
       FROM photo_entries e
       WHERE e.status = 'approved' AND ${sampleVisibilitySql()}`,
    )
    .all(sampleVisibilityFlag()) as { id: string; created_at: string; vote_count: number; skip_count: number }[];
  rows.sort((a, b) => {
    const score = compareLeaderboard(
      { voteCount: Number(a.vote_count), skipCount: Number(a.skip_count) },
      { voteCount: Number(b.vote_count), skipCount: Number(b.skip_count) },
    );
    if (score !== 0) return score;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  });
  return standingsFor(rows.map((row) => ({ id: row.id, voteCount: Number(row.vote_count) })));
}

function toOwned(row: EntryRow, standings: Map<string, { rank: number; votesFromTopTwo: number | null }>): OwnedPhoto {
  const standing = row.status === "approved" ? standings.get(row.id) : undefined;
  return {
    ...toPublic(row),
    status: row.status === "approved" ? "approved" : "pending",
    rank: standing?.rank ?? null,
    votesFromTopTwo: standing?.votesFromTopTwo ?? null,
  };
}

/** Photos this browser already saved. Rejected and removed rows stay off the list. */
export function listOwnedPhotos(ids: readonly string[], voterId: string | null): OwnedPhoto[] {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))].slice(0, OWNED_PHOTO_LIMIT);
  if (unique.length === 0) return [];
  ensureSamplePhotos();
  const placeholders = unique.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `${selectEntry}
       WHERE e.id IN (${placeholders}) AND ${linkedPhotoSql()} AND ${sampleVisibilitySql()}
       ORDER BY e.created_at DESC`,
    )
    .all(voterId ?? "", ...unique, sampleVisibilityFlag()) as EntryRow[];
  const standings = boardStandings();
  return rows.map((row) => toOwned(row, standings));
}

/** Every pending or approved photo for an email or phone. An unknown contact is an empty list. */
export function findOwnedPhotosByContact(
  input: { email?: unknown; phone?: unknown },
  voterId: string | null,
): { ok: true; photos: OwnedPhoto[] } | { ok: false; code: string; message: string; fields: FieldErrors } {
  const checked = checkPhotoContact(input);
  if (!checked.ok) return checked;
  const contact = parsePhotoContact(input);
  ensureSamplePhotos();
  const clauses: string[] = [];
  const params: string[] = [];
  if (contact.email) {
    clauses.push("lower(e.email) = ?");
    params.push(contact.email);
  }
  if (contact.phone) {
    clauses.push("e.phone = ?");
    params.push(contact.phone);
  }
  const rows = getDb()
    .prepare(
      `${selectEntry}
       WHERE (${clauses.join(" OR ")}) AND ${linkedPhotoSql()} AND ${sampleVisibilitySql()}
       ORDER BY e.created_at DESC
       LIMIT ${OWNED_PHOTO_LIMIT}`,
    )
    .all(voterId ?? "", ...params, sampleVisibilityFlag()) as EntryRow[];
  const standings = boardStandings();
  return { ok: true, photos: rows.map((row) => toOwned(row, standings)) };
}

export async function submitPhoto(input: {
  uploadId: string;
  personName: unknown;
  email: unknown;
  phone?: unknown;
  drinkName: unknown;
  caption: unknown;
  crop?: PhotoCrop | null;
}): Promise<
  | { ok: true; id: string; code: string; status: "pending" | "approved" }
  | { ok: false; code: string; message: string; fields?: FieldErrors }
> {
  const parsed = validatePhotoEntry(input);
  if (!parsed.ok) return { ok: false, code: "VALIDATION", message: parsed.message, fields: parsed.fields };
  if (!isUuid(input.uploadId)) {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }

  const storage = getPhotoStorage();
  if (!storage) {
    return { ok: false, code: "PHOTOS_UNAVAILABLE", message: "Photo uploads aren't available right now." };
  }

  const upload = loadUpload(input.uploadId);
  if (!upload) {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }

  if (upload.consumed_at) {
    const existing = getDb()
      .prepare("SELECT id, public_code FROM photo_entries WHERE original_key = ?")
      .get(upload.object_key) as { id: string; public_code: string | null } | undefined;
    if (existing) {
      const row = getDb()
        .prepare("SELECT status, public_code FROM photo_entries WHERE id = ?")
        .get(existing.id) as { status: string; public_code: string | null } | undefined;
      return {
        ok: true,
        id: existing.id,
        code: row?.public_code || existing.public_code || "",
        status: row?.status === "approved" ? "approved" : "pending",
      };
    }
    return { ok: false, code: "UPLOAD_USED", message: "That upload was already used. Choose the photo again." };
  }

  if (upload.prepare_status === "discarded") {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }

  const createdAt = new Date(upload.created_at).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > UPLOAD_TTL_MS) {
    await discardUpload(upload.id);
    return { ok: false, code: "UPLOAD_EXPIRED", message: "That upload expired. Choose the photo again." };
  }

  if (input.crop) {
    const framed = await saveUploadCrop(upload.id, input.crop);
    if (!framed.ok) return framed;
  }

  const prepared = await prepareUpload(upload.id);
  if (!prepared.ok) return prepared;

  const ready = loadUpload(upload.id);
  const voteKey = ready?.vote_key || voteKeyForUpload(upload.id);
  const thumbKey = ready?.thumb_key || thumbKeyForUpload(upload.id);
  if (!ready || ready.prepare_status !== "ready" || ready.consumed_at) {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }
  const voteReady = await storage.head(voteKey);
  const thumbReady = await storage.head(thumbKey);
  if (!voteReady || !thumbReady) {
    return { ok: false, code: "NOT_AN_IMAGE", message: "That photo didn't arrive. Choose it and try again." };
  }

  const photoId = crypto.randomUUID();
  const db = beginImmediate();
  try {
    const now = new Date().toISOString();
    const status: "pending" | "approved" = photoReviewBypassed() ? "approved" : "pending";
    const publicCode = takePhotoCode();
    db.prepare(
      `INSERT INTO photo_entries (
        id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, reviewed_at, public_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      photoId,
      parsed.value.personName,
      parsed.value.email,
      parsed.value.phone,
      parsed.value.drinkName,
      parsed.value.caption,
      status,
      upload.object_key,
      upload.content_type,
      voteKey,
      thumbKey,
      now,
      status === "approved" ? now : null,
      publicCode,
    );
    db.prepare("UPDATE photo_uploads SET consumed_at = ? WHERE id = ?").run(now, upload.id);
    db.exec("COMMIT");
  } catch (error) {
    rollbackQuietly();
    if (isUniqueConstraint(error)) {
      return { ok: false, code: "SERVER", message: "That photo didn't go through. Try again." };
    }
    throw error;
  }

  const saved = getDb().prepare("SELECT status, public_code FROM photo_entries WHERE id = ?").get(photoId) as
    | { status: string; public_code: string | null }
    | undefined;
  return {
    ok: true,
    id: photoId,
    code: saved?.public_code || "",
    status: saved?.status === "approved" ? "approved" : "pending",
  };
}

export function castPhotoVote(
  photoId: string,
  voterId: string,
  networkHash?: string | null,
): { ok: true; photo: PublicPhoto } | { ok: false; code: "NOT_FOUND" | "ALREADY_VOTED" | "NETWORK_LIMIT" } {
  const db = beginImmediate();
  try {
    const photo = db
      .prepare("SELECT 1 AS found FROM photo_entries WHERE id = ? AND status IN ('pending', 'approved')")
      .get(photoId);
    if (!photo) {
      db.exec("ROLLBACK");
      return { ok: false, code: "NOT_FOUND" };
    }
    const existing = db
      .prepare("SELECT 1 AS found FROM photo_votes WHERE photo_id = ? AND voter_id = ?")
      .get(photoId, voterId);
    if (existing) {
      db.exec("ROLLBACK");
      return { ok: false, code: "ALREADY_VOTED" };
    }
    const now = new Date().toISOString();
    if (networkVoteLimitReached(db, photoId, networkHash, now)) {
      db.exec("ROLLBACK");
      return { ok: false, code: "NETWORK_LIMIT" };
    }
    db.prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at, network_hash) VALUES (?, ?, ?, ?)").run(
      photoId,
      voterId,
      now,
      networkHash ?? null,
    );
    db.exec("COMMIT");
  } catch (error) {
    rollbackQuietly();
    if (isUniqueConstraint(error)) return { ok: false, code: "ALREADY_VOTED" };
    throw error;
  }

  const photo = getPublicPhoto(photoId, voterId);
  if (!photo) return { ok: false, code: "NOT_FOUND" };
  return { ok: true, photo };
}

export function moderatePhoto(
  id: string,
  action: "approve" | "reject" | "remove",
): { ok: true; photo: ReviewPhoto } | { ok: false; code: "NOT_FOUND" | "BAD_ACTION" } {
  const db = beginImmediate();
  try {
    const row = db.prepare("SELECT status FROM photo_entries WHERE id = ?").get(id) as
      | { status: PhotoStatus }
      | undefined;
    if (!row) {
      db.exec("ROLLBACK");
      return { ok: false, code: "NOT_FOUND" };
    }

    let next: PhotoStatus | null = null;
    if (action === "approve" && (row.status === "pending" || row.status === "rejected" || row.status === "removed")) {
      next = "approved";
    } else if (action === "reject" && row.status === "pending") {
      next = "rejected";
    } else if (action === "remove" && row.status === "approved") {
      next = "removed";
    }
    if (!next) {
      db.exec("ROLLBACK");
      return { ok: false, code: "BAD_ACTION" };
    }

    db.prepare("UPDATE photo_entries SET status = ?, reviewed_at = ? WHERE id = ?").run(
      next,
      new Date().toISOString(),
      id,
    );
    db.exec("COMMIT");
  } catch (error) {
    rollbackQuietly();
    throw error;
  }

  const photo = getDb().prepare(`${selectEntry} WHERE e.id = ?`).get("", id) as EntryRow | undefined;
  if (!photo) return { ok: false, code: "NOT_FOUND" };
  return { ok: true, photo: toReview(photo) };
}
