import type { FieldErrors } from "@/lib/types";

export class ApiRequestError extends Error {
  code: string;
  fields?: FieldErrors;

  constructor(code: string, message: string, fields?: FieldErrors) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.fields = fields;
  }
}

export async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError(
      "NETWORK",
      "Can't reach the counter. Check your connection and try again.",
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { code?: string; message?: string; fields?: FieldErrors } }).error
        : undefined;
    throw new ApiRequestError(
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "Something went wrong at the counter. Try again.",
      error?.fields,
    );
  }

  return payload as T;
}
