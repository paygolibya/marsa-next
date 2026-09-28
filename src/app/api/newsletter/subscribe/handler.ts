import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export type NewsletterSubscribeDb = {
  store: { findUnique: (args: { where: { slug: string }; select: { id: true } }) => Promise<{ id: string } | null> };
  newsletterSubscriber: { create: (args: { data: { storeId: string; email: string } }) => Promise<unknown> };
};

// POST /api/newsletter/subscribe — { storeSlug, email }. Public, no auth —
// a storefront visitor subscribing. The real capture behind the
// customizer's "عرض نموذج الاشتراك بالرسائل" toggle, which previously
// rendered nothing on the actual store at all.
export async function handleNewsletterSubscribe(db: NewsletterSubscribeDb, req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug : null;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

    if (!storeSlug || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "بريد إلكتروني غير صالح" }, { status: 400 });
    }

    const store = await db.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "المتجر غير موجود" }, { status: 404 });

    try {
      await db.newsletterSubscriber.create({ data: { storeId: store.id, email } });
    } catch (err: unknown) {
      // Already subscribed — treat as success, not an error the visitor needs to see.
      if (!(err && typeof err === "object" && "code" in err && err.code === "P2002")) throw err;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter subscribe error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
