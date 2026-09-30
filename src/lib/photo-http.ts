import { jsonError } from "@/lib/api";
import { readJsonLimited } from "@/lib/read-json";

export async function readPhotoJson(request: Request) {
  const body = await readJsonLimited(request);
  if (!body.ok && body.reason === "too-large") {
    return {
      ok: false as const,
      response: jsonError(
        413,
        "PAYLOAD_TOO_LARGE",
        "This address doesn't take the photo file. The photo uploads straight to storage.",
      ),
    };
  }
  if (!body.ok) {
    return { ok: false as const, response: jsonError(400, "BAD_JSON", "Send that as JSON.") };
  }
  return { ok: true as const, value: body.value };
}
