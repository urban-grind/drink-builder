import { getDb } from "@/lib/db";
import { takePhotoCode } from "@/lib/photo-code";

/** Preview-only rows. Production never inserts these and never lists them. */
const SAMPLE_PREFIX = "local-sample/";

const FILES = ["wall-drink.jpg", "cup-beans.jpg", "counter.jpg"] as const;

type SamplePhoto = {
  id: string;
  code: string;
  personName: string;
  email: string;
  drinkName: string;
  file: (typeof FILES)[number];
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

export function samplePhotosEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function localSampleAsset(key: string): string | null {
  if (!key.startsWith(SAMPLE_PREFIX)) return null;
  const file = key.slice(SAMPLE_PREFIX.length);
  if (!(FILES as readonly string[]).includes(file)) return null;
  return `/photos/${file}`;
}

/** Inserts the five preview cards once. Existing rows are left alone. */
export function ensureSamplePhotos(): void {
  if (!samplePhotosEnabled()) return;
  const db = getDb();
  const existing = db.prepare("SELECT 1 AS found FROM photo_entries WHERE id = ?");
  const insertPhoto = db.prepare(
    `INSERT INTO photo_entries (
      id, person_name, email, drink_name, caption, status, original_key, content_type, vote_key, thumb_key, created_at, reviewed_at, public_code
    ) VALUES (?, ?, ?, ?, '', 'approved', ?, 'image/jpeg', ?, ?, ?, ?, ?)`,
  );
  const setCode = db.prepare(
    "UPDATE photo_entries SET public_code = ? WHERE id = ? AND (public_code IS NULL OR public_code = '')",
  );
  const insertVote = db.prepare(
    "INSERT OR IGNORE INTO photo_votes (photo_id, voter_id, created_at) VALUES (?, ?, ?)",
  );

  for (const sample of SAMPLES) {
    if (existing.get(sample.id)) continue;
    const key = `${SAMPLE_PREFIX}${sample.file}`;
    insertPhoto.run(
      sample.id,
      sample.personName,
      sample.email,
      sample.drinkName,
      key,
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

  const reserved = new Set(SAMPLES.map((sample) => sample.code));
  for (const sample of SAMPLES) {
    setCode.run(sample.code, sample.id);
  }
  const missing = db
    .prepare("SELECT id FROM photo_entries WHERE public_code IS NULL OR public_code = ''")
    .all() as { id: string }[];
  for (const row of missing) {
    setCode.run(takePhotoCode(reserved), row.id);
  }
}
