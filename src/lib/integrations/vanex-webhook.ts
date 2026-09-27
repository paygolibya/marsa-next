// Pure helpers extracted from the Vanex webhook route so the mapping/auth
// logic can be unit-tested without needing a request object or Prisma.

export const VANEX_STATUS_BY_TYPE: Record<string, string> = {
  package_accepted: "accepted",
  package_delivered: "delivered",
  package_failed_delivery: "failed_delivery",
  packages_returned: "returned",
};

// Returns null for a genuinely unrecognized type — the caller is
// responsible for handling the known "settlement" (financial, not tied to
// any order) short-circuit separately before calling this.
export function resolveVanexCourierStatus(type: string): string | null {
  return VANEX_STATUS_BY_TYPE[type] ?? null;
}

export function isValidVanexWebhookKey(receivedKey: string | null, expectedKey: string | undefined): boolean {
  return Boolean(receivedKey && expectedKey && receivedKey === expectedKey);
}
