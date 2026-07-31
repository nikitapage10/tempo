import { NextResponse } from "next/server";

export const NO_STORE_HEADERS: HeadersInit = { "Cache-Control": "no-store" };

export function adminJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export function adminError(message: string, status: number) {
  return adminJson({ error: message }, status);
}
