import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/newsletter/subscribe — { storeSlug, email }. Public, no auth —
// a storefront visitor subscribing. The real capture behind the
// customizer's "عرض نموذج الاشتراك بالرسائل" toggle, which previously
// rendered nothing on the actual store at all.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug : null;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

    if (!storeSlug || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "بريد إلكتروني غير صالح" }, { status: 400 });
    }

    const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "المتجر غير موجود" }, { status: 404 });

    try {
      await prisma.newsletterSubscriber.create({ data: { storeId: store.id, email } });
    } catch (err: unknown) {
      // Already subscribed — treat as success, not an error the visitor needs to see.
      if (!(err && typeof err === "object" && "code" in err && err.code === "P2002")) throw err;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter subscribe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
