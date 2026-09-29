import { addIns, baseAllowsNone, bases, coldFoams, milks, sauces, selectionLimits, syrups } from "@/lib/menu";
import { hasRudeLanguage } from "@/lib/rude-words";
import type { FieldErrors, PublishInput } from "@/lib/types";

const NAME_MAX = 60;
const DESCRIPTION_MAX = 400;
const EMAIL_MAX = 254;

const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export type ValidationResult =
  | { ok: true; value: PublishInput }
  | { ok: false; message: string; fields: FieldErrors };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function readSelection(
  value: unknown,
  catalog: readonly { id: string }[],
  limit: number,
  noun: string,
  limitMessage: string,
): { ids: string[]; error?: string } {
  if (!Array.isArray(value)) {
    return { ids: [], error: `Send ${noun} as a list.` };
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !catalog.some((item) => item.id === entry)) {
      return { ids: [], error: `One of those ${noun} isn't on the menu.` };
    }
    if (!ids.includes(entry)) ids.push(entry);
  }
  if (ids.length > limit) {
    return { ids, error: limitMessage };
  }
  return { ids };
}

export function validatePublish(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      message: "Send the drink as a set of fields.",
      fields: {},
    };
  }

  const fields: FieldErrors = {};

  const name = typeof input.name === "string" ? cleanText(input.name) : null;
  if (!name) fields.name = "Name the drink.";
  else if (name.length > NAME_MAX) fields.name = `Keep the drink name to ${NAME_MAX} characters or fewer.`;
  else if (hasRudeLanguage(name)) fields.name = "Please use different wording for the drink name.";

  const description =
    input.description === undefined || input.description === null
      ? ""
      : typeof input.description === "string"
        ? cleanText(input.description)
        : null;
  if (description === null) fields.description = "The description should be text.";
  else if (description.length > DESCRIPTION_MAX) {
    fields.description = `Keep the description to ${DESCRIPTION_MAX} characters or fewer.`;
  } else if (hasRudeLanguage(description)) {
    fields.description = "Please use different wording in the description.";
  }

  const creatorName = typeof input.creatorName === "string" ? cleanText(input.creatorName) : null;
  if (!creatorName) fields.creatorName = "Add your name.";
  else if (creatorName.length > NAME_MAX) {
    fields.creatorName = `Keep your name to ${NAME_MAX} characters or fewer.`;
  } else if (hasRudeLanguage(creatorName)) {
    fields.creatorName = "Please use different wording for your name.";
  }

  const creatorEmail =
    typeof input.creatorEmail === "string" ? input.creatorEmail.trim().toLowerCase() : null;
  if (!creatorEmail) fields.creatorEmail = "Add an email. It stays off the board.";
  else if (creatorEmail.length > EMAIL_MAX || !EMAIL_PATTERN.test(creatorEmail)) {
    fields.creatorEmail = "Enter an email address like name@example.com.";
  }

  const base = typeof input.base === "string" ? input.base : "";
  if (!bases.some((item) => item.id === base)) {
    fields.base = "Choose a base from the menu.";
  }

  const milk = typeof input.milk === "string" ? input.milk : "";
  if (!milks.some((item) => item.id === milk)) {
    fields.milk = "Choose a milk, or None.";
  } else if (milk === "none" && !baseAllowsNone(base)) {
    fields.milk = "Choose Milk, Cream, Oat, Almond, or Protein milk.";
  }

  const syrupPick = readSelection(
    input.syrups,
    syrups,
    selectionLimits.syrups,
    "syrups",
    "Pick at most 2 syrups.",
  );
  if (syrupPick.error) fields.syrups = syrupPick.error;

  const saucePick = readSelection(
    input.sauces,
    sauces,
    selectionLimits.sauces,
    "sauces",
    "Pick at most 1 sauce.",
  );
  if (saucePick.error) fields.sauces = saucePick.error;

  const addInPick = readSelection(
    input.addIns,
    addIns,
    selectionLimits.addIns,
    "add-ins",
    "Pick at most 2 add-ins.",
  );
  if (addInPick.error) fields.addIns = addInPick.error;

  const coldFoam = typeof input.coldFoam === "string" ? input.coldFoam : "";
  if (coldFoam && !coldFoams.some((item) => item.id === coldFoam)) {
    fields.coldFoam = "Choose a cold foam from the menu, or none.";
  }

  if (!fields.sauces && !fields.syrups && saucePick.ids.length > 0 && syrupPick.ids.length > 1) {
    const pairMessage = "Either one sauce and one syrup, or two syrups. Not a sauce plus two syrups.";
    fields.sauces = pairMessage;
    fields.syrups = pairMessage;
  }

  if (Object.keys(fields).length > 0 || !name || !creatorName || !creatorEmail || description === null) {
    const messages = [...new Set(Object.values(fields))];
    return {
      ok: false,
      message: messages.length === 1 ? messages[0] : "Check the fields below and try again.",
      fields,
    };
  }

  return {
    ok: true,
    value: {
      name,
      description,
      creatorName,
      creatorEmail,
      base,
      milk,
      syrups: syrupPick.ids,
      sauces: saucePick.ids,
      coldFoam,
      addIns: addInPick.ids,
    },
  };
}

export function parseVoterId(value: unknown): { ok: true; voterId: string } | { ok: false } {
  if (typeof value !== "string" || !isUuid(value)) return { ok: false };
  return { ok: true, voterId: value };
}
