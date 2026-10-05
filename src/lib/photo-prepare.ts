import { getDb } from "@/lib/db";
import { cropKey, parsePhotoCrop, type PhotoCrop } from "@/lib/photo-crop";
import { contentTypeMatches, detectImageType, makeBoardImages } from "@/lib/photo-image";
import { withResizeSlot } from "@/lib/resize-queue";
import { getPhotoStorage, type PhotoStorage } from "@/lib/r2";
import { isUuid } from "@/lib/validation";

export const UPLOAD_TTL_MS = 30 * 60 * 1000;

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
  crop: string | null;
  crop_version: number | bigint | null;
  crop_rendered: number | bigint | null;
};

export type PrepareResult = { ok: true } | { ok: false; code: string; message: string };

const inflight = new Map<string, Promise<PrepareResult>>();

let prepareHook: (() => Promise<void> | void) | null = null;

/** Test-only gap after a resize, before its files are kept. */
export function setPrepareHookForTests(hook: (() => Promise<void> | void) | null): void {
  prepareHook = hook;
}

function loadUpload(uploadId: string): UploadRow | undefined {
  return getDb().prepare("SELECT * FROM photo_uploads WHERE id = ?").get(uploadId) as UploadRow | undefined;
}

function generationOf(row: UploadRow): number {
  return Number(row.prepare_generation ?? 0);
}

function cropVersionOf(row: UploadRow): number {
  return Number(row.crop_version ?? 0);
}

export function voteKeyForUpload(uploadId: string): string {
  return `board/${uploadId}-vote.webp`;
}

export function thumbKeyForUpload(uploadId: string): string {
  return `board/${uploadId}-thumb.webp`;
}

export function previewKeyForUpload(uploadId: string): string {
  return `board/${uploadId}-preview.webp`;
}

async function deleteQuietly(storage: PhotoStorage, key: string | null): Promise<void> {
  if (!key) return;
  try {
    await storage.delete(key);
  } catch {
    // The object may already be gone.
  }
}

function changes(result: { changes: number | bigint }): number {
  return Number(result.changes);
}

/** Deletes a photo that never became a contest entry. An entry's files stay put. */
export async function discardUpload(uploadId: string): Promise<{ ok: true } | PrepareResult> {
  if (!isUuid(uploadId)) {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }
  const upload = loadUpload(uploadId);
  if (!upload || upload.consumed_at) return { ok: true };

  getDb()
    .prepare(
      `UPDATE photo_uploads
       SET prepare_status = 'discarded', prepare_generation = prepare_generation + 1
       WHERE id = ? AND consumed_at IS NULL`,
    )
    .run(uploadId);

  const storage = getPhotoStorage();
  if (storage) {
    await deleteQuietly(storage, upload.object_key);
    await deleteQuietly(storage, upload.vote_key ?? voteKeyForUpload(uploadId));
    await deleteQuietly(storage, upload.thumb_key ?? thumbKeyForUpload(uploadId));
    await deleteQuietly(storage, previewKeyForUpload(uploadId));
  }
  return { ok: true };
}

function replaced(): PrepareResult {
  return { ok: false, code: "UPLOAD_REPLACED", message: "That photo was replaced. Choose it again." };
}

/**
 * Resizes one upload into its voting copies. A second call shares the same work.
 * A discarded or replaced upload cannot keep files written by a slow resize.
 */
export function prepareUpload(uploadId: string): Promise<PrepareResult> {
  const existing = inflight.get(uploadId);
  if (existing) return existing;
  const task = runPrepare(uploadId).finally(() => {
    if (inflight.get(uploadId) === task) inflight.delete(uploadId);
  });
  inflight.set(uploadId, task);
  return task;
}

