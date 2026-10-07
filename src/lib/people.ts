import { getDb } from "@/lib/db";

export type PersonRecord = {
  name: string;
  email: string | null;
  phone: string | null;
  photoCount: number;
  inDraw: boolean;
  signedUpAt: string;
};

type ContactRow = {
  person_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  photos: number;
  draw: number;
};

/** Photo uploads and draw signups, one row per person. Matched on email or phone. */
export function listPeople(): PersonRecord[] {
  const photos = getDb()
    .prepare(
      `SELECT person_name, email, phone, created_at, 1 AS photos, 0 AS draw
       FROM photo_entries
       WHERE original_key NOT LIKE 'local-sample/%'
         AND (
           (email IS NOT NULL AND trim(email) <> '')
           OR (phone IS NOT NULL AND trim(phone) <> '')
         )`,
    )
    .all() as ContactRow[];
  const draws = getDb()
    .prepare(
      `SELECT person_name, email, phone, created_at, 0 AS photos, 1 AS draw
       FROM draw_entrants`,
    )
    .all() as ContactRow[];
  return mergeContacts([...photos, ...draws]);
}

export function mergeContacts(rows: ContactRow[]): PersonRecord[] {
  const parent = rows.map((_, index) => index);
  function find(index: number): number {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor];
    parent[index] = cursor;
    return cursor;
  }
  function unite(left: number, right: number) {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  }

  const byEmail = new Map<string, number>();
  const byPhone = new Map<string, number>();
  rows.forEach((row, index) => {
    const email = clean(row.email)?.toLowerCase();
    const phone = clean(row.phone);
    if (email) {
      const prior = byEmail.get(email);
      if (prior === undefined) byEmail.set(email, index);
      else unite(prior, index);
    }
    if (phone) {
      const prior = byPhone.get(phone);
      if (prior === undefined) byPhone.set(phone, index);
      else unite(prior, index);
    }
  });

  const groups = new Map<number, ContactRow[]>();
  rows.forEach((row, index) => {
    const root = find(index);
    const group = groups.get(root);
    if (group) group.push(row);
    else groups.set(root, [row]);
  });

  const people = [...groups.values()].map(toPerson);
  people.sort((left, right) => right.signedUpAt.localeCompare(left.signedUpAt) || left.name.localeCompare(right.name));
  return people;
}

function toPerson(rows: ContactRow[]): PersonRecord {
  const ordered = [...rows].sort((left, right) => left.created_at.localeCompare(right.created_at));
  const latest = ordered[ordered.length - 1];
  const email = ordered.map((row) => clean(row.email)?.toLowerCase()).find(Boolean) ?? null;
  const phone = ordered.map((row) => clean(row.phone)).find(Boolean) ?? null;
  return {
    name: clean(latest.person_name) || "Someone",
    email,
    phone,
    photoCount: ordered.reduce((sum, row) => sum + Number(row.photos), 0),
    inDraw: ordered.some((row) => Number(row.draw) === 1),
    signedUpAt: ordered[0].created_at,
  };
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
