import { NextResponse } from "next/server";
import type { FieldErrors } from "@/lib/types";

const noStore = { "cache-control": "no-store" };

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export function jsonError(status: number, code: string, message: string, fields?: FieldErrors) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
      },
    },
    { status, headers: noStore },
  );
}