async function runPrepare(uploadId: string): Promise<PrepareResult> {
  if (!isUuid(uploadId)) {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }
  const storage = getPhotoStorage();
  if (!storage) {
    return { ok: false, code: "PHOTOS_UNAVAILABLE", message: "Photo uploads aren't available right now." };
  }

  const row = loadUpload(uploadId);
  if (!row) {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }
  if (row.consumed_at || row.prepare_status === "ready") return { ok: true };
  if (row.prepare_status === "discarded") return replaced();
  if (row.prepare_status === "failed") {
    return {
      ok: false,
      code: "NOT_AN_IMAGE",
      message: row.prepare_error || "That file isn't a JPEG, PNG, WebP, or HEIC photo.",
    };
  }

  const createdAt = new Date(row.created_at).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > UPLOAD_TTL_MS) {
    await discardUpload(uploadId);
    return { ok: false, code: "UPLOAD_EXPIRED", message: "That upload expired. Choose the photo again." };
  }

  const generation = generationOf(row);
  const voteKey = voteKeyForUpload(uploadId);
  const thumbKey = thumbKeyForUpload(uploadId);
  const claimed = getDb()
    .prepare(
      `UPDATE photo_uploads
       SET vote_key = ?, thumb_key = ?, prepare_status = 'preparing', prepare_error = NULL
       WHERE id = ? AND consumed_at IS NULL AND prepare_generation = ?
         AND COALESCE(prepare_status, '') NOT IN ('discarded', 'ready')`,
    )
    .run(voteKey, thumbKey, uploadId, generation);
  if (changes(claimed) === 0) {
    const again = loadUpload(uploadId);
    if (again?.consumed_at || again?.prepare_status === "ready") return { ok: true };
    return replaced();
  }

  const head = await storage.head(row.object_key);
  if (!head || head.contentLength !== row.content_length || head.contentLength < 1) {
    return failPrepare(uploadId, generation, storage, row.object_key, voteKey, thumbKey, {
      ok: false,
      code: "UPLOAD_NOT_FOUND",
      message: "That photo didn't arrive. Choose it and try again.",
    });
  }

  const original = await storage.get(row.object_key);
  if (!original || original.length !== row.content_length) {
    return failPrepare(uploadId, generation, storage, row.object_key, voteKey, thumbKey, {
      ok: false,
      code: "NOT_AN_IMAGE",
      message: "That photo didn't match the file you chose.",
    });
  }

  const kind = detectImageType(original);
  if (!kind || !contentTypeMatches(row.content_type, kind)) {
    return failPrepare(uploadId, generation, storage, row.object_key, voteKey, thumbKey, {
      ok: false,
      code: "NOT_AN_IMAGE",
      message: "That file isn't a JPEG, PNG, WebP, or HEIC photo.",
    });
  }

  let hooked = false;
  while (true) {
    const framing = loadUpload(uploadId);
    if (!framing || framing.prepare_status === "discarded" || generationOf(framing) !== generation) {
      return replaced();
    }
    const version = cropVersionOf(framing);
    const images = await withResizeSlot(() => makeBoardImages(original, parsePhotoCrop(framing.crop)));
    if ("error" in images) {
      return failPrepare(uploadId, generation, storage, row.object_key, voteKey, thumbKey, {
        ok: false,
        code: "NOT_AN_IMAGE",
        message: images.error,
      });
    }
    if (!hooked) {
      hooked = true;
      if (prepareHook) await prepareHook();
    }

    const current = loadUpload(uploadId);
    if (!current || current.prepare_status === "discarded" || generationOf(current) !== generation) {
      return replaced();
    }
    if (cropVersionOf(current) !== version) continue;

    await storage.put(voteKey, images.vote, "image/webp");
    await storage.put(thumbKey, images.thumb, "image/webp");

    const saved = getDb()
      .prepare(
        `UPDATE photo_uploads
         SET prepare_status = 'ready', crop_rendered = ?
         WHERE id = ? AND prepare_status = 'preparing' AND prepare_generation = ? AND crop_version = ?`,
      )
      .run(version, uploadId, generation, version);
    if (changes(saved) > 0) return { ok: true };
    const again = loadUpload(uploadId);
    if (!again || again.prepare_status === "discarded" || generationOf(again) !== generation) {
      await deleteQuietly(storage, voteKey);
      await deleteQuietly(storage, thumbKey);
      return replaced();
    }
    if (cropVersionOf(again) !== version) continue;
    await deleteQuietly(storage, voteKey);
    await deleteQuietly(storage, thumbKey);
    return replaced();
  }
}

/**
 * Remembers how the card should be framed and rebuilds the swipe and leaderboard copies.
 * The original file stays whole. A prepare already in flight picks up the new frame.
 */
export async function saveUploadCrop(uploadId: string, crop: PhotoCrop): Promise<PrepareResult> {
  if (!isUuid(uploadId)) {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }
  const upload = loadUpload(uploadId);
  if (!upload || upload.consumed_at || upload.prepare_status === "discarded") {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }
  if (upload.prepare_status === "failed") {
    return {
      ok: false,
      code: "NOT_AN_IMAGE",
      message: upload.prepare_error || "That photo couldn't be prepared. Try a different image.",
    };
  }

  const key = cropKey(crop);
  if (upload.crop !== key) {
    const saved = getDb()
      .prepare(
        `UPDATE photo_uploads
         SET crop = ?, crop_version = crop_version + 1
         WHERE id = ? AND consumed_at IS NULL AND COALESCE(prepare_status, '') != 'discarded'`,
      )
      .run(key, uploadId);
    if (changes(saved) === 0) {
      return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
    }
  }

  const pending = inflight.get(uploadId);
  if (pending) await pending;

  const current = loadUpload(uploadId);
  if (!current || current.consumed_at || current.prepare_status === "discarded") {
    return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
  }
  if (current.prepare_status !== "ready") return { ok: true };
  if (current.crop === key && cropVersionOf(current) === Number(current.crop_rendered ?? -1)) return { ok: true };
  return rerenderReadyCrop(uploadId);
}

