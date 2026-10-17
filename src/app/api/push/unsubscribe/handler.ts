import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { pushUnsubscribeSchema } from "@/lib/validation";
import { MalformedJsonError, malformedJsonResponse, readJsonBody } from "@/lib/http/read-json";

export type PushUnsubscribeDb = {
  pushSubscription: {
    deleteMany: (args: { where: { endpoint: string; merchantId: string } }) => Promise<{ count: number }>;
  };
};

// POST /api/push/unsubscribe — called when a merchant turns notifications
// off on this device. Scoped to merchantId too (not just endpoint) so one
// merchant can never remove another's subscription even given its
// endpoint URL.
export async function handlePushUnsubscribe(db: PushUnsubscribeDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await readJsonBody(req);
    const parsed = pushUnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    await db.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, merchantId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MalformedJsonError) return malformedJsonResponse();
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
