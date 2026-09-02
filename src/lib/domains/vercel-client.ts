/**
 * Vercel's Domains API — adding a merchant's custom domain to this Vercel
 * project so Vercel actually terminates TLS and routes traffic for it to
 * this deployment. Plain fetch, no SDK — same house style as every other
 * integration in this codebase. Mocked (always "needs manual setup") when
 * VERCEL_API_TOKEN/VERCEL_PROJECT_ID are absent, so dev/CI never needs
 * real credentials and a missing token degrades to "contact support"
 * rather than a crash.
 *
 * Unlike Vanex/DPay, this isn't a guessed-then-verified contract — it's
 * Vercel's own public, stable REST API (https://vercel.com/docs/rest-api).
 */

const VERCEL_API = "https://api.vercel.com";

export type DomainVerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type AddDomainResult =
  | { ok: true; verified: true }
  | { ok: true; verified: false; records: DomainVerificationRecord[] }
  | { ok: false; error: string };

function projectPath(): string {
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  return `/v10/projects/${projectId}/domains${teamId ? `?teamId=${teamId}` : ""}`;
}

function isConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

export async function addDomainToProject(domain: string): Promise<AddDomainResult> {
  if (!isConfigured()) {
    return { ok: true, verified: false, records: [] }; // mock — see checkDomainVerification's mock branch for the matching message
  }

  const res = await fetch(`${VERCEL_API}${projectPath()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domain }),
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Vercel returns 409 with code "domain_already_in_use" if it's already
    // attached elsewhere, and various 400s for an invalid domain — surface
    // whatever message it gives rather than a generic failure.
    return { ok: false, error: json?.error?.message ?? `Vercel API error ${res.status}` };
  }
  if (json.verified) {
    return { ok: true, verified: true };
  }
  return { ok: true, verified: false, records: json.verification ?? [] };
}

export async function checkDomainVerification(domain: string): Promise<AddDomainResult> {
  if (!isConfigured()) {
    return {
      ok: true,
      verified: false,
      records: [{ type: "manual", domain, value: "", reason: "VERCEL_API_TOKEN not configured — contact support to finish linking this domain" }],
    };
  }

  const res = await fetch(`${VERCEL_API}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domain}/verify${process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ""}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, error: json?.error?.message ?? `Vercel API error ${res.status}` };
  }
  if (json.verified) {
    return { ok: true, verified: true };
  }
  return { ok: true, verified: false, records: json.verification ?? [] };
}

export async function removeDomainFromProject(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true };

  const res = await fetch(
    `${VERCEL_API}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domain}${process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ""}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` } }
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json?.error?.message ?? `Vercel API error ${res.status}` };
  }
  return { ok: true };
}