function rerenderReadyCrop(uploadId: string): Promise<PrepareResult> {
  const existing = inflight.get(uploadId);
  if (existing) return existing;
  const task = writeReadyCrop(uploadId).finally(() => {
    if (inflight.get(uploadId) === task) inflight.delete(uploadId);
  });
  inflight.set(uploadId, task);
  return task;
}

async function writeReadyCrop(uploadId: string): Promise<PrepareResult> {
  const storage = getPhotoStorage();
  if (!storage) {
    return { ok: false, code: "PHOTOS_UNAVAILABLE", message: "Photo uploads aren't available right now." };
  }

  while (true) {
    const row = loadUpload(uploadId);
    if (!row || row.consumed_at || row.prepare_status === "discarded") {
      return { ok: false, code: "UPLOAD_NOT_FOUND", message: "That upload wasn't found. Choose the photo again." };
    }
    if (row.prepare_status !== "ready") return { ok: true };
    const version = cropVersionOf(row);
    if (version === Number(row.crop_rendered ?? -1)) return { ok: true };

    const original = await storage.get(row.object_key);
    if (!original) {
      return { ok: false, code: "NOT_AN_IMAGE", message: "That photo didn't arrive. Choose it and try again." };
    }
    const images = await withResizeSlot(() => makeBoardImages(original, parsePhotoCrop(row.crop)));
    if ("error" in images) {
      return { ok: false, code: "NOT_AN_IMAGE", message: images.error };
    }

    const current = loadUpload(uploadId);
    if (!current || current.consumed_at || current.prepare_status !== "ready" || cropVersionOf(current) !== version) {
      continue;
    }
    const voteKey = current.vote_key ?? voteKeyForUpload(uploadId);
    const thumbKey = current.thumb_key ?? thumbKeyForUpload(uploadId);
    await storage.put(voteKey, images.vote, "image/webp");
    await storage.put(thumbKey, images.thumb, "image/webp");
    const saved = getDb()
      .prepare(
        `UPDATE photo_uploads
         SET crop_rendered = ?
         WHERE id = ? AND prepare_status = 'ready' AND consumed_at IS NULL AND crop_version = ?`,
      )
      .run(version, uploadId, version);
    if (changes(saved) > 0) return { ok: true };
  }
}

/** The upright photo used to frame a crop. It is not replaced when the card copies are cropped. */
export async function readUploadPreview(uploadId: string): Promise<Buffer | null> {
  if (!isUuid(uploadId)) return null;
  const row = loadUpload(uploadId);
  if (!row || row.consumed_at || row.prepare_status === "discarded" || row.prepare_status === "failed") return null;
  const storage = getPhotoStorage();
  if (!storage) return null;
  const key = previewKeyForUpload(uploadId);
  const saved = await storage.get(key);
  if (saved) return saved;

  const original = await storage.get(row.object_key);
  if (!original) return null;
  const images = await withResizeSlot(() => makeBoardImages(original, null));
  if ("error" in images) return null;
  const current = loadUpload(uploadId);
  if (!current || current.consumed_at || current.prepare_status === "discarded") return null;
  await storage.put(key, images.vote, "image/webp");
  return images.vote;
}

async function failPrepare(
  uploadId: string,
  generation: number,
  storage: PhotoStorage,
  originalKey: string,
  voteKey: string,
  thumbKey: string,
  result: PrepareResult,
): Promise<PrepareResult> {
  const message = result.ok ? "" : result.message;
  const updated = getDb()
    .prepare(
      `UPDATE photo_uploads
       SET prepare_status = 'failed', prepare_error = ?
       WHERE id = ? AND prepare_status = 'preparing' AND prepare_generation = ?`,
    )
    .run(message, uploadId, generation);
  await deleteQuietly(storage, originalKey);
  await deleteQuietly(storage, voteKey);
  await deleteQuietly(storage, thumbKey);
  if (changes(updated) === 0) return replaced();
  return result;
}
