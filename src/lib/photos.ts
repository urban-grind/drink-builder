import { beginImmediate, getDb, isUniqueConstraint, rollbackQuietly } from "@/lib/db";
import { contentTypeMatches, detectImageType, makeBoardImages } from "@/lib/photo-image";
import { isUuid } from "@/lib/validation";
import { getPhotoStorage, type PhotoStorage } from "@/lib/r2";
import type { PhotoStatus, PublicPhoto, ReviewPhoto } from "@/lib/photo-types";
import { validatePhotoEntry } from "@/lib/photo-validation";
import type { FieldErrors } from "@/lib/types";

const UPLOAD_TTL_MS = 30 * 60 * 1000;
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
};

type EntryRow = {
  id: string;
  person_name: string;
  email: string;
  drink_name: string;
  caption: string;
  status: PhotoStatus;
  original_key: string;
  content_type: string;
  vote_key: string;
  thumb_key: string;
  created_at: string;
  reviewed_at: string | null;
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
  return {
    id: row.id,
    personName: row.person_name,
    drinkName: row.drink_name,
    caption: row.caption,
    createdAt: row.created_at,
    voteCount: Number(row.vote_count),
    voted: Number(row.voted) === 1,
    thumbUrl: thumbUrl(row.id),
    imageUrl: imageUrl(row.id),
  };
}

function toReview(row: EntryRow): ReviewPhoto {
  return { ...toPublic(row), email: row.email, status: row.status };
}

const selectEntry = `
  SELECT
    e.id,
    e.person_name,
    e.email,
    e.drink_name,
    e.caption,
    e.status,
    e.original_key,
    e.content_type,
    e.vote_key,
    e.thumb_key,
    e.created_at,
    e.reviewed_at,
    (SELECT COUNT(*) FROM photo_votes v WHERE v.photo_id = e.id) AS vote_count,
    EXISTS(
      SELECT 1 FROM photo_votes v WHERE v.photo_id = e.id AND v.voter_id = ?
    ) AS voted
  FROM photo_entries e
`;

function queryPhotos(sort: "top" | "newest", voterId: string): PublicPhoto[] {
  const order =
    sort === "top" ? "ORDER BY vote_count DESC, e.created_at DESC" : "ORDER BY e.created_at DESC";
  const rows = getDb()
    .prepare(`${selectEntry} WHERE e.status = 'approved' ${order}`)
    .all(voterId) as EntryRow[];
  return rows.map(toPublic);
}

export function listPhotoBoard(voterId: string | null): { popular: PublicPhoto[]; newest: PublicPhoto[] } {
  const voter = voterId ?? "";
  return {
    popular: queryPhotos("top", voter),
    newest: queryPhotos("newest", voter).slice(0, NEW_PHOTO_LIMIT),
  };
}

export function getPublicPhoto(id: string, voterId: string | null): PublicPhoto | null {
  const row = getDb()
    .prepare(`${selectEntry} WHERE e.id = ? AND e.status = 'approved'`)
    .get(voterId ?? "", id) as EntryRow | undefined;
  return row ? toPublic(row) : null;
}

export function listReviewPhotos(): ReviewPhoto[] {
  const rows = getDb()
    .prepare(`${selectEntry} ORDER BY e.created_at DESC`)
    .all("") as EntryRow[];
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
  if (row.status !== "approved" && !reviewer) return null;
  return {
    key: variant === "thumb" ? row.thumb_key : row.vote_key,
    approved: row.status === "approved",
  };
}

