import test from "node:test";
import assert from "node:assert/strict";
import { handleCreateAnalyticsEvent, type AnalyticsEventDeps } from "./handler";

function req(body: unknown, headers: Record<string, string> = { "x-forwarded-for": "1.2.3.4" }) {
  return new Request("http://localhost/api/analytics/event", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeFakeDeps(opts: { store?: { id: string } | null; recentAttempts?: number } = {}) {
  const calls: Record<string, unknown> = {};
  const deps: AnalyticsEventDeps = {
    store: { findUnique: async () => (opts.store !== undefined ? opts.store : { id: "store-1" }) },
    analyticsEvent: {
      create: async (args) => {
        calls.eventCreate = args;
        return {};
      },
    },
    analyticsEventAttempt: {
      count: async () => opts.recentAttempts ?? 0,
      create: async (args) => {
        calls.attemptCreate = args;
        return {};
      },
    },
  };
  return { deps, calls };
}

const validBody = { storeSlug: "my-store", type: "pageview", path: "/store/my-store", sessionId: "session-1" };

test("rejects a malformed body with 400, without creating an event or counting an attempt", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleCreateAnalyticsEvent(deps, req({ storeSlug: "my-store" }));
  assert.equal(res.status, 400);
  assert.equal(calls.eventCreate, undefined);
  assert.equal(calls.attemptCreate, undefined);
});

test("rejects an unrecognized event type with 400", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleCreateAnalyticsEvent(deps, req({ ...validBody, type: "not-a-real-type" }));
  assert.equal(res.status, 400);
  assert.equal(calls.eventCreate, undefined);
});

test("returns 404 when the store doesn't exist, without creating an event", async () => {
  const { deps, calls } = makeFakeDeps({ store: null });
  const res = await handleCreateAnalyticsEvent(deps, req(validBody));
  assert.equal(res.status, 404);
  assert.equal(calls.eventCreate, undefined);
});

test("creates the event with the server-parsed device (never trusting a client-sent device), and counts the attempt", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleCreateAnalyticsEvent(deps, req(validBody, { "x-forwarded-for": "1.2.3.4", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS)" }));
  assert.equal(res.status, 201);
  const create = calls.eventCreate as { data: { storeId: string; type: string; path: string; device: string; sessionId: string } };
  assert.equal(create.data.storeId, "store-1");
  assert.equal(create.data.type, "pageview");
  assert.equal(create.data.device, "mobile");
  assert.ok(calls.attemptCreate);
});

test("stores a null referrer when omitted", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleCreateAnalyticsEvent(deps, req(validBody));
  const create = calls.eventCreate as { data: { referrer: string | null } };
  assert.equal(create.data.referrer, null);
});

test("rejects with 429 once the per-IP rate limit is reached, without creating an event", async () => {
  const { deps, calls } = makeFakeDeps({ recentAttempts: 120 });
  const res = await handleCreateAnalyticsEvent(deps, req(validBody));
  assert.equal(res.status, 429);
  assert.equal(calls.eventCreate, undefined);
});

test("a request with no resolvable IP is never rate-limited (fails open, not closed)", async () => {
  const { deps, calls } = makeFakeDeps({ recentAttempts: 999 });
  const res = await handleCreateAnalyticsEvent(deps, req(validBody, {}));
  assert.equal(res.status, 201);
  assert.ok(calls.eventCreate);
  assert.equal(calls.attemptCreate, undefined);
});
