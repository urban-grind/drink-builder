/**
 * Sends real contest entries through the same upload the site uses.
 * Twenty people at once, each uploading the five photos in order.
 *
 *   node scripts/contest-burst.mjs --base https://the-live-site --users 20 --each 5 --approve
 *
 * --approve signs in with PHOTO_REVIEW_PASSWORD from the environment and
 * approves each new photo. Without that, production holds them for review
 * and they stay off the board.
 */
import fs from "node:fs";
import path from "node:path";

loadEnv(path.join(process.cwd(), ".env"));

const NAMES = [
  "Avery",
  "Nico",
  "Quinn",
  "Rowan",
  "Harper",
  "Eden",
  "Luis",
  "Noor",
  "Casey",
  "Remy",
  "Jules",
  "Sasha",
  "Omar",
  "Riley",
  "Devon",
  "Mina",
  "Theo",
  "Willa",
  "Chris",
  "Parker",
];

const DRINKS = ["Iced vanilla latte", "Maple oat latte", "Cold brew", "Sweet cream cold brew", "Cloud 9 latte"];

const DEFAULT_IMAGES = [
  "public/photos/counter.jpg",
  "public/photos/cup-beans.jpg",
  "public/photos/wall-drink.jpg",
  "public/photos/00000107-PHOTO-2025-02-24-20-21-01.jpg",
  "public/contest-snap.jpg",
];

const TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

const args = parseArgs(process.argv.slice(2));
if (!args.base) {
  console.error("Pass --base with the site address, for example http://127.0.0.1:43117");
  process.exit(1);
}

const base = args.base.replace(/\/$/, "");
const images = (args.images.length > 0 ? args.images : DEFAULT_IMAGES).map((file) => path.resolve(file));
for (const file of images) {
  if (!fs.existsSync(file)) {
    console.error(`Missing photo ${file}`);
    process.exit(1);
  }
}
if (args.each > images.length) {
  console.error(`--each is ${args.each}, but only ${images.length} photos were given.`);
  process.exit(1);
}
if (args.users > NAMES.length) {
  console.error(`--users can be at most ${NAMES.length}.`);
  process.exit(1);
}

const started = Date.now();
const results = await Promise.all(
  NAMES.slice(0, args.users).map((name, index) =>
    enterAs(base, {
      name,
      email: `contest-load-${String(index + 1).padStart(2, "0")}@urbangrind.test`,
      files: images.slice(0, args.each),
    }),
  ),
);

const saved = results.flatMap((result) => result.saved);
const failures = results.flatMap((result) => result.failures);
console.log(`${saved.length} photos entered, ${failures.length} failed, ${Math.round((Date.now() - started) / 1000)}s`);
for (const failure of failures) console.error(`${failure.email} ${failure.file}: ${failure.message}`);

if (args.approve && saved.length > 0) {
  const password = process.env.PHOTO_REVIEW_PASSWORD?.trim();
  if (!password) {
    console.error("Set PHOTO_REVIEW_PASSWORD to approve the new photos.");
    process.exit(1);
  }
  const cookie = await reviewCookie(base, password);
  let approved = 0;
  for (const photo of saved) {
    if (photo.status === "approved") {
      approved += 1;
      continue;
    }
    await api(base, `/api/photos/${photo.id}/moderate`, {
      method: "POST",
      cookie,
      body: JSON.stringify({ action: "approve" }),
    });
    approved += 1;
  }
  console.log(`Approved ${approved} photos.`);
}

if (failures.length > 0) process.exit(1);

async function enterAs(site, person) {
  const saved = [];
  const failures = [];
  for (const file of person.files) {
    try {
      const photo = await uploadOne(site, file, person);
      saved.push(photo);
      console.log(`${person.name} entered ${path.basename(file)} (${photo.status}, ${photo.ms}ms)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The upload failed.";
      failures.push({ email: person.email, file: path.basename(file), message });
    }
  }
  return { saved, failures };
}

async function uploadOne(site, file, person) {
  const bytes = fs.readFileSync(file);
  const contentType = TYPES[path.extname(file).toLowerCase()];
  if (!contentType) throw new Error("Use a JPEG, PNG, WebP, or HEIC photo.");
  const startedAt = Date.now();
  const presign = await api(site, "/api/photos/upload", {
    method: "POST",
    body: JSON.stringify({ contentType, contentLength: bytes.length, fileName: path.basename(file) }),
  });
  const upload = presign.body;
  const put = await fetch(upload.uploadUrl, {
    method: "PUT",
    body: bytes,
    headers: { "content-type": upload.contentType },
  });
  if (!put.ok) throw new Error(`The photo store rejected the file (${put.status}).`);
  await api(site, `/api/photos/upload/${upload.uploadId}/prepare`, { method: "POST" });
  const created = await api(site, "/api/photos", {
    method: "POST",
    body: JSON.stringify({
      uploadId: upload.uploadId,
      personName: person.name,
      email: person.email,
      drinkName: DRINKS[person.files.indexOf(file)] ?? "Urban Grind",
      caption: "",
      agreedToTerms: true,
    }),
  });
  return {
    id: created.body.id,
    status: created.body.status,
    ms: Date.now() - startedAt,
  };
}

async function reviewCookie(site, password) {
  const response = await fetch(new URL("/api/photos/review/login", site), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: site,
    },
    body: JSON.stringify({ password }),
  });
  const body = await readBody(response);
  if (!response.ok) throw new Error(messageOf(body, response.status));
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const header = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  if (!header) throw new Error("Review signed in, but no session cookie came back.");
  return header;
}

async function api(site, pathname, options) {
  const response = await fetch(new URL(pathname, site), {
    method: options.method,
    body: options.body,
    headers: {
      accept: "application/json",
      origin: site,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
  });
  const body = await readBody(response);
  if (!response.ok) throw new Error(messageOf(body, response.status));
  return { body };
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 180) } };
  }
}

function messageOf(body, status) {
  if (body && typeof body === "object" && body.error && typeof body.error.message === "string") return body.error.message;
  return `The site returned ${status}.`;
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
  const parsed = { base: "", users: 20, each: 5, approve: false, images: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--approve") parsed.approve = true;
    else if (arg === "--base") parsed.base = argv[(index += 1)] ?? "";
    else if (arg === "--users") parsed.users = numberArg(argv[(index += 1)], "--users");
    else if (arg === "--each") parsed.each = numberArg(argv[(index += 1)], "--each");
    else if (arg === "--images") parsed.images = (argv[(index += 1)] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    else {
      console.error(`Unknown argument ${arg}`);
      process.exit(1);
    }
  }
  return parsed;
}

function numberArg(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.error(`${flag} needs a whole number.`);
    process.exit(1);
  }
  return parsed;
}
