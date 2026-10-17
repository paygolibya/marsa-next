import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { pushSubscribeSchema } from "@/lib/validation";
import { MalformedJsonError, malformedJsonResponse, readJsonBody } from "@/lib/http/read-json";

export type PushSubscribeDb = {
  pushSubscription: {
    upsert: (args: {
      where: { endpoint: string };
      create: { merchantId: string; endpoint: string; p256dh: string; auth: string };
      update: { merchantId: string; p256dh: string; auth: string };
    }) => Promise<unknown>;
  };
};

// POST /api/push/subscribe — called by NotificationBell.tsx right after a
// successful pushManager.subscribe() in the browser. Upserted on endpoint
// (not merchantId+endpoint) because a browser's own subscription endpoint
// is already globally unique — the same endpoint re-subscribing (e.g.
// after a service-worker update) just refreshes its keys/owner rather than
// creating a duplicate row.
export async function handlePushSubscribe(db: PushSubscribeDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await readJsonBody(req);
    const parsed = pushSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { endpoint, keys } = parsed.data;

    await db.pushSubscription.upsert({
      where: { endpoint },
      create: { merchantId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { merchantId, p256dh: keys.p256dh, auth: keys.auth },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MalformedJsonError) return malformedJsonResponse();
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
