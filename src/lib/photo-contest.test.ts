import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import piexif from "piexifjs";
import { resetDbForTests, getDb } from "@/lib/db";
import { decodeHeicWithWasm, makeBoardImages, VOTE_LONG_EDGE, THUMB_LONG_EDGE } from "@/lib/photo-image";
import { DELETE } from "@/app/api/photos/[id]/vote/route";
import {
  castPhotoVote,
  createUpload,
  getPublicPhoto,
  listPhotoBoard,
  listReviewPhotos,
  moderatePhoto,
  submitPhoto,
} from "@/lib/photos";
import { parsePhotoUploadRequest, validatePhotoEntry } from "@/lib/photo-validation";
import { getPhotoStorage, readR2Config, setPhotoStorageForTests, type PhotoStorage } from "@/lib/r2";

process.env.DRINK_DB_PATH = path.join(os.tmpdir(), `urban-grind-photos-${process.pid}.sqlite`);

const r2Keys = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
] as const;

function clearR2Env(): void {
  for (const key of r2Keys) delete process.env[key];
  delete process.env.PHOTO_REVIEW_PASSWORD;
  delete process.env.PHOTO_SKIP_REVIEW;
}

class MemoryStorage implements PhotoStorage {
  objects = new Map<string, { body: Buffer; contentType: string }>();
  presigns: { key: string; contentType: string; contentLength: number }[] = [];

  async presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
    this.presigns.push({ key, contentType, contentLength });
    return `https://example.test/${key}`;
  }

  async head(key: string) {
    const object = this.objects.get(key);
    if (!object) return null;
    return { contentLength: object.body.length, contentType: object.contentType };
  }

  async get(key: string) {
    return this.objects.get(key)?.body ?? null;
  }

  async put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body: Buffer.from(body), contentType });
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

function uploadKey(uploadId: string): string {
  const row = getDb().prepare("SELECT object_key FROM photo_uploads WHERE id = ?").get(uploadId) as
    | { object_key: string }
    | undefined;
  if (!row) throw new Error("missing upload");
  return row.object_key;
}

async function jpegWithGps(): Promise<{ bytes: Buffer; width: number; height: number }> {
  const width = 32;
  const height = 16;
  const plain = await sharp({
    create: { width, height, channels: 3, background: { r: 220, g: 30, b: 40 } },
  })
    .jpeg()
    .toBuffer();
  const zeroth: Record<number, number> = {};
  zeroth[piexif.ImageIFD.Orientation] = 6;
  const gps: Record<number, string | number[][]> = {};
  gps[piexif.GPSIFD.GPSLatitudeRef] = "N";
  gps[piexif.GPSIFD.GPSLatitude] = [
    [43, 1],
    [30, 1],
    [0, 1],
  ];
  gps[piexif.GPSIFD.GPSLongitudeRef] = "W";
  gps[piexif.GPSIFD.GPSLongitude] = [
    [79, 1],
    [40, 1],
    [0, 1],
  ];
  const dumped = piexif.dump({ "0th": zeroth, GPS: gps });
  const inserted = piexif.insert(dumped, plain.toString("binary"));
  return { bytes: Buffer.from(inserted, "binary"), width, height };
}

