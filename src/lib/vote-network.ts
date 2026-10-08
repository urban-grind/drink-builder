import { createHash } from "node:crypto";

/** How many yes votes one network can add to a single photo. */
export const NETWORK_VOTES_PER_PHOTO = 3;

/** Rolling window for that cap. */
export const NETWORK_VOTE_WINDOW_MS = 10 * 60 * 1000;

export const NETWORK_VOTE_LIMIT_MESSAGE = "This photo already has 3 votes from this location.";

const HASH_PEPPER = "urban-grind-photo-network";

/** One-way label for a public address. The address itself is not stored. */
export function hashNetwork(address: string): string {
  return createHash("sha256").update(`${HASH_PEPPER}\n${address}`).digest("hex");
}

export function networkVoteCutoff(now: Date): string {
  return new Date(now.getTime() - NETWORK_VOTE_WINDOW_MS).toISOString();
}

/**
 * The public address the platform actually saw.
 * A visitor can put a fake address at the front of the forwarded list, so the last public one wins.
 */
export function clientNetworkAddress(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => normalizeAddress(part))
      .filter((part): part is string => part !== null);
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const address = parts[index];
      if (address && isPublicAddress(address)) return address;
    }
  }
  const real = normalizeAddress(headers.get("x-real-ip") ?? "");
  if (real && isPublicAddress(real)) return real;
  return null;
}

export function networkHashFrom(headers: Headers): string | null {
  const address = clientNetworkAddress(headers);
  return address ? hashNetwork(address) : null;
}

function normalizeAddress(raw: string): string | null {
  let value = raw.trim();
  if (!value || value.toLowerCase() === "unknown") return null;
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end <= 1) return null;
    value = value.slice(1, end);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }
  return value.toLowerCase();
}

function isPublicAddress(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPublicV4(mapped[1] ?? "");
  if (address.includes(":")) {
    if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) {
      return false;
    }
    return true;
  }
  return isPublicV4(address);
}

function isPublicV4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  if (first === 10 || first === 127 || first === 0) return false;
  if (first === 192 && second === 168) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  return true;
}
