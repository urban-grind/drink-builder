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

/** Letters or an @ mean they are typing an email. Digits and phone punctuation mean a number. */
export function contactLooksLikeEmail(value: string): boolean {
  return /[a-z@]/i.test(value);
}

export type TypedContact =
  | { ok: true; email: string | null; phone: string | null; message: null }
  | { ok: false; email: null; phone: null; message: string };

/** One box. The rules follow whatever is in it. */
export function parseTypedContact(value: string): TypedContact {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, email: null, phone: null, message: "Add an email or a phone number." };
  }
  if (contactLooksLikeEmail(trimmed)) {
    const email = trimmed.toLowerCase();
    if (email.length > PHOTO_EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
      return { ok: false, email: null, phone: null, message: "Enter an email address like name@example.com." };
    }
    return { ok: true, email, phone: null, message: null };
  }
  const phone = normalizePhone(trimmed);
  if (!phone) {
    return { ok: false, email: null, phone: null, message: "Enter a phone number like 705-555-0199." };
  }
  return { ok: true, email: null, phone, message: null };
}

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

export function termsAgreementError(input: unknown): string | null {
  if (isRecord(input) && input.agreedToTerms === true) return null;
  return "Agree to the terms and conditions.";
}

function readPersonName(value: unknown): { name: string | null; error: string | null } {
  const personName = typeof value === "string" ? cleanText(value) : null;
  if (!personName) return { name: null, error: "Add your name." };
  if (personName.length > PHOTO_NAME_MAX) {
    return { name: null, error: `Keep your name to ${PHOTO_NAME_MAX} characters or fewer.` };
  }
  if (hasRudeLanguage(personName)) return { name: null, error: "Please use different wording for your name." };
  return { name: personName, error: null };
}

export type DrawEntryInput = {
  personName: string;
  email: string | null;
  phone: string | null;
};

/** Name plus one way to reach the person. Same rules as a photo entry, without the drink. */
export function parseDrawEntry(input: unknown): { ok: true; value: DrawEntryInput } | { ok: false; message: string; fields: FieldErrors } {
  if (!isRecord(input)) {
    return { ok: false, message: "Check the form and try again.", fields: {} };
  }

  const fields: FieldErrors = {};
  const name = readPersonName(input.personName);
  if (!name.name) fields.personName = name.error ?? "Add your name.";

  const contact = parsePhotoContact(input);
  if (!contact.email && !contact.phone) {
    fields.contact = contact.fields.email || contact.fields.phone || "Add an email or a phone number.";
  } else if (contact.fields.email || contact.fields.phone) {
    fields.contact = contact.fields.email || contact.fields.phone || "Enter a valid email or phone number.";
  }

  if (Object.keys(fields).length > 0 || !name.name) {
    const messages = [...new Set(Object.values(fields))];
    return {
      ok: false,
      message: messages.length === 1 ? messages[0] : "Check the fields below and try again.",
      fields,
    };
  }

  return { ok: true, value: { personName: name.name, email: contact.email, phone: contact.phone } };
}

export function validatePhotoEntry(input: unknown): PhotoValidationResult {
  if (!isRecord(input)) {
    return { ok: false, message: "Check the form and try again.", fields: {} };
  }

  const fields: FieldErrors = {};

  const name = readPersonName(input.personName);
  const personName = name.name;
  if (!personName) fields.personName = name.error ?? "Add your name.";

  const contact = parsePhotoContact(input);
  Object.assign(fields, contact.fields);
  const email = contact.email;
  const phone = contact.phone;

  let drinkName = "";
  if (typeof input.drinkName === "string") {
    drinkName = cleanText(input.drinkName);
    if (drinkName.length > PHOTO_NAME_MAX) {
      fields.drinkName = `Keep the drink name to ${PHOTO_NAME_MAX} characters or fewer.`;
    } else if (drinkName && hasRudeLanguage(drinkName)) {
      fields.drinkName = "Please use different wording for the drink name.";
    }
  } else if (input.drinkName != null) {
    fields.drinkName = "Name the drink.";
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

  if (Object.keys(fields).length > 0 || !personName || caption === null || (!email && !phone)) {
    const messages = [...new Set(Object.values(fields))];
    return {
      ok: false,
      message: messages.length === 1 ? messages[0] : "Check the fields below and try again.",
      fields,
    };
  }

  return { ok: true, value: { personName, email, phone, drinkName, caption } };
}
