import { NextResponse } from "next/server";

// A request body that isn't valid JSON is the caller's mistake (usually a
// bot or scanner), not a server failure. Plain `await req.json()` throws a
// SyntaxError that every handler's catch-all turned into a 500 and reported
// to Sentry — confirmed live: one malformed POST to /api/inquiries showed up
// as an "Internal server error". Handlers read their body through this
// instead, and their catch blocks map MalformedJsonError to a 400 without
// reporting it, so Sentry only sees real failures.

export class MalformedJsonError extends Error {
  constructor() {
    super("Malformed JSON request body");
    this.name = "MalformedJsonError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same type
// Request.json() itself returns; each handler validates the shape.
export async function readJsonBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new MalformedJsonError();
  }
}

export function malformedJsonResponse() {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}
