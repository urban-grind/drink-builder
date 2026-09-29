import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

if (typeof window !== "undefined") {
  throw new Error("The drink database is only available on the server.");
}

const globalForDb = globalThis as unknown as { drinkDb?: DatabaseSync };

function createDatabase(): DatabaseSync {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "drinks.db"));
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

export function getDb(): DatabaseSync {
  if (!globalForDb.drinkDb) {
    globalForDb.drinkDb = createDatabase();
  } else {
    ensureMilkStoresChoice(globalForDb.drinkDb);
    ensureColdFoamColumn(globalForDb.drinkDb);
  }
  return globalForDb.drinkDb;
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