async function deleteQuietly(storage: PhotoStorage, key: string): Promise<void> {
  try {
    await storage.delete(key);
  } catch {
    // The object may already be gone.
  }
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

function markConsumed(uploadId: string): void {
  getDb()
    .prepare("UPDATE photo_uploads SET consumed_at = ? WHERE id = ?")
    .run(new Date().toISOString(), uploadId);
}

export async function submitPhoto(input: {
  uploadId: string;
  personName: unknown;
  email: unknown;
  drinkName: unknown;
  caption: unknown;
}): Promise<
  | { ok: true; id: string; status: "pending" | "approved" }
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
      .prepare("SELECT id FROM photo_entries WHERE original_key = ?")
      .get(upload.object_key) as { id: string } | undefined;
    if (existing) {
      const row = getDb()
        .prepare("SELECT status FROM photo_entries WHERE id = ?")
        .get(existing.id) as { status: string } | undefined;
      return { ok: true, id: existing.id, status: row?.status === "approved" ? "approved" : "pending" };
    }
    return { ok: false, code: "UPLOAD_USED", message: "That upload was already used. Choose the photo again." };
  }

  const createdAt = new Date(upload.created_at).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > UPLOAD_TTL_MS) {
    markConsumed(upload.id);
    await deleteQuietly(storage, upload.object_key);
    return { ok: false, code: "UPLOAD_EXPIRED", message: "That upload expired. Choose the photo again." };
  }

  const head = await storage.head(upload.object_key);
  if (!head) {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That photo didn't arrive. Choose it and try again." };
  }
  if (head.contentLength !== upload.content_length || head.contentLength < 1) {
    markConsumed(upload.id);
    await deleteQuietly(storage, upload.object_key);
    return { ok: false, code: "NOT_AN_IMAGE", message: "That photo didn't match the file you chose." };
  }

  const original = await storage.get(upload.object_key);
  if (!original || original.length !== upload.content_length) {
    markConsumed(upload.id);
    if (original) await deleteQuietly(storage, upload.object_key);
    return { ok: false, code: "NOT_AN_IMAGE", message: "That photo didn't match the file you chose." };
  }

  const kind = detectImageType(original);
  if (!kind || !contentTypeMatches(upload.content_type, kind)) {
    markConsumed(upload.id);
    await deleteQuietly(storage, upload.object_key);
    return { ok: false, code: "NOT_AN_IMAGE", message: "That file isn't a JPEG, PNG, WebP, or HEIC photo." };
  }

  const images = await makeBoardImages(original);
  if ("error" in images) {
    markConsumed(upload.id);
    await deleteQuietly(storage, upload.object_key);
    return { ok: false, code: "NOT_AN_IMAGE", message: images.error };
  }

  const photoId = crypto.randomUUID();
  const voteKey = `board/${crypto.randomUUID()}-vote.webp`;
  const thumbKey = `board/${crypto.randomUUID()}-thumb.webp`;
  await storage.put(voteKey, images.vote, "image/webp");
  await storage.put(thumbKey, images.thumb, "image/webp");

  const db = beginImmediate();
  try {
    const emailTaken = db.prepare("SELECT 1 AS found FROM photo_entries WHERE email = ?").get(parsed.value.email);
    if (emailTaken) {
      db.exec("ROLLBACK");
      await deleteQuietly(storage, voteKey);
      await deleteQuietly(storage, thumbKey);
      await deleteQuietly(storage, upload.object_key);
      markConsumed(upload.id);
      return {
        ok: false,
        code: "EMAIL_IN_USE",
        message: "That email already has a photo in.",
        fields: { email: "That email already has a photo in." },
      };
    }

    const now = new Date().toISOString();
    const status: "pending" | "approved" = photoReviewBypassed() ? "approved" : "pending";
    db.prepare(
      `INSERT INTO photo_entries (
        id, person_name, email, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      photoId,
      parsed.value.personName,
      parsed.value.email,
      parsed.value.drinkName,
      parsed.value.caption,
      status,
      upload.object_key,
      upload.content_type,
      voteKey,
      thumbKey,
      now,
      status === "approved" ? now : null,
    );
    db.prepare("UPDATE photo_uploads SET consumed_at = ? WHERE id = ?").run(now, upload.id);
    db.exec("COMMIT");
  } catch (error) {
    rollbackQuietly();
    await deleteQuietly(storage, voteKey);
    await deleteQuietly(storage, thumbKey);
    if (isUniqueConstraint(error)) {
      await deleteQuietly(storage, upload.object_key);
      markConsumed(upload.id);
      return {
        ok: false,
        code: "EMAIL_IN_USE",
        message: "That email already has a photo in.",
        fields: { email: "That email already has a photo in." },
      };
    }
    throw error;
  }

  const saved = getDb().prepare("SELECT status FROM photo_entries WHERE id = ?").get(photoId) as
    | { status: string }
    | undefined;
  return { ok: true, id: photoId, status: saved?.status === "approved" ? "approved" : "pending" };
}

export function castPhotoVote(
  photoId: string,
  voterId: string,
): { ok: true; photo: PublicPhoto } | { ok: false; code: "NOT_FOUND" | "ALREADY_VOTED" } {
  const db = beginImmediate();
  try {
    const photo = db
      .prepare("SELECT 1 AS found FROM photo_entries WHERE id = ? AND status = 'approved'")
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
    db.prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at) VALUES (?, ?, ?)").run(
      photoId,
      voterId,
      new Date().toISOString(),
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
