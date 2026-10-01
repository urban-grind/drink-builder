import { getDb } from "@/lib/db";

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";
const CODE_LENGTH = 6;

export function isPhotoCode(value: string): boolean {
  return /^[a-z0-9]{6}$/.test(value);
}

export function randomPhotoCode(): string {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[crypto.getRandomValues(new Uint8Array(1))[0] % ALPHABET.length];
  }
  return code;
}

/** Picks a code that is not already stored. Retries stay inside this call. */
export function takePhotoCode(reserved: ReadonlySet<string> = new Set()): string {
  const taken = getDb().prepare("SELECT 1 AS found FROM photo_entries WHERE public_code = ?");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomPhotoCode();
    if (reserved.has(code)) continue;
    if (!taken.get(code)) return code;
  }
  throw new Error("Could not assign a photo code.");
}
