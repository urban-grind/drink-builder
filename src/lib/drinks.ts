import { cupPhotoExists, cupPhotoUrl, readCupPhoto, writeCupPhoto } from "@/lib/cup-photo";
import { beginImmediate, getDb, isUniqueConstraint, rollbackQuietly } from "@/lib/db";
import type { PublicDrink, PublishInput, RecipeSelection } from "@/lib/types";

type DrinkRow = {
  id: string;
  name: string;
  description: string;
  creator_name: string;
  base: string;
  milk: string | number;
  syrups: string;
  sauces: string;
  cold_foam: string;
  add_ins: string;
  created_at: string;
  vote_count: number;
  voted: number;
};

function parseIdList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function milkIdFromRow(value: string | number): string {
  if (value === 1 || value === "1") return "milk";
  if (value === 0 || value === "0") return "none";
  return typeof value === "string" && value ? value : "none";
}

function toPublic(row: DrinkRow): PublicDrink {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    creatorName: row.creator_name,
    base: row.base,
    milk: milkIdFromRow(row.milk),
    syrups: parseIdList(row.syrups),
    sauces: parseIdList(row.sauces),
    coldFoam: row.cold_foam ?? "",
    addIns: parseIdList(row.add_ins),
    createdAt: row.created_at,
    voteCount: Number(row.vote_count),
    voted: Number(row.voted) === 1,
    photoUrl: cupPhotoUrl(row.id),
  };
}

const selectDrink = `
  SELECT
    d.id,
    d.name,
    d.description,
    d.creator_name,
    d.base,
    d.milk,
    d.syrups,
    d.sauces,
    d.cold_foam,
    d.add_ins,
    d.created_at,
    (SELECT COUNT(*) FROM votes v WHERE v.drink_id = d.id) AS vote_count,
    EXISTS(
      SELECT 1 FROM votes v WHERE v.drink_id = d.id AND v.voter_id = ?
    ) AS voted
  FROM drinks d
`;

function queryDrinks(sort: "top" | "newest", voterId: string): PublicDrink[] {
  const order =
    sort === "top"
      ? "ORDER BY vote_count DESC, d.created_at DESC"
      : "ORDER BY d.created_at DESC";
  const rows = getDb().prepare(`${selectDrink} ${order}`).all(voterId) as DrinkRow[];
  return rows.map(toPublic);
}

/** New shows this many of the most recently created drinks, then cycles through them. */
export const NEW_DRINK_LIMIT = 10;

type SavedRecipeRow = {
  id: string;
  base: string;
  milk: string | number;
  syrups: string;
  sauces: string;
  cold_foam: string;
  add_ins: string;
};

function recipeFromRow(row: SavedRecipeRow): RecipeSelection {
  return {
    base: row.base,
    milk: milkIdFromRow(row.milk),
    syrups: parseIdList(row.syrups),
    sauces: parseIdList(row.sauces),
    coldFoam: row.cold_foam ?? "",
    addIns: parseIdList(row.add_ins),
  };
}

let backfillTask: Promise<void> | null = null;

/** Render a card photo for every saved drink that does not have one yet. */
export function backfillCupPhotos(): Promise<void> {
  if (!backfillTask) {
    backfillTask = writeMissingCupPhotos().finally(() => {
      backfillTask = null;
    });
  }
  return backfillTask;
}

async function writeMissingCupPhotos(): Promise<void> {
  const rows = getDb()
    .prepare("SELECT id, base, milk, syrups, sauces, cold_foam, add_ins FROM drinks")
    .all() as SavedRecipeRow[];
  for (const row of rows) {
    if (cupPhotoExists(row.id)) continue;
    await writeCupPhoto(row.id, recipeFromRow(row));
  }
}

export function listBoard(voterId: string | null): { popular: PublicDrink[]; newest: PublicDrink[] } {
  const voter = voterId ?? "";
  return {
    popular: queryDrinks("top", voter),
    newest: queryDrinks("newest", voter).slice(0, NEW_DRINK_LIMIT),
  };
}

/** Return the saved card PNG, rendering it from the stored recipe when the file is missing. */
export async function readOrCreateCupPhoto(id: string): Promise<Buffer | null> {
  const existing = readCupPhoto(id);
  if (existing) return existing;
  const drink = getDrink(id, null);
  if (!drink) return null;
  await writeCupPhoto(id, {
    base: drink.base,
    milk: drink.milk,
    syrups: drink.syrups,
    sauces: drink.sauces,
    coldFoam: drink.coldFoam,
    addIns: drink.addIns,
  });
  return readCupPhoto(id);
}

export function getDrink(id: string, voterId: string | null): PublicDrink | null {
  const row = getDb()
    .prepare(`${selectDrink} WHERE d.id = ?`)
    .get(voterId ?? "", id) as DrinkRow | undefined;
  return row ? toPublic(row) : null;
}

export async function createDrink(
  input: PublishInput,
): Promise<{ ok: true; drink: PublicDrink } | { ok: false; code: "EMAIL_IN_USE" }> {
  const db = beginImmediate();
  try {
    const existing = db.prepare("SELECT 1 AS found FROM drinks WHERE creator_email = ?").get(input.creatorEmail);
    if (existing) {
      db.exec("ROLLBACK");
      return { ok: false, code: "EMAIL_IN_USE" };
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO drinks (
        id, name, description, creator_name, creator_email, base, milk, syrups, sauces, cold_foam, add_ins, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.name,
      input.description,
      input.creatorName,
      input.creatorEmail,
      input.base,
      input.milk,
      JSON.stringify(input.syrups),
      JSON.stringify(input.sauces),
      input.coldFoam,
      JSON.stringify(input.addIns),
      createdAt,
    );
    db.exec("COMMIT");
    try {
      await writeCupPhoto(id, input);
    } catch (error) {
      getDb().prepare("DELETE FROM drinks WHERE id = ?").run(id);
      throw error;
    }
    const drink = getDrink(id, null);
    if (!drink) throw new Error("Saved drink could not be read back.");
    return { ok: true, drink };
  } catch (error) {
    rollbackQuietly();
    if (isUniqueConstraint(error)) return { ok: false, code: "EMAIL_IN_USE" };
    throw error;
  }
}

export function castVote(
  drinkId: string,
  voterId: string,
):
  | { ok: true; drink: PublicDrink }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_VOTED" } {
  const db = beginImmediate();
  try {
    const drink = db.prepare("SELECT 1 AS found FROM drinks WHERE id = ?").get(drinkId);
    if (!drink) {
      db.exec("ROLLBACK");
      return { ok: false, code: "NOT_FOUND" };
    }

    const existing = db
      .prepare("SELECT 1 AS found FROM votes WHERE drink_id = ? AND voter_id = ?")
      .get(drinkId, voterId);
    if (existing) {
      db.exec("ROLLBACK");
      return { ok: false, code: "ALREADY_VOTED" };
    }

    db.prepare("INSERT INTO votes (drink_id, voter_id, created_at) VALUES (?, ?, ?)").run(
      drinkId,
      voterId,
      new Date().toISOString(),
    );
    db.exec("COMMIT");
  } catch (error) {
    rollbackQuietly();
    if (isUniqueConstraint(error)) return { ok: false, code: "ALREADY_VOTED" };
    throw error;
  }

  const drink = getDrink(drinkId, voterId);
  if (!drink) return { ok: false, code: "NOT_FOUND" };
  return { ok: true, drink };
}
