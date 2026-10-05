import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { takePhotoCode } from "@/lib/photo-code";

/** Preview-only rows. Production never inserts these and never lists them. */
const SAMPLE_PREFIX = "local-sample/";
const PHOTO_DIR = path.join(process.cwd(), "public", "photos");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const CODE_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";
const EXTRA_NAMES = [
  "Avery",
  "Nico",
  "Quinn",
  "Rowan",
  "Harper",
  "Eden",
  "Luis",
  "Noor",
  "Casey",
  "Remy",
  "Jules",
  "Sasha",
  "Omar",
  "Riley",
  "Devon",
  "Mina",
  "Theo",
  "Willa",
  "Chris",
  "Parker",
];

type SamplePhoto = {
  id: string;
  code: string;
  personName: string;
  email: string;
  drinkName: string;
  file: string;
  createdAt: string;
  likes: number;
};

const SAMPLES: SamplePhoto[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    code: "k7m2qa",
    personName: "Maya",
    email: "maya.sample@preview.invalid",
    drinkName: "Iced vanilla latte",
    file: "wall-drink.jpg",
    createdAt: "2026-10-01T15:00:00.000Z",
    likes: 18,
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    code: "p3n8wd",
    personName: "Jonah",
    email: "jonah.sample@preview.invalid",
    drinkName: "Maple oat latte",
    file: "cup-beans.jpg",
    createdAt: "2026-09-30T18:10:00.000Z",
    likes: 12,
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    code: "r6t4hc",
    personName: "Priya",
    email: "priya.sample@preview.invalid",
    drinkName: "Brown sugar cold brew",
    file: "counter.jpg",
    createdAt: "2026-09-28T14:20:00.000Z",
    likes: 7,
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    code: "b9v1sx",
    personName: "Sam",
    email: "sam.sample@preview.invalid",
    drinkName: "Honey cinnamon latte",
    file: "wall-drink.jpg",
    createdAt: "2026-09-22T16:40:00.000Z",
    likes: 3,
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    code: "f2c5yl",
    personName: "Elena",
    email: "elena.sample@preview.invalid",
    drinkName: "Sweet cream cold brew",
    file: "cup-beans.jpg",
    createdAt: "2026-09-14T13:05:00.000Z",
    likes: 1,
  },
];

function isPhotoFile(name: string): boolean {
  if (!name || name !== path.basename(name) || name.startsWith(".")) return false;
  if (name.length > 180 || /[\u0000-\u001f]/.test(name)) return false;
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

function photoFiles(): string[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(PHOTO_DIR);
  } catch {
    return [];
  }
  return names.filter((name) => isPhotoFile(name)).sort((a, b) => a.localeCompare(b));
}

function idForFile(file: string): string {
  const hex = createHash("sha256").update(`urban-grind-sample-id:${file}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = "8";
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function codeForFile(file: string, reserved: Set<string>): string {
  const digest = createHash("sha256").update(`urban-grind-sample-code:${file}`).digest();
  for (let salt = 0; salt < 32; salt += 1) {
    let code = "";
    for (let index = 0; index < 6; index += 1) {
      code += CODE_ALPHABET[(digest[index]! + salt * (index + 3)) % CODE_ALPHABET.length];
    }
    if (!reserved.has(code)) {
      reserved.add(code);
      return code;
    }
  }
  throw new Error(`Could not assign a sample code for ${file}.`);
}

function drinkFromFile(file: string): string {
  const base = file.slice(0, file.lastIndexOf(".")).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return "Coffee";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function extraSamples(): SamplePhoto[] {
  const used = new Set(SAMPLES.map((sample) => sample.file));
  const reserved = new Set(SAMPLES.map((sample) => sample.code));
  return photoFiles()
    .filter((file) => !used.has(file))
    .map((file, index) => {
      const personName = EXTRA_NAMES[index] ?? `Guest ${index + 1}`;
      const day = (index % 28) + 1;
      const month = 8 - Math.floor(index / 28);
      return {
        id: idForFile(file),
        code: codeForFile(file, reserved),
        personName,
        email: `${personName.toLowerCase().replace(/\s+/g, ".")}.sample@preview.invalid`,
        drinkName: drinkFromFile(file),
        file,
        createdAt: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00.000Z`,
        likes: (createHash("sha256").update(file).digest()[0]! % 9) + 1,
      };
    });
}

/** Curated preview cards plus one card for every other image in public/photos. */
export function developmentSampleCount(): number {
  return SAMPLES.length + extraSamples().length;
}

export function samplePhotosEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function localSampleAsset(key: string): string | null {
  if (!key.startsWith(SAMPLE_PREFIX)) return null;
  const file = key.slice(SAMPLE_PREFIX.length);
  if (!isPhotoFile(file)) return null;
  return `/photos/${encodeURIComponent(file)}`;
}

/** Inserts the preview cards once. A new file in public/photos is added on the next load. Existing rows are left alone. */
export function ensureSamplePhotos(): void {
  if (!samplePhotosEnabled()) return;
  const db = getDb();
  const samples = [...SAMPLES, ...extraSamples()];
  const existing = db.prepare("SELECT 1 AS found FROM photo_entries WHERE id = ?");
  const insertPhoto = db.prepare(
    `INSERT INTO photo_entries (
      id, person_name, email, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, reviewed_at, public_code
    ) VALUES (?, ?, ?, ?, '', 'approved', ?, ?, ?, ?, ?, ?, ?)`,
  );
  const setCode = db.prepare(
    "UPDATE photo_entries SET public_code = ? WHERE id = ? AND (public_code IS NULL OR public_code = '')",
  );
  const insertVote = db.prepare(
    "INSERT OR IGNORE INTO photo_votes (photo_id, voter_id, created_at) VALUES (?, ?, ?)",
  );

  for (const sample of samples) {
    if (existing.get(sample.id)) continue;
    const key = `${SAMPLE_PREFIX}${sample.file}`;
    const contentType = sample.file.toLowerCase().endsWith(".png")
      ? "image/png"
      : sample.file.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    insertPhoto.run(
      sample.id,
      sample.personName,
      sample.email,
      sample.drinkName,
      key,
      contentType,
      key,
      key,
      sample.createdAt,
      sample.createdAt,
      sample.code,
    );
    for (let like = 0; like < sample.likes; like += 1) {
      const voter = `00000000-0000-4000-8000-${String(like + 1).padStart(12, "0")}`;
      insertVote.run(sample.id, voter, sample.createdAt);
    }
  }

  const curated = new Set(SAMPLES.map((sample) => sample.id));
  const updateExtra = db.prepare(
    "UPDATE photo_entries SET person_name = ?, drink_name = ? WHERE id = ? AND original_key LIKE 'local-sample/%'",
  );
  for (const sample of samples) {
    if (!curated.has(sample.id)) updateExtra.run(sample.personName, sample.drinkName, sample.id);
  }

  const reserved = new Set(samples.map((sample) => sample.code));
  for (const sample of samples) {
    setCode.run(sample.code, sample.id);
  }
  const missing = db
    .prepare("SELECT id FROM photo_entries WHERE public_code IS NULL OR public_code = ''")
    .all() as { id: string }[];
  for (const row of missing) {
    setCode.run(takePhotoCode(reserved), row.id);
  }
}
