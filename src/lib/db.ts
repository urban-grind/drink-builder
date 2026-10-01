import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

if (typeof window !== "undefined") {
  throw new Error("The drink database is only available on the server.");
}

const globalForDb = globalThis as unknown as { drinkDb?: DatabaseSync };

function databaseFile(): string {
  const override = process.env.DRINK_DB_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), "data", "drinks.db");
}

function createDatabase(): DatabaseSync {
  const file = databaseFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS drinks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      creator_email TEXT NOT NULL UNIQUE,
      base TEXT NOT NULL,
      milk TEXT NOT NULL,
      syrups TEXT NOT NULL,
      sauces TEXT NOT NULL,
      cold_foam TEXT NOT NULL DEFAULT '',
      add_ins TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS votes (
      drink_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (drink_id, voter_id),
      FOREIGN KEY (drink_id) REFERENCES drinks(id)
    );
    CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes (voter_id);
  `);
  ensureMilkStoresChoice(db);
  ensureColdFoamColumn(db);
  ensurePhotoTables(db);
  return db;
}

/** Older databases stored milk as 0 or 1. Keep those drinks as None or Milk. */
function ensureMilkStoresChoice(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(drinks)").all() as { name: string; type: string }[];
  const milkColumn = columns.find((column) => column.name === "milk");
  if (!milkColumn || milkColumn.type.toUpperCase() === "TEXT") return;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN IMMEDIATE");
    db.exec(`
      CREATE TABLE drinks_migrated (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        creator_email TEXT NOT NULL UNIQUE,
        base TEXT NOT NULL,
        milk TEXT NOT NULL,
        syrups TEXT NOT NULL,
        sauces TEXT NOT NULL,
        cold_foam TEXT NOT NULL DEFAULT '',
        add_ins TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO drinks_migrated (
        id, name, description, creator_name, creator_email, base, milk, syrups, sauces, add_ins, created_at
      )
      SELECT
        id, name, description, creator_name, creator_email, base,
        CASE milk WHEN 1 THEN 'milk' ELSE 'none' END,
        syrups, sauces, add_ins, created_at
      FROM drinks;
      DROP TABLE drinks;
      ALTER TABLE drinks_migrated RENAME TO drinks;
    `);
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The migration transaction did not stay open.
    }
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

function ensureColdFoamColumn(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(drinks)").all() as { name: string }[];
  if (columns.some((column) => column.name === "cold_foam")) return;
  db.exec("ALTER TABLE drinks ADD COLUMN cold_foam TEXT NOT NULL DEFAULT ''");
}

function ensurePhotoTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_uploads (
      id TEXT PRIMARY KEY,
      object_key TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      content_length INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS photo_entries (
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
    CREATE TABLE IF NOT EXISTS photo_votes (
      photo_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (photo_id, voter_id),
      FOREIGN KEY (photo_id) REFERENCES photo_entries(id)
    );
    CREATE INDEX IF NOT EXISTS idx_photo_votes_voter ON photo_votes (voter_id);
    CREATE INDEX IF NOT EXISTS idx_photo_entries_status ON photo_entries (status, created_at);
    CREATE TABLE IF NOT EXISTS photo_swipes (
      voter_id TEXT NOT NULL,
      photo_id TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (voter_id, photo_id),
      FOREIGN KEY (photo_id) REFERENCES photo_entries(id)
    );
    CREATE INDEX IF NOT EXISTS idx_photo_swipes_voter ON photo_swipes (voter_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_photo_swipes_photo ON photo_swipes (photo_id, action);
  `);
  const columns = db.prepare("PRAGMA table_info(photo_entries)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "public_code")) {
    db.exec("ALTER TABLE photo_entries ADD COLUMN public_code TEXT");
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_entries_public_code ON photo_entries (public_code)",
  );
}

export function getDb(): DatabaseSync {
  if (!globalForDb.drinkDb) {
    globalForDb.drinkDb = createDatabase();
  } else {
    ensureMilkStoresChoice(globalForDb.drinkDb);
    ensureColdFoamColumn(globalForDb.drinkDb);
    ensurePhotoTables(globalForDb.drinkDb);
  }
  return globalForDb.drinkDb;
}

/** Closes the cached connection so tests can point DRINK_DB_PATH at a fresh file. */
export function resetDbForTests(): void {
  const db = globalForDb.drinkDb as { close?: () => void } | undefined;
  globalForDb.drinkDb = undefined;
  try {
    db?.close?.();
  } catch {
    // Already closed.
  }
}

export function beginImmediate(): DatabaseSync {
  const db = getDb();
  try {
    db.exec("BEGIN IMMEDIATE");
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The connection was not left inside a transaction.
    }
    db.exec("BEGIN IMMEDIATE");
  }
  return db;
}

export function rollbackQuietly(): void {
  try {
    getDb().exec("ROLLBACK");
  } catch {
    // Already closed or never started.
  }
}

export function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
