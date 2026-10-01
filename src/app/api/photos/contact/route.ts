import { jsonError, jsonOk } from "@/lib/api";
import { readPhotoJson } from "@/lib/photo-http";
import { checkPhotoContact } from "@/lib/photos";
import { safeErrorText } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readPhotoJson(request);
  if (!body.ok) return body.response;

  try {
    const result = checkPhotoContact({
      email: valueOf(body.value, "email"),
      phone: valueOf(body.value, "phone"),
    });
    if (!result.ok) {
      const status =
        result.code === "EMAIL_IN_USE" || result.code === "PHONE_IN_USE" || result.code === "CONTACT_IN_USE"
          ? 409
          : 400;
      return jsonError(status, result.code, result.message, result.fields);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    console.error("Failed to check a photo contact", safeErrorText(error));
    return jsonError(500, "SERVER", "The photo didn't go through. Try again.");
  }
}

function valueOf(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object" || Array.isArray(record)) return undefined;
  return (record as Record<string, unknown>)[key];
}
