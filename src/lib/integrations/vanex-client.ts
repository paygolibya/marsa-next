// Low-level Vanex API client: authentication + a generic authenticated
// request helper. Domain logic (cities, shipments, pickups) lives in
// ./vanex.ts — this file only knows how to get and use a token.

// Per Vanex's published OpenAPI spec (docs.vanex.ly), the only real API host
// is app.vanex.ly — clients2.testing.vanex.ly only serves their web app, not
// an API. Set VANEX_API_BASE explicitly to override (e.g. a staging API host
// discovered from that web app's own bundled JS, for a test account that
// isn't provisioned on production).
const API_BASE = process.env.VANEX_API_BASE || "https://app.vanex.ly/api/v1";

// Vanex's response envelope isn't fully consistent across endpoints — most
// nest the payload under `data`, but package creation returns the new
// package's `id` at the top level. So vanexRequest() returns the whole
// parsed body and lets each caller in ./vanex.ts pull out what it needs.
type VanexEnvelope = { status_code: number; message?: string; errors?: unknown; [key: string]: unknown };

function describeError(body: VanexEnvelope, fallback: string | number): string {
  if (body.message) return String(body.message);
  if (body.errors && typeof body.errors === "object") {
    const first = Object.values(body.errors as Record<string, unknown>)[0];
    if (Array.isArray(first)) return String(first[0]);
  }
  if (Array.isArray(body.errors) && body.errors.length) return String(body.errors[0]);
  return String(fallback);
}

// Best-effort in-memory cache — fine if a cold serverless start loses it,
// the next request just re-authenticates.
let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

async function authenticate(): Promise<string> {
  const email = process.env.VANEX_EMAIL;
  const password = process.env.VANEX_PASSWORD;
  if (!email || !password) {
    throw new Error("VANEX_EMAIL/VANEX_PASSWORD are not configured");
  }

  const res = await fetch(`${API_BASE}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as VanexEnvelope & { data?: { access_token?: string } };
  const accessToken = body.data?.access_token;
  if (!res.ok || body.status_code !== 200 || !accessToken) {
    throw new Error(`Vanex authentication failed: ${describeError(body, res.status)}`);
  }

  cachedToken = accessToken;
  // Cache for 23h — tokens are documented to last 24h.
  cachedTokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken;
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;
  return authenticate();
}

/**
 * Authenticated request against the Vanex API. `path` is relative to
 * VANEX_API_BASE (e.g. "/city/all"). Retries once on a 401 in case the
 * cached token expired early or was invalidated server-side.
 */
export async function vanexRequest(path: string, init: RequestInit = {}, _retried = false): Promise<VanexEnvelope> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && !_retried) {
    cachedToken = null;
    return vanexRequest(path, init, true);
  }

  const body = (await res.json()) as VanexEnvelope;
  if (!res.ok || (typeof body.status_code === "number" && body.status_code >= 300)) {
    throw new Error(`Vanex API error on ${path}: ${describeError(body, res.status)}`);
  }
  return body;
}
