import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import piexif from "piexifjs";
import { resetDbForTests, getDb } from "@/lib/db";
import { decodeHeicWithWasm, makeBoardImages, VOTE_LONG_EDGE, THUMB_LONG_EDGE } from "@/lib/photo-image";
import { POST as checkPhotoContactRoute } from "@/app/api/photos/contact/route";
import { DELETE } from "@/app/api/photos/[id]/vote/route";
import {
  castPhotoVote,
  createUpload,
  getPublicPhoto,
  getPublicPhotoByCode,
  photoImageKey,
  compareLeaderboard,
  standingsFor,
  listPhotoBoard,
  listPhotoDeck,
  contestActivity,
  listPhotoLeaderboard,
  listReviewPhotos,
  checkPhotoContact,
  findOwnedPhotosByContact,
  listOwnedPhotos,
  moderatePhoto,
  submitPhoto,
  swipeDeckPhoto,
  undoDeckSwipe,
} from "@/lib/photos";
import { firstName, photoEntryPath } from "@/lib/first-name";
import { photoShareCard, photoShareImagePath, previewJpeg } from "@/lib/photo-share-card";
import { discardUpload, prepareUpload, setPrepareHookForTests, voteKeyForUpload } from "@/lib/photo-prepare";
import { coverCrop } from "@/lib/photo-crop";
import { parsePhotoUploadRequest, parseTypedContact, termsAgreementError, validatePhotoEntry } from "@/lib/photo-validation";
import { RESIZE_LIMIT, withResizeSlot } from "@/lib/resize-queue";
import { getPhotoStorage, readR2Config, setPhotoStorageForTests, type PhotoStorage } from "@/lib/r2";
import { developmentSampleCount } from "@/lib/sample-photos";

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

  it("shows a first name on an entry path", () => {
    assert.equal(firstName("Barrie Smith"), "Barrie");
    assert.equal(firstName("  Ada  "), "Ada");
    assert.equal(photoEntryPath("ab12cd"), "/p/ab12cd");
  });

  it("writes the text-message card for a voting link", async () => {
    assert.deepEqual(photoShareCard("Harper Lee"), {
      title: "Vote for Harper's photo",
      description: "Help me win free coffee for a month",
    });
    assert.equal(photoShareCard("  ").title, "Vote for this photo");
    assert.equal(photoShareImagePath("doh8ot"), "/p/doh8ot/card.jpg");
    const png = await sharp({
      create: { width: 80, height: 40, channels: 3, background: "#274b3a" },
    })
      .png()
      .toBuffer();
    const card = await previewJpeg(png);
    assert.equal(card.jpeg[0], 0xff);
    assert.equal(card.jpeg[1], 0xd8);
    assert.equal(card.width, 80);
    assert.equal(card.height, 40);
  });

  it("queues resizes so only two run at once", async () => {
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        withResizeSlot(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 40));
          active -= 1;
        }),
      ),
    );
    assert.equal(peak, RESIZE_LIMIT);
    assert.equal(RESIZE_LIMIT, 2);
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
    assert.equal(termsAgreementError({ agreedToTerms: true }), null);
    assert.equal(termsAgreementError({}), "Agree to the terms and conditions.");
    const rude = validatePhotoEntry({
      personName: "Ada",
      email: "ada@example.com",
      drinkName: "shit latte",
      caption: "",
    });
    assert.equal(rude.ok, false);
    const neither = validatePhotoEntry({
      personName: "Nia",
      email: "  ",
      phone: "",
      drinkName: "Latte",
      caption: "",
    });
    assert.equal(neither.ok, false);
    if (!neither.ok) assert.match(neither.message, /email or a phone/i);

    const fromPunctuation = validatePhotoEntry({
      personName: "Nia",
      phone: "(705) 555-0199",
      drinkName: "Latte",
      caption: "",
    });
    const fromDigits = validatePhotoEntry({
      personName: "Nia",
      phone: "7055550199",
      drinkName: "Latte",
      caption: "",
    });
    assert.equal(fromPunctuation.ok, true);
    assert.equal(fromDigits.ok, true);
    if (fromPunctuation.ok && fromDigits.ok) {
      assert.equal(fromPunctuation.value.phone, "7055550199");
      assert.equal(fromDigits.value.phone, fromPunctuation.value.phone);
      assert.equal(fromPunctuation.value.email, null);
    }

    const country = validatePhotoEntry({
      personName: "Nia",
      phone: "+1 (705) 555-0199",
      drinkName: "Latte",
      caption: "",
    });
    assert.equal(country.ok, true);
    if (country.ok) assert.equal(country.value.phone, "7055550199");

    const shortPhone = validatePhotoEntry({
      personName: "Nia",
      phone: "555-0199",
      drinkName: "Latte",
      caption: "",
    });
    assert.equal(shortPhone.ok, false);

    const mixedEmail = validatePhotoEntry({
      personName: "Nia",
      email: "Case@Example.com",
      drinkName: "Latte",
      caption: "",
    });
    assert.equal(mixedEmail.ok, true);
    if (mixedEmail.ok) {
      assert.equal(mixedEmail.value.email, "case@example.com");
      assert.equal(mixedEmail.value.phone, null);
    }

    const optionalDrink = validatePhotoEntry({
      personName: "Nia",
      email: "nia@example.com",
      drinkName: "  ",
      caption: "",
    });
    assert.equal(optionalDrink.ok, true);
    if (optionalDrink.ok) assert.equal(optionalDrink.value.drinkName, "");

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

    const framed = await makeBoardImages(wide, coverCrop(2000, 1000));
    assert.ok(!("error" in framed));
    if ("error" in framed) return;
    const framedVote = await sharp(framed.vote).metadata();
    const framedThumb = await sharp(framed.thumb).metadata();
    assert.equal(framedVote.width, 750);
    assert.equal(framedVote.height, 1000);
    assert.equal(framedThumb.width, 480);
    assert.equal(framedThumb.height, 640);
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

  it("checks one contact box as an email or a phone from what was typed", () => {
    const email = parseTypedContact("  Case@Example.com ");
    assert.equal(email.ok, true);
    if (email.ok) assert.equal(email.email, "case@example.com");

    const unfinished = parseTypedContact("ada@");
    assert.equal(unfinished.ok, false);
    if (!unfinished.ok) assert.match(unfinished.message, /email address/i);

    const words = parseTypedContact("hello");
    assert.equal(words.ok, false);
    if (!words.ok) assert.match(words.message, /email address/i);

    const phone = parseTypedContact("+1 (705) 555-0199");
    assert.equal(phone.ok, true);
    if (phone.ok) {
      assert.equal(phone.phone, "7055550199");
      assert.equal(phone.email, null);
    }

    const dottedPhone = parseTypedContact("705.555.0199");
    assert.equal(dottedPhone.ok, true);
    if (dottedPhone.ok) assert.equal(dottedPhone.phone, "7055550199");

    const shortPhone = parseTypedContact("555-0199");
    assert.equal(shortPhone.ok, false);
    if (!shortPhone.ok) assert.match(shortPhone.message, /phone number/i);

    const empty = parseTypedContact("   ");
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.match(empty.message, /email or a phone/i);
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
    const pendingLink = getPublicPhotoByCode(saved.code, null);
    assert.equal(pendingLink?.drinkName, "Window light");
    assert.equal(pendingLink?.personName, "Ada");
    assert.equal(getPublicPhoto(saved.id, null)?.id, saved.id);
    assert.equal(listPhotoDeck("deck-voter").some((photo) => photo.id === saved.id), false);
    assert.equal(listPhotoLeaderboard().photos.some((photo) => photo.id === saved.id), false);
    assert.equal(swipeDeckPhoto(saved.id, "deck-voter", "vote").ok, false);
    assert.ok(photoImageKey(saved.id, "vote", false));
    const pendingVote = castPhotoVote(saved.id, crypto.randomUUID());
    assert.equal(pendingVote.ok, true);
    if (pendingVote.ok) assert.equal(pendingVote.photo.voteCount, 1);

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
    assert.equal(duplicate.ok, true);
    if (duplicate.ok) assert.equal(duplicate.id === saved.id, false);
    assert.equal(JSON.stringify(listPhotoBoard("voter")).includes("same@example.com"), false);

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
      assert.equal(firstVote.photo.voteCount, 2);
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
      assert.equal(getPublicPhotoByCode(held.code, null)?.drinkName, "Cortado");
      assert.equal(listPhotoDeck("held-deck").some((photo) => photo.id === held.id), false);
      assert.equal(listPhotoLeaderboard().photos.some((photo) => photo.id === held.id), false);

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
      assert.equal(getPublicPhoto(locked.id, null)?.id, locked.id);
      assert.equal(listPhotoBoard(null).popular.some((photo) => photo.id === locked.id), false);
      assert.equal(listPhotoDeck("locked-deck").some((photo) => photo.id === locked.id), false);
      assert.equal(moderatePhoto(locked.id, "reject").ok, true);
      assert.equal(getPublicPhotoByCode(locked.code, null), null);
      assert.equal(photoImageKey(locked.id, "vote", false), null);
      assert.equal(castPhotoVote(locked.id, crypto.randomUUID()).ok, false);
    } finally {
      delete process.env.PHOTO_SKIP_REVIEW;
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
    }
  });

  it("shows five local sample photos only while developing", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    try {
      env.NODE_ENV = "development";
      const first = listPhotoBoard(null);
      const samples = first.popular.filter((photo) => photo.thumbUrl.startsWith("/photos/"));
      const expected = developmentSampleCount();
      const curated = samples.filter((photo) =>
        ["Maya", "Jonah", "Priya", "Sam", "Elena"].includes(photo.personName),
      );
      assert.equal(samples.length, expected);
      assert.equal(curated.length, 5);
      assert.equal(new Set(curated.map((photo) => photo.drinkName)).size, 5);
      assert.equal(new Set(curated.map((photo) => photo.personName)).size, 5);
      assert.equal(new Set(curated.map((photo) => photo.createdAt)).size, 5);
      assert.equal(new Set(curated.map((photo) => photo.voteCount)).size, 5);
      assert.equal(new Set(samples.map((photo) => photo.code)).size, expected);
      assert.equal(samples.every((photo) => /^[a-z0-9]{6}$/.test(photo.code)), true);
      assert.equal(JSON.stringify(first).includes("@"), false);
      assert.equal(samples.every((photo) => !photo.thumbUrl.includes("r2")), true);

      const again = listPhotoBoard(null).popular.filter((photo) => photo.thumbUrl.startsWith("/photos/"));
      assert.equal(again.length, expected);
      assert.deepEqual(
        again.map((photo) => photo.code).sort(),
        samples.map((photo) => photo.code).sort(),
      );
      const stored = getDb()
        .prepare("SELECT COUNT(*) AS count FROM photo_entries WHERE original_key LIKE 'local-sample/%'")
        .get() as { count: number };
      assert.equal(stored.count, expected);

      env.NODE_ENV = "production";
      const hidden = listPhotoBoard(null);
      assert.equal(
        hidden.popular.some((photo) => photo.thumbUrl.startsWith("/photos/")),
        false,
      );
      assert.equal(getPublicPhoto("11111111-1111-4111-8111-111111111101", null), null);
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
    }
  });

  function everyDealtPhoto(voter: string) {
    const all = [];
    const seen = new Set<string>();
    for (let page = 0; page < 15; page += 1) {
      const next = listPhotoDeck(voter, { limit: 8, except: [...seen] });
      const fresh = next.filter((photo) => !seen.has(photo.id));
      if (fresh.length === 0) break;
      for (const photo of fresh) {
        seen.add(photo.id);
        all.push(photo);
      }
    }
    return all;
  }

  it("deals each photo once, skips without a vote, and undoes only the last swipe", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    try {
      env.NODE_ENV = "development";
      const voter = crypto.randomUUID();
      const deck = everyDealtPhoto(voter).filter((photo) => photo.thumbUrl.startsWith("/photos/"));
      const expected = developmentSampleCount();
      assert.equal(deck.length, expected);
      assert.equal(new Set(deck.map((photo) => photo.id)).size, expected);

      const skipped = deck[0];
      const voted = deck[1];
      assert.ok(skipped && voted);
      const skipResult = swipeDeckPhoto(skipped.id, voter, "skip");
      assert.equal(skipResult.ok, true);
      assert.equal(getPublicPhoto(skipped.id, voter)?.voteCount, skipped.voteCount);
      assert.equal(
        everyDealtPhoto(voter).some((photo) => photo.id === skipped.id),
        false,
      );

      const before = getPublicPhoto(voted.id, voter)?.voteCount ?? 0;
      const voteResult = swipeDeckPhoto(voted.id, voter, "vote");
      assert.equal(voteResult.ok, true);
      assert.equal(getPublicPhoto(voted.id, voter)?.voteCount, before + 1);
      assert.equal(
        everyDealtPhoto(voter).some((photo) => photo.id === voted.id),
        false,
      );

      const undoneVote = undoDeckSwipe(voter, voted.id);
      assert.equal(undoneVote.ok, true);
      if (undoneVote.ok) assert.equal(undoneVote.action, "vote");
      assert.equal(getPublicPhoto(voted.id, voter)?.voteCount, before);
      assert.equal(
        everyDealtPhoto(voter).some((photo) => photo.id === voted.id),
        true,
      );

      const notLast = undoDeckSwipe(voter, voted.id);
      assert.equal(notLast.ok, false);

      const undoneSkip = undoDeckSwipe(voter, skipped.id);
      assert.equal(undoneSkip.ok, true);
      if (undoneSkip.ok) assert.equal(undoneSkip.action, "skip");
      assert.equal(
        everyDealtPhoto(voter).some((photo) => photo.id === skipped.id),
        true,
      );

      env.NODE_ENV = "production";
      assert.equal(
        everyDealtPhoto(voter).some((photo) => photo.thumbUrl.startsWith("/photos/")),
        false,
      );
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
    }
  });

  it("serves the deck a few cards at a time and keeps one swipe row per voter", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    try {
      env.NODE_ENV = "development";
      const names = new Set(
        (getDb().prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as { name: string }[]).map(
          (row) => row.name,
        ),
      );
      assert.equal(names.has("idx_photo_votes_voter"), true);
      assert.equal(names.has("idx_photo_swipes_voter"), true);
      assert.equal(names.has("idx_photo_swipes_photo"), true);
      const votePk = getDb()
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'photo_votes'")
        .get() as { sql: string };
      const swipePk = getDb()
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'photo_swipes'")
        .get() as { sql: string };
      assert.match(votePk.sql, /PRIMARY KEY \(photo_id, voter_id\)/);
      assert.match(swipePk.sql, /PRIMARY KEY \(voter_id, photo_id\)/);

      const voter = crypto.randomUUID();
      const first = listPhotoDeck(voter, { limit: 2 });
      assert.equal(first.length, 2);
      const second = listPhotoDeck(voter, { limit: 2, except: first.map((photo) => photo.id) });
      assert.equal(second.length, 2);
      const seen = new Set([...first, ...second].map((photo) => photo.id));
      assert.equal(seen.size, 4);
      const dealt = listPhotoDeck(voter);
      assert.equal(dealt.length, 5);
      assert.equal(listPhotoLeaderboard().photos.length <= 20, true);
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
    }
  });

  it("measures how far a photo is from the top two", () => {
    const standings = standingsFor([
      { id: "first", voteCount: 10 },
      { id: "second", voteCount: 7 },
      { id: "close", voteCount: 4 },
      { id: "tied", voteCount: 7 },
    ]);
    assert.equal(standings.get("first")?.rank, 1);
    assert.equal(standings.get("first")?.votesFromTopTwo, null);
    assert.equal(standings.get("second")?.votesFromTopTwo, null);
    assert.equal(standings.get("close")?.votesFromTopTwo, 3);
    assert.equal(standings.get("tied")?.rank, 4);
    assert.equal(standings.get("tied")?.votesFromTopTwo, null);
  });

  it("ranks the leaderboard by votes, then like percentage, and keeps skips on the server", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    try {
      assert.ok(compareLeaderboard({ voteCount: 5, skipCount: 0 }, { voteCount: 4, skipCount: 0 }) < 0);
      assert.ok(compareLeaderboard({ voteCount: 5, skipCount: 1 }, { voteCount: 5, skipCount: 5 }) < 0);

      env.NODE_ENV = "development";
      const voter = crypto.randomUUID();
      const ranked = listPhotoLeaderboard({ limit: 24 });
      const before = ranked.photos.filter((photo) => photo.thumbUrl.startsWith("/photos/"));
      assert.equal(before.length, developmentSampleCount());
      const firstPage = listPhotoLeaderboard({ offset: 0, limit: 4 });
      const secondPage = listPhotoLeaderboard({ offset: 4, limit: 4 });
      assert.equal(firstPage.photos.length, 4);
      assert.equal(firstPage.hasMore, ranked.photos.length > 4);
      assert.deepEqual(
        [...firstPage.photos, ...secondPage.photos].map((photo) => photo.id),
        ranked.photos.slice(0, 8).map((photo) => photo.id),
      );
      const seen = new Set([...firstPage.photos, ...secondPage.photos].map((photo) => photo.id));
      assert.equal(seen.size, firstPage.photos.length + secondPage.photos.length);
      for (let index = 0; index < before.length - 1; index += 1) {
        const current = before[index];
        const next = before[index + 1];
        assert.ok(current && next);
        assert.ok(compareLeaderboard(current, next) <= 0);
      }

      const photo = before[0];
      assert.ok(photo);
      const skipped = swipeDeckPhoto(photo.id, voter, "skip");
      assert.equal(skipped.ok, true);
      assert.equal(swipeDeckPhoto(photo.id, voter, "vote").ok, false);
      const afterSkip = listPhotoLeaderboard().photos.find((entry) => entry.id === photo.id);
      assert.ok(afterSkip);
      assert.equal(afterSkip.voteCount, photo.voteCount);
      assert.equal(afterSkip.skipCount, photo.skipCount + 1);
      assert.equal(afterSkip.likePercent, Math.round((photo.voteCount / (photo.voteCount + photo.skipCount + 1)) * 100));

      const undone = undoDeckSwipe(voter, photo.id);
      assert.equal(undone.ok, true);
      const restored = listPhotoLeaderboard().photos.find((entry) => entry.id === photo.id);
      assert.equal(restored?.skipCount, photo.skipCount);
      assert.equal(restored?.voteCount, photo.voteCount);

      env.NODE_ENV = "production";
      assert.equal(
        listPhotoLeaderboard().photos.some((entry) => entry.thumbUrl.startsWith("/photos/")),
        false,
      );
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
    }
  });

  it("counts public photos and votes in total and since midnight Eastern", () => {
    const now = new Date("2026-10-05T22:00:00.000Z");
    const before = contestActivity(now);
    const db = getDb();
    const insert = db.prepare(
      `INSERT INTO photo_entries (
        id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, public_code
      ) VALUES (?, 'Ada', NULL, NULL, 'Latte', '', ?, ?, 'image/jpeg', 'vote', 'thumb', ?, ?)`,
    );
    const todayId = crypto.randomUUID();
    const olderId = crypto.randomUUID();
    const pendingId = crypto.randomUUID();
    insert.run(todayId, "approved", `activity/${todayId}`, "2026-10-05T18:00:00.000Z", "aaaaaa");
    insert.run(olderId, "approved", `activity/${olderId}`, "2026-10-04T18:00:00.000Z", "bbbbbb");
    insert.run(pendingId, "pending", `activity/${pendingId}`, "2026-10-05T18:00:00.000Z", "cccccc");
    const vote = db.prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at) VALUES (?, ?, ?)");
    vote.run(todayId, "voter-today", "2026-10-05T19:00:00.000Z");
    vote.run(olderId, "voter-older", "2026-10-04T19:00:00.000Z");
    vote.run(pendingId, "voter-pending", "2026-10-05T19:00:00.000Z");
    const skip = db.prepare(
      "INSERT INTO photo_swipes (voter_id, photo_id, action, created_at) VALUES (?, ?, 'skip', ?)",
    );
    skip.run("skip-today", todayId, "2026-10-05T20:00:00.000Z");
    skip.run("skip-older", olderId, "2026-10-04T20:00:00.000Z");
    skip.run("skip-pending", pendingId, "2026-10-05T20:00:00.000Z");
    const after = contestActivity(now);
    assert.equal(after.photos, before.photos + 2);
    assert.equal(after.photosToday, before.photosToday + 1);
    assert.equal(after.votes, before.votes + 4);
    assert.equal(after.votesToday, before.votesToday + 2);
  });

  it("allows another photo with the same email or phone", async () => {
    const source = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 80, b: 40 } },
    })
      .jpeg()
      .toBuffer();

    async function enter(contact: { email?: string; phone?: string; drinkName: string }) {
      const upload = await createUpload({ contentType: "image/jpeg", contentLength: source.length });
      assert.equal(upload.ok, true);
      if (!upload.ok) throw new Error("upload failed");
      storage.objects.set(uploadKey(upload.uploadId), { body: source, contentType: "image/jpeg" });
      return submitPhoto({
        uploadId: upload.uploadId,
        personName: "Nia",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        drinkName: contact.drinkName,
        caption: "",
      });
    }

    const missing = await submitPhoto({
      uploadId: crypto.randomUUID(),
      personName: "Nia",
      email: "",
      phone: "",
      drinkName: "Latte",
      caption: "",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "VALIDATION");

    const phoneOnly = await enter({ phone: "(705) 555-0199", drinkName: "Phone cup" });
    assert.equal(phoneOnly.ok, true);
    if (!phoneOnly.ok) return;

    const presignsBeforeCheck = storage.presigns.length;
    const uploadsBeforeCheck = getDb().prepare("SELECT COUNT(*) AS count FROM photo_uploads").get() as {
      count: number;
    };
    const takenPhone = await checkPhotoContactRoute(
      new Request("http://localhost/api/photos/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "(705) 555-0199" }),
      }),
    );
    assert.equal(takenPhone.status, 200);
    const takenDigits = checkPhotoContact({ phone: "7055550199" });
    assert.equal(takenDigits.ok, true);
    const openPhone = checkPhotoContact({ phone: "416-555-0148" });
    assert.equal(openPhone.ok, true);
    assert.equal(storage.presigns.length, presignsBeforeCheck);
    const uploadsAfterCheck = getDb().prepare("SELECT COUNT(*) AS count FROM photo_uploads").get() as {
      count: number;
    };
    assert.equal(Number(uploadsAfterCheck.count), Number(uploadsBeforeCheck.count));
    const phoneReview = listReviewPhotos().find((photo) => photo.id === phoneOnly.id);
    assert.equal(phoneReview?.phone, "7055550199");
    assert.equal(phoneReview?.email, null);
    assert.equal(moderatePhoto(phoneOnly.id, "approve").ok, true);
    const phonePublic = JSON.stringify(getPublicPhoto(phoneOnly.id, null) ?? {});
    assert.equal(phonePublic.includes("7055550199"), false);
    assert.equal(phonePublic.includes("phone"), false);

    const samePhone = await enter({ phone: "7055550199", drinkName: "Second phone" });
    assert.equal(samePhone.ok, true);
    if (!samePhone.ok) return;
    assert.equal(samePhone.id === phoneOnly.id, false);

    const otherPhone = await enter({ phone: "416-555-0148", drinkName: "Other phone" });
    assert.equal(otherPhone.ok, true);

    const emailOnly = await enter({ email: "Case@Example.com", drinkName: "Email cup" });
    assert.equal(emailOnly.ok, true);
    if (!emailOnly.ok) return;
    const emailReview = listReviewPhotos().find((photo) => photo.id === emailOnly.id);
    assert.equal(emailReview?.email, "case@example.com");
    assert.equal(emailReview?.phone, null);
    assert.equal(JSON.stringify(listReviewPhotos()).includes("Case@Example.com"), false);

    const presignsBeforeEmail = storage.presigns.length;
    const takenEmail = await checkPhotoContactRoute(
      new Request("http://localhost/api/photos/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "CASE@example.com" }),
      }),
    );
    assert.equal(takenEmail.status, 200);
    const openEmail = checkPhotoContact({ email: "other.person@example.com" });
    assert.equal(openEmail.ok, true);
    assert.equal(storage.presigns.length, presignsBeforeEmail);

    const sameEmail = await enter({ email: "CASE@example.com", drinkName: "Second email" });
    assert.equal(sameEmail.ok, true);
    if (!sameEmail.ok) return;
    const recovered = findOwnedPhotosByContact({ email: "case@example.com" }, null);
    assert.equal(recovered.ok, true);
    if (!recovered.ok) return;
    assert.equal(recovered.photos.length, 2);
    assert.equal(recovered.photos.every((photo) => photo.status === "pending" || photo.status === "approved"), true);
    assert.equal(JSON.stringify(recovered.photos).includes("case@example.com"), false);
    const listed = listOwnedPhotos([sameEmail.id, phoneOnly.id], null);
    assert.equal(listed.length, 2);
    assert.equal(moderatePhoto(sameEmail.id, "reject").ok, true);
    assert.equal(listOwnedPhotos([sameEmail.id], null).length, 0);

    const otherEmail = await enter({ email: "other.person@example.com", drinkName: "Other email" });
    assert.equal(otherEmail.ok, true);
  });

  it("resizes before the entry exists and drops a photo that was replaced", async () => {
    const source = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 12, g: 80, b: 40 } },
    })
      .jpeg()
      .toBuffer();
    const puts: string[] = [];
    const originalPut = storage.put.bind(storage);
    storage.put = async (key, body, type) => {
      puts.push(key);
      return originalPut(key, body, type);
    };

    try {
      const first = await createUpload({ contentType: "image/jpeg", contentLength: source.length });
      const second = await createUpload({ contentType: "image/jpeg", contentLength: source.length });
      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      if (!first.ok || !second.ok) return;
      storage.objects.set(uploadKey(first.uploadId), { body: source, contentType: "image/jpeg" });
      storage.objects.set(uploadKey(second.uploadId), { body: source, contentType: "image/jpeg" });

      setPrepareHookForTests(async () => {
        await discardUpload(first.uploadId);
      });
      const replaced = await prepareUpload(first.uploadId);
      assert.equal(replaced.ok, false);
      if (!replaced.ok) assert.equal(replaced.code, "UPLOAD_REPLACED");
      assert.equal(storage.objects.has(voteKeyForUpload(first.uploadId)), false);
      assert.equal(storage.objects.has(uploadKey(first.uploadId)), false);
      assert.equal(storage.objects.has(uploadKey(second.uploadId)), true);
      const replacedEntries = getDb()
        .prepare("SELECT COUNT(*) AS count FROM photo_entries WHERE original_key = ?")
        .get(uploadKey(first.uploadId)) as { count: number };
      assert.equal(Number(replacedEntries.count), 0);

      setPrepareHookForTests(null);
      const boardPutsBefore = puts.filter((key) => key.startsWith("board/")).length;
      const [once, again] = await Promise.all([prepareUpload(second.uploadId), prepareUpload(second.uploadId)]);
      assert.equal(once.ok, true);
      assert.equal(again.ok, true);
      assert.equal(puts.filter((key) => key.startsWith("board/")).length, boardPutsBefore + 2);
      const preparedEntries = getDb()
        .prepare("SELECT COUNT(*) AS count FROM photo_entries WHERE original_key = ?")
        .get(uploadKey(second.uploadId)) as { count: number };
      assert.equal(Number(preparedEntries.count), 0);

      const putsAfterPrepare = puts.length;
      const saved = await submitPhoto({
        uploadId: second.uploadId,
        personName: "Nia",
        email: "prepared@example.com",
        phone: "",
        drinkName: "Prepared cup",
        caption: "",
      });
      assert.equal(saved.ok, true);
      assert.equal(puts.length, putsAfterPrepare);
      if (!saved.ok) return;
      const stored = getDb().prepare("SELECT vote_key FROM photo_entries WHERE id = ?").get(saved.id) as {
        vote_key: string;
      };
      assert.equal(stored.vote_key, voteKeyForUpload(second.uploadId));
      assert.equal(storage.objects.has(voteKeyForUpload(first.uploadId)), false);

      const duplicate = await createUpload({ contentType: "image/jpeg", contentLength: source.length });
      assert.equal(duplicate.ok, true);
      if (!duplicate.ok) return;
      storage.objects.set(uploadKey(duplicate.uploadId), { body: source, contentType: "image/jpeg" });
      const preparedDuplicate = await prepareUpload(duplicate.uploadId);
      assert.equal(preparedDuplicate.ok, true);
      const another = await submitPhoto({
        uploadId: duplicate.uploadId,
        personName: "Nia",
        email: "PREPARED@example.com",
        phone: "",
        drinkName: "Duplicate prepared",
        caption: "",
      });
      assert.equal(another.ok, true);
      const duplicateEntries = getDb()
        .prepare("SELECT COUNT(*) AS count FROM photo_entries WHERE drink_name = 'Duplicate prepared'")
        .get() as { count: number };
      assert.equal(Number(duplicateEntries.count), 1);
    } finally {
      storage.put = originalPut;
      setPrepareHookForTests(null);
    }
  });

  it("migrates an email-only table so phone numbers can be stored", () => {
    const previous = process.env.DRINK_DB_PATH;
    const file = path.join(os.tmpdir(), `urban-grind-photo-migrate-${process.pid}.sqlite`);
    fs.rmSync(file, { force: true });
    process.env.DRINK_DB_PATH = file;
    resetDbForTests();
    const photoId = "22222222-2222-4222-8222-222222222201";
    const voterId = "33333333-3333-4333-8333-333333333301";
    try {
      const raw = new DatabaseSync(file);
      raw.exec(`
        CREATE TABLE photo_entries (
          id TEXT PRIMARY KEY,
          person_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          drink_name TEXT NOT NULL,
          caption TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL,
          original_key TEXT NOT NULL,
          content_type TEXT NOT NULL,
          vote_key TEXT NOT NULL,
          thumb_key TEXT NOT NULL,
          created_at TEXT NOT NULL,
          reviewed_at TEXT
        );
        CREATE TABLE photo_votes (
          photo_id TEXT NOT NULL,
          voter_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (photo_id, voter_id),
          FOREIGN KEY (photo_id) REFERENCES photo_entries(id)
        );
      `);
      raw
        .prepare(
          `INSERT INTO photo_entries (
            id, person_name, email, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, reviewed_at
          ) VALUES (?, 'Nia', 'Mixed@Example.com', 'Old cup', '', 'approved', 'original/old', 'image/jpeg', 'vote/old', 'thumb/old', ?, NULL)`,
        )
        .run(photoId, "2026-09-01T12:00:00.000Z");
      raw
        .prepare("INSERT INTO photo_votes (photo_id, voter_id, created_at) VALUES (?, ?, ?)")
        .run(photoId, voterId, "2026-09-01T12:00:00.000Z");
      (raw as { close?: () => void }).close?.();

      const db = getDb();
      const row = db.prepare("SELECT email, phone FROM photo_entries WHERE id = ?").get(photoId) as {
        email: string | null;
        phone: string | null;
      };
      assert.equal(row.email, "mixed@example.com");
      assert.equal(row.phone, null);
      const votes = db.prepare("SELECT COUNT(*) AS count FROM photo_votes WHERE photo_id = ?").get(photoId) as {
        count: number;
      };
      assert.equal(Number(votes.count), 1);

      const second = "22222222-2222-4222-8222-222222222202";
      db.prepare(
        `INSERT INTO photo_entries (
          id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at
        ) VALUES (?, 'Bea', NULL, '7055550199', 'New cup', '', 'pending', 'original/new', 'image/jpeg', 'vote/new', 'thumb/new', ?)`,
      ).run(second, "2026-09-02T12:00:00.000Z");
      db.prepare(
        `INSERT INTO photo_entries (
          id, person_name, email, phone, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at
        ) VALUES (?, 'Cam', NULL, '7055550199', 'Copy', '', 'pending', 'original/copy', 'image/jpeg', 'vote/copy', 'thumb/copy', ?)`,
      ).run("22222222-2222-4222-8222-222222222203", "2026-09-03T12:00:00.000Z");
      const copies = db.prepare("SELECT COUNT(*) AS count FROM photo_entries WHERE phone = ?").get("7055550199") as {
        count: number;
      };
      assert.equal(Number(copies.count), 2);
    } finally {
      resetDbForTests();
      fs.rmSync(file, { force: true });
      if (previous === undefined) delete process.env.DRINK_DB_PATH;
      else process.env.DRINK_DB_PATH = previous;
      resetDbForTests();
    }
  });
});
