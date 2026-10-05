import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAnalyticsEventSchema } from "@/lib/validation";
import { getClientIp } from "@/lib/request-ip";
import { parseDeviceType } from "@/lib/device";

// Sized for real browsing volume (a buyer firing a pageview per nav plus
// the odd add_to_cart/checkout_started), not brute-force login-attempt
// volume — LoginAttempt's 10-per-15-minutes would false-positive on a
// single real session. Same DB-backed-not-in-memory reasoning as
// LoginAttempt: this runs on serverless, so counters must survive across
// invocations/cold starts.
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_EVENTS_PER_IP = 120;

export type AnalyticsEventDeps = {
  store: { findUnique: (args: { where: { slug: string }; select: { id: true } }) => Promise<{ id: string } | null> };
  analyticsEvent: {
    create: (args: {
      data: { storeId: string; type: string; path: string; referrer: string | null; device: string; sessionId: string };
    }) => Promise<unknown>;
  };
  analyticsEventAttempt: {
    count: (args: { where: { ip: string; createdAt: { gte: Date } } }) => Promise<number>;
    create: (args: { data: { ip: string } }) => Promise<unknown>;
  };
};

// POST /api/analytics/event — public, no auth: a fire-and-forget beacon
// the storefront calls at a handful of key moments (see
// src/lib/track-event.ts). No auth required; see route.ts for why this is
// injectable (so the rate limit and the store-lookup-then-create flow can
// be integration-tested with fakes; handler.test.ts).
export async function handleCreateAnalyticsEvent(deps: AnalyticsEventDeps, req: Request): Promise<Response> {
  try {
    const ip = getClientIp(req);
    if (ip) {
      const recent = await deps.analyticsEventAttempt.count({
        where: { ip, createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) } },
      });
      if (recent >= MAX_EVENTS_PER_IP) {
        return NextResponse.json({ error: "too many requests" }, { status: 429 });
      }
    }

    const body = await req.json();
    const parsed = createAnalyticsEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
    }
    const { storeSlug, type, path, referrer, sessionId } = parsed.data;

    const store = await deps.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    // Counted against the rate limit only once the request is otherwise
    // valid (real store, well-formed body) — a flood of malformed bodies
    // from one IP is caught by the 400 path itself, no need to also
    // spend a rate-limit slot on it.
    if (ip) await deps.analyticsEventAttempt.create({ data: { ip } });

    // Parsed from the request's own User-Agent, never trusted from the
    // client body — see parseDeviceType's own comment.
    const device = parseDeviceType(req.headers.get("user-agent"));

    await deps.analyticsEvent.create({
      data: { storeId: store.id, type, path, referrer: referrer || null, device, sessionId },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
