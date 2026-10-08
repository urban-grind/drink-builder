import { getDb, isUniqueConstraint } from "@/lib/db";
import { formatStoredPhone, parseDrawEntry } from "@/lib/photo-validation";
import type { FieldErrors } from "@/lib/types";
import { isUuid } from "@/lib/validation";

const PHOTO_ID_LIMIT = 40;

type EntrantRow = {
  person_name: string;
  email: string | null;
  phone: string | null;
};

export function drawEntrantKnown(voterId: string): boolean {
  if (!isUuid(voterId)) return false;
  const row = getDb().prepare("SELECT 1 AS ok FROM draw_entrants WHERE voter_id = ?").get(voterId) as
    | { ok: number }
    | undefined;
  return Boolean(row);
}

export function countDrawSwipes(voterId: string): number {
  if (!isUuid(voterId)) return 0;
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM photo_swipes WHERE voter_id = ?").get(voterId) as
    | { count: number }
    | undefined;
  return Number(row?.count ?? 0);
}

export function drawProgress(voterId: string): { known: boolean; swipes: number } {
  return { known: drawEntrantKnown(voterId), swipes: countDrawSwipes(voterId) };
}

/** Name and contact this browser already saved, ready to drop into the photo form. */
export function drawEntrantProfile(voterId: string): { personName: string; contact: string } | null {
  if (!isUuid(voterId)) return null;
  const row = getDb()
    .prepare("SELECT person_name, email, phone FROM draw_entrants WHERE voter_id = ?")
    .get(voterId) as EntrantRow | undefined;
  if (!row) return null;
  const personName = row.person_name.trim();
  const email = row.email?.trim() ?? "";
  const phone = row.phone?.trim() ?? "";
  const contact = email || (phone.length === 10 ? formatStoredPhone(phone) : phone);
  if (!personName || !contact) return null;
  return { personName, contact };
}

/**
 * Copies the name and contact from a photo this browser already entered.
 * The first identity sticks. Nothing about the person is returned to the caller.
 */
export function claimDrawEntrant(voterId: string, photoIds: readonly string[]): boolean {
  if (!isUuid(voterId)) return false;
  if (drawEntrantKnown(voterId)) return true;
  const ids = [...new Set(photoIds.filter((id) => isUuid(id)))].slice(0, PHOTO_ID_LIMIT);
  if (ids.length === 0) return false;
  const placeholders = ids.map(() => "?").join(", ");
  const row = getDb()
    .prepare(
      `SELECT person_name, email, phone
       FROM photo_entries
       WHERE id IN (${placeholders})
         AND status IN ('pending', 'approved')
         AND trim(person_name) <> ''
         AND (
           (email IS NOT NULL AND trim(email) <> '')
           OR (phone IS NOT NULL AND trim(phone) <> '')
         )
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(...ids) as EntrantRow | undefined;
  if (!row) return false;
  return insertEntrant(voterId, row.person_name, row.email, row.phone);
}

export function saveDrawEntrant(
  voterId: string,
  input: unknown,
): { ok: true; known: true } | { ok: false; code: "VALIDATION"; message: string; fields: FieldErrors } {
  if (!isUuid(voterId)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "That voter id is not valid.",
      fields: { voterId: "Send the voter id stored in this browser." },
    };
  }
  if (drawEntrantKnown(voterId)) return { ok: true, known: true };
  const parsed = parseDrawEntry(input);
  if (!parsed.ok) return { ok: false, code: "VALIDATION", message: parsed.message, fields: parsed.fields };
  insertEntrant(voterId, parsed.value.personName, parsed.value.email, parsed.value.phone);
  return { ok: true, known: true };
}

function insertEntrant(voterId: string, personName: string, email: string | null, phone: string | null): boolean {
  try {
    getDb()
      .prepare(
        `INSERT INTO draw_entrants (voter_id, person_name, email, phone, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(voterId, personName, email, phone, new Date().toISOString());
    return true;
  } catch (error) {
    if (isUniqueConstraint(error)) return true;
    throw error;
  }
}
