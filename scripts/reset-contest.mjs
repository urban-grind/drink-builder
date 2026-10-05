/**
 * Deletes contest photos, votes, and swipes from one SQLite file, then deletes
 * the stored files those rows pointed at. Drink-builder recipes are left alone.
 *
 * This only removes keys recorded in the database you pass. It does not empty
 * the whole photo bucket, so another copy of the app keeps its own files.
 *
 * Dry run:
 *   node scripts/reset-contest.mjs --database /path/to/drinks.db --dry-run
 *
 * Delete:
 *   CONTEST_RESET=yes node scripts/reset-contest.mjs --database /path/to/drinks.db
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

loadEnv(path.join(process.cwd(), ".env"));

const args = parseArgs(process.argv.slice(2));
if (!args.database) {
  console.error("Pass --database with the SQLite file to clear.");
  process.exit(1);
}

const databasePath = path.resolve(args.database);
if (!fs.existsSync(databasePath)) {
  console.error(`No database file at ${databasePath}`);
  process.exit(1);
}

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON");

const entries = tableExists(db, "photo_entries") ? count(db, "photo_entries") : 0;
const votes = tableExists(db, "photo_votes") ? count(db, "photo_votes") : 0;
const swipes = tableExists(db, "photo_swipes") ? count(db, "photo_swipes") : 0;
const uploads = tableExists(db, "photo_uploads") ? count(db, "photo_uploads") : 0;
const keys = collectKeys(db);

console.log(databasePath);
console.log(`${entries} photos, ${votes} votes, ${swipes} swipes, ${uploads} uploads, ${keys.length} stored files`);

if (args.dryRun) {
  db.close();
  process.exit(0);
}

if (process.env.CONTEST_RESET !== "yes") {
  console.error("Nothing was deleted. Set CONTEST_RESET=yes to delete those contest rows and files.");
  db.close();
  process.exit(1);
}

db.exec("BEGIN IMMEDIATE");
try {
  if (tableExists(db, "photo_votes")) db.exec("DELETE FROM photo_votes");
  if (tableExists(db, "photo_swipes")) db.exec("DELETE FROM photo_swipes");
  if (tableExists(db, "photo_entries")) db.exec("DELETE FROM photo_entries");
  if (tableExists(db, "photo_uploads")) db.exec("DELETE FROM photo_uploads");
  db.exec("COMMIT");
} catch (error) {
  try {
    db.exec("ROLLBACK");
  } catch {
    // The transaction may already be closed.
  }
  db.close();
  throw error;
}
db.close();

const storage = storageClient();
let removed = 0;
let failed = 0;
if (storage && keys.length > 0) {
  for (const key of keys) {
    try {
      await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
      removed += 1;
    } catch {
      failed += 1;
    }
  }
} else if (keys.length > 0) {
  failed = keys.length;
  console.error("Photo storage is not configured, so the files were left in the bucket.");
}

console.log(`Cleared the contest tables. Removed ${removed} stored files.${failed > 0 ? ` ${failed} files could not be removed.` : ""}`);

function collectKeys(database) {
  const found = new Set();
  if (tableExists(database, "photo_entries")) {
    const rows = database.prepare("SELECT original_key, vote_key, thumb_key FROM photo_entries").all();
    for (const row of rows) addKey(found, row.original_key), addKey(found, row.vote_key), addKey(found, row.thumb_key);
  }
  if (tableExists(database, "photo_uploads")) {
    const rows = database.prepare("SELECT id, object_key, vote_key, thumb_key FROM photo_uploads").all();
    for (const row of rows) {
      addKey(found, row.object_key);
      addKey(found, row.vote_key);
      addKey(found, row.thumb_key);
      if (typeof row.id === "string") addKey(found, `board/${row.id}-preview.webp`);
    }
  }
  return [...found];
}

function addKey(found, key) {
  if (typeof key !== "string" || key.length === 0 || key.startsWith("local-sample/")) return;
  found.add(key);
}

function tableExists(database, name) {
  const row = database.prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  return Boolean(row);
}

function count(database, name) {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get();
  return Number(row?.count ?? 0);
}

function storageClient() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const endpoint = process.env.R2_ENDPOINT?.trim();
  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const parsed = { database: "", dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--database") parsed.database = argv[(index += 1)] ?? "";
    else if (arg.startsWith("--database=")) parsed.database = arg.slice("--database=".length);
    else {
      console.error(`Unknown argument ${arg}`);
      process.exit(1);
    }
  }
  return parsed;
}
