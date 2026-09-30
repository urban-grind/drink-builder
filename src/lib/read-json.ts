const DEFAULT_MAX_BYTES = 32_000;

export async function readJsonLimited(
  request: Request,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: "too-large" | "bad-json" }> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isFinite(size) || size < 0) return { ok: false, reason: "bad-json" };
    if (size > maxBytes) return { ok: false, reason: "too-large" };
  }

  if (!request.body) {
    try {
      return { ok: true, value: await request.json() };
    } catch {
      return { ok: false, reason: "bad-json" };
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "bad-json" };
  }

  if (total === 0) return { ok: false, reason: "bad-json" };
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
  } catch {
    return { ok: false, reason: "bad-json" };
  }
}
