import { hasRudeLanguage } from "@/lib/rude-words";
import type { FieldErrors } from "@/lib/types";
import type { PhotoEntryInput } from "@/lib/photo-types";

export const PHOTO_MAX_BYTES = 25 * 1024 * 1024;
export const PHOTO_NAME_MAX = 60;
export const PHOTO_CAPTION_MAX = 140;
export const PHOTO_EMAIL_MAX = 254;

export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Digits only, with a leading country code 1 removed from an 11-digit number. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return local;
}

export function formatStoredPhone(digits: string): string {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const EXTENSION_TYPES: Record<string, (typeof PHOTO_CONTENT_TYPES)[number]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePhotoType(type: string, fileName: string): string | null {
  const lower = type.toLowerCase().split(";")[0]?.trim() ?? "";
  if (lower === "image/jpg") return "image/jpeg";
  if ((PHOTO_CONTENT_TYPES as readonly string[]).includes(lower)) return lower;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if ((lower === "" || lower === "application/octet-stream") && EXTENSION_TYPES[ext]) {
    return EXTENSION_TYPES[ext];
  }
  return null;
}

export function parsePhotoUploadRequest(
  input: unknown,
): { ok: true; contentType: string; contentLength: number } | { ok: false; message: string } {
  if (!isRecord(input)) return { ok: false, message: "Send the photo type and size." };
  const fileName = typeof input.fileName === "string" ? input.fileName.slice(0, 240) : "";
  const rawType = typeof input.contentType === "string" ? input.contentType : "";
  const contentType = normalizePhotoType(rawType, fileName);
  if (!contentType) {
    return { ok: false, message: "Use a JPEG, PNG, WebP, or HEIC photo." };
  }
  const contentLength = input.contentLength;
  if (typeof contentLength !== "number" || !Number.isInteger(contentLength) || contentLength < 1) {
    return { ok: false, message: "That photo file looks empty." };
  }
  if (contentLength > PHOTO_MAX_BYTES) {
    return { ok: false, message: "That photo is over 25MB. Use a smaller one." };
  }
  return { ok: true, contentType, contentLength };
}

export const EMAIL_ALREADY_ENTERED = "You already entered with that email. Try again.";
export const PHONE_ALREADY_ENTERED = "You already entered with that number. Try again.";

export type PhotoValidationResult =
  | { ok: true; value: PhotoEntryInput }
  | { ok: false; message: string; fields: FieldErrors };

/** Email is stored in lowercase. Phone is 10 digits, so spacing and a leading 1 do not matter. */
export function parsePhotoContact(input: unknown): {
  email: string | null;
  phone: string | null;
  fields: FieldErrors;
} {
  if (!isRecord(input)) {
    return {
      email: null,
      phone: null,
      fields: {
        email: "Add an email or a phone number.",
        phone: "Add an email or a phone number.",
      },
    };
  }

  const fields: FieldErrors = {};
  const rawEmail = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const rawPhone = typeof input.phone === "string" ? input.phone.trim() : "";
  let email: string | null = null;
  let phone: string | null = null;
  if (!rawEmail && !rawPhone) {
    fields.email = "Add an email or a phone number.";
    fields.phone = "Add an email or a phone number.";
  } else {
    if (rawEmail) {
      if (rawEmail.length > PHOTO_EMAIL_MAX || !EMAIL_PATTERN.test(rawEmail)) {
        fields.email = "Enter an email address like name@example.com.";
      } else {
        email = rawEmail;
      }
    }
    if (rawPhone) {
      const normalized = normalizePhone(rawPhone);
      if (!normalized) fields.phone = "Enter a phone number like 705-555-0199.";
      else phone = normalized;
    }
  }
  return { email, phone, fields };
}

export function validatePhotoEntry(input: unknown): PhotoValidationResult {
  if (!isRecord(input)) {
    return { ok: false, message: "Check the form and try again.", fields: {} };
  }

  const fields: FieldErrors = {};

  const personName = typeof input.personName === "string" ? cleanText(input.personName) : null;
  if (!personName) fields.personName = "Add your name.";
  else if (personName.length > PHOTO_NAME_MAX) {
    fields.personName = `Keep your name to ${PHOTO_NAME_MAX} characters or fewer.`;
  } else if (hasRudeLanguage(personName)) {
    fields.personName = "Please use different wording for your name.";
  }

  const contact = parsePhotoContact(input);
  Object.assign(fields, contact.fields);
  const email = contact.email;
  const phone = contact.phone;

  const drinkName = typeof input.drinkName === "string" ? cleanText(input.drinkName) : null;
  if (!drinkName) fields.drinkName = "Name the drink.";
  else if (drinkName.length > PHOTO_NAME_MAX) {
    fields.drinkName = `Keep the drink name to ${PHOTO_NAME_MAX} characters or fewer.`;
  } else if (hasRudeLanguage(drinkName)) {
    fields.drinkName = "Please use different wording for the drink name.";
  }

  const caption =
    input.caption === undefined || input.caption === null
      ? ""
      : typeof input.caption === "string"
        ? cleanText(input.caption)
        : null;
  if (caption === null) fields.caption = "The caption should be text.";
  else if (caption.length > PHOTO_CAPTION_MAX) {
    fields.caption = `Keep the caption to ${PHOTO_CAPTION_MAX} characters or fewer.`;
  } else if (hasRudeLanguage(caption)) {
    fields.caption = "Please use different wording in the caption.";
  }

  if (Object.keys(fields).length > 0 || !personName || !drinkName || caption === null || (!email && !phone)) {
    const messages = [...new Set(Object.values(fields))];
    return {
      ok: false,
      message: messages.length === 1 ? messages[0] : "Check the fields below and try again.",
      fields,
    };
  }

  return { ok: true, value: { personName, email, phone, drinkName, caption } };
}