describe("photo contest", { concurrency: false }, () => {
  const storage = new MemoryStorage();

  before(() => {
    clearR2Env();
    resetDbForTests();
    fs.rmSync(process.env.DRINK_DB_PATH ?? "", { force: true });
    setPhotoStorageForTests(storage);
  });

  after(() => {
    setPhotoStorageForTests(null);
    clearR2Env();
    resetDbForTests();
    fs.rmSync(process.env.DRINK_DB_PATH ?? "", { force: true });
  });

  it("keeps uploads off until the secret is set", async () => {
    setPhotoStorageForTests(null);
    process.env.R2_ACCOUNT_ID = "example-account";
    process.env.R2_ACCESS_KEY_ID = "example-access-key";
    process.env.R2_BUCKET = "example-bucket";
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    delete process.env.R2_SECRET_ACCESS_KEY;
    assert.equal(readR2Config(), null);
    assert.equal(getPhotoStorage(), null);
    const upload = await createUpload({ contentType: "image/jpeg", contentLength: 10 });
    assert.equal(upload.ok, false);
    if (!upload.ok) {
      assert.equal(upload.code, "PHOTOS_UNAVAILABLE");
      assert.match(upload.message, /aren't available/i);
    }
    clearR2Env();
    setPhotoStorageForTests(storage);
  });

  it("locks the presigned PUT to the content type and byte length", async () => {
    setPhotoStorageForTests(null);
    process.env.R2_ACCOUNT_ID = "example-account";
    process.env.R2_ACCESS_KEY_ID = "example-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "example-secret-value";
    process.env.R2_BUCKET = "example-bucket";
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    const upload = await createUpload({ contentType: "image/jpeg", contentLength: 1200 });
    assert.equal(upload.ok, true);
    if (upload.ok) {
      const url = new URL(upload.uploadUrl);
      const signed = (url.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
      assert.ok(signed.includes("content-type"));
      assert.ok(signed.includes("content-length"));
      assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
      assert.equal(url.searchParams.get("X-Amz-Content-Sha256") ?? url.searchParams.get("x-amz-content-sha256"), "UNSIGNED-PAYLOAD");
      assert.equal(upload.contentType, "image/jpeg");
      assert.doesNotMatch(url.pathname, /example-secret-value/);
    }
    clearR2Env();
    setPhotoStorageForTests(storage);
  });

  it("rejects a file over 25MB and rude wording", () => {
    const tooBig = parsePhotoUploadRequest({
      contentType: "image/jpeg",
      contentLength: 25 * 1024 * 1024 + 1,
      fileName: "cup.jpg",
    });
    assert.equal(tooBig.ok, false);
    const rude = validatePhotoEntry({
      personName: "Ada",
      email: "ada@example.com",
      drinkName: "shit latte",
      caption: "",
    });
    assert.equal(rude.ok, false);
    const heic = parsePhotoUploadRequest({
      contentType: "",
      contentLength: 1000,
      fileName: "IMG_1.HEIC",
    });
    assert.equal(heic.ok, true);
    if (heic.ok) assert.equal(heic.contentType, "image/heic");
  });

  it("fixes orientation, strips location data, and resizes", async () => {
    const source = await jpegWithGps();
    const before = await sharp(source.bytes).metadata();
    assert.equal(before.orientation, 6);
    assert.ok(before.exif && before.exif.length > 0);

    const made = await makeBoardImages(source.bytes);
    assert.ok(!("error" in made));
    if ("error" in made) return;
    const vote = await sharp(made.vote).metadata();
    const thumb = await sharp(made.thumb).metadata();
    assert.equal(vote.format, "webp");
    assert.equal(thumb.format, "webp");
    assert.equal(vote.width, source.height);
    assert.equal(vote.height, source.width);
    assert.equal(vote.exif, undefined);
    assert.ok((vote.width ?? 0) <= VOTE_LONG_EDGE);
    assert.ok((thumb.width ?? 0) <= THUMB_LONG_EDGE);
    assert.ok((thumb.height ?? 0) <= THUMB_LONG_EDGE);

    const wide = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 10, g: 40, b: 30 } },
    })
      .png()
      .toBuffer();
    const resized = await makeBoardImages(wide);
    assert.ok(!("error" in resized));
    if ("error" in resized) return;
    const resizedVote = await sharp(resized.vote).metadata();
    const resizedThumb = await sharp(resized.thumb).metadata();
    assert.equal(resizedVote.width, VOTE_LONG_EDGE);
    assert.equal(resizedVote.height, 800);
    assert.equal(resizedThumb.width, THUMB_LONG_EDGE);
    assert.equal(resizedThumb.height, 320);
  });

  it("prepares a HEIC photo, including the wasm decoder", async () => {
    const heic = fs.readFileSync(path.join(process.cwd(), "test/fixtures/sample.heic"));
    const made = await makeBoardImages(heic);
    assert.ok(!("error" in made));
    if ("error" in made) return;
    const vote = await sharp(made.vote).metadata();
    assert.equal(vote.format, "webp");
    assert.ok((vote.width ?? 0) <= VOTE_LONG_EDGE);
    assert.ok((vote.height ?? 0) <= VOTE_LONG_EDGE);
    assert.equal(vote.exif, undefined);

    const jpeg = await decodeHeicWithWasm(heic);
    const decoded = await sharp(jpeg).metadata();
    assert.equal(decoded.format, "jpeg");
    assert.ok((decoded.width ?? 0) > 0);
  });

  it("keeps the original, hides pending photos, and separates emails from drinks", async () => {
    const source = await jpegWithGps();
    const upload = await createUpload({ contentType: "image/jpeg", contentLength: source.bytes.length });
    assert.equal(upload.ok, true);
    if (!upload.ok) return;
    const key = uploadKey(upload.uploadId);
    storage.objects.set(key, { body: source.bytes, contentType: "image/jpeg" });
    assert.equal(storage.presigns.at(-1)?.contentLength, source.bytes.length);
    assert.equal(storage.presigns.at(-1)?.contentType, "image/jpeg");

    getDb()
      .prepare(
        `INSERT INTO drinks (
          id, name, description, creator_name, creator_email, base, milk, syrups, sauces, cold_foam, add_ins, created_at
        ) VALUES (?, ?, '', 'Ada', ?, 'iced-coffee', 'none', '[]', '[]', '', '[]', ?)`,
      )
      .run(crypto.randomUUID(), "Built cup", "same@example.com", new Date().toISOString());

    const saved = await submitPhoto({
      uploadId: upload.uploadId,
      personName: "Ada",
      email: "same@example.com",
      drinkName: "Window light",
      caption: "By the window",
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;

    const original = storage.objects.get(key);
    assert.ok(original);
    assert.ok(original.body.equals(source.bytes));
    const derivatives = [...storage.objects.keys()].filter((item) => item.startsWith("board/"));
    assert.equal(derivatives.length, 2);
    for (const derivative of derivatives) {
      const meta = await sharp(storage.objects.get(derivative)!.body).metadata();
      assert.equal(meta.format, "webp");
    }

    const board = listPhotoBoard(null);
    assert.equal(board.popular.length, 0);
    assert.equal(getPublicPhoto(saved.id, null), null);

    const review = listReviewPhotos();
    assert.equal(review.length, 1);
    assert.equal(review[0]?.email, "same@example.com");
    assert.equal(review[0]?.status, "pending");
    const publicJson = JSON.stringify(listPhotoBoard("voter"));
    assert.equal(publicJson.includes("same@example.com"), false);
    assert.equal(JSON.stringify(getPublicPhoto(saved.id, null) ?? {}).includes("@"), false);

    const again = await createUpload({ contentType: "image/jpeg", contentLength: source.bytes.length });
    assert.equal(again.ok, true);
    if (!again.ok) return;
    storage.objects.set(uploadKey(again.uploadId), { body: source.bytes, contentType: "image/jpeg" });
    const duplicate = await submitPhoto({
      uploadId: again.uploadId,
      personName: "Ada",
      email: "same@example.com",
      drinkName: "Second",
      caption: "",
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.code, "EMAIL_IN_USE");

    const rejectedFile = await createUpload({ contentType: "image/jpeg", contentLength: 5 });
    assert.equal(rejectedFile.ok, true);
    if (!rejectedFile.ok) return;
    const junkKey = uploadKey(rejectedFile.uploadId);
    storage.objects.set(junkKey, { body: Buffer.from("hello"), contentType: "image/jpeg" });
    const junk = await submitPhoto({
      uploadId: rejectedFile.uploadId,
      personName: "Bea",
      email: "bea@example.com",
      drinkName: "Nope",
      caption: "",
    });
    assert.equal(junk.ok, false);
    assert.equal(storage.objects.has(junkKey), false);

    const approved = moderatePhoto(saved.id, "approve");
    assert.equal(approved.ok, true);
    const voter = crypto.randomUUID();
    const firstVote = castPhotoVote(saved.id, voter);
    assert.equal(firstVote.ok, true);
    if (firstVote.ok) {
      assert.equal(firstVote.photo.voteCount, 1);
      assert.equal(firstVote.photo.voted, true);
      assert.equal("email" in firstVote.photo, false);
    }
    const secondVote = castPhotoVote(saved.id, voter);
    assert.equal(secondVote.ok, false);
    if (!secondVote.ok) assert.equal(secondVote.code, "ALREADY_VOTED");
    const other = castPhotoVote(saved.id, crypto.randomUUID());
    assert.equal(other.ok, true);

    const removal = await DELETE();
    assert.equal(removal.status, 409);

    const visible = listPhotoBoard(voter);
    assert.equal(visible.popular.length, 1);
    assert.equal(visible.popular[0]?.drinkName, "Window light");
    assert.equal(JSON.stringify(visible).includes("same@example.com"), false);

    const down = moderatePhoto(saved.id, "remove");
    assert.equal(down.ok, true);
    assert.equal(listPhotoBoard(null).popular.length, 0);
    assert.equal(getPublicPhoto(saved.id, null), null);

    const rejected = moderatePhoto(saved.id, "reject");
    assert.equal(rejected.ok, false);
    const back = moderatePhoto(saved.id, "approve");
    assert.equal(back.ok, true);
    assert.equal(listPhotoBoard(null).popular.length, 1);
  });

  it("publishes a new photo only when review is skipped outside production", async () => {
    const source = await jpegWithGps();
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;

    async function enter(email: string) {
      const upload = await createUpload({ contentType: "image/jpeg", contentLength: source.bytes.length });
      assert.equal(upload.ok, true);
      if (!upload.ok) throw new Error("upload failed");
      storage.objects.set(uploadKey(upload.uploadId), { body: source.bytes, contentType: "image/jpeg" });
      return submitPhoto({
        uploadId: upload.uploadId,
        personName: "Cam",
        email,
        drinkName: "Cortado",
        caption: "",
      });
    }

    try {
      delete process.env.PHOTO_SKIP_REVIEW;
      delete env.NODE_ENV;
      const held = await enter("held@example.com");
      assert.equal(held.ok, true);
      if (!held.ok) return;
      assert.equal(held.status, "pending");
      assert.equal(getPublicPhoto(held.id, null), null);

      process.env.PHOTO_SKIP_REVIEW = "true";
      const live = await enter("live@example.com");
      assert.equal(live.ok, true);
      if (!live.ok) return;
      assert.equal(live.status, "approved");
      assert.equal(
        listPhotoBoard(null).popular.some((photo) => photo.id === live.id),
        true,
      );
      assert.equal(JSON.stringify(listPhotoBoard(null)).includes("live@example.com"), false);

      env.NODE_ENV = "production";
      const locked = await enter("locked@example.com");
      assert.equal(locked.ok, true);
      if (!locked.ok) return;
      assert.equal(locked.status, "pending");
      assert.equal(getPublicPhoto(locked.id, null), null);
    } finally {
      delete process.env.PHOTO_SKIP_REVIEW;
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
    }
  });
});
