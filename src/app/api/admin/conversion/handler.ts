import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { hasBookableHours, type WorkingHours } from "@/lib/booking";
import { conversionStage, followUpMessage, whatsappLink, type ConversionStage } from "@/lib/conversion";
import { daysUntilEnd } from "@/lib/subscription/reminders";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose args so the
// real PrismaClient structurally satisfies this (same pattern as orders/handler.ts).
type Any = any;

type MerchantRow = {
  id: string;
  name: string;
  phone: string;
  createdAt: Date;
  phoneVerified: boolean;
  subscriptionStatus: string;
  subscriptionEndDate: Date | null;
  _count: { payments: number };
  stores: {
    slug: string;
    type: string;
    bookingWorkingHours: unknown;
    bookingSlotMinutes: number | null;
    _count: { products: number; orders: number };
  }[];
};

export type ConversionDeps = {
  db: { merchant: { findMany: (args: Any) => Promise<Any[]> } };
  isAdmin: (merchantId: string | null) => Promise<boolean>;
  now?: () => Date;
};

export type ConversionRow = {
  id: string;
  name: string;
  phone: string;
  joined: string;
  store: string | null;
  products: number;
  orders: number;
  stage: ConversionStage;
  subscriptionStatus: string;
  endsAt: string | null;
  daysLeft: number | null;
  whatsappUrl: string;
};

// GET /api/admin/conversion — every merchant's trial → paid funnel stage,
// days left, and a ready wa.me follow-up link (lib/conversion.ts), sorted
// so the most urgent (soonest trial end) come first.
export async function handleConversion(deps: ConversionDeps, req: Request): Promise<Response> {
  if (!(await deps.isAdmin(getAuthMerchantId(req)))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const now = deps.now ? deps.now() : new Date();
    const merchants: MerchantRow[] = await deps.db.merchant.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        phoneVerified: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
        _count: { select: { payments: { where: { status: "approved" } } } },
        stores: {
          select: { slug: true, type: true, bookingWorkingHours: true, bookingSlotMinutes: true, _count: { select: { products: true, orders: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows: ConversionRow[] = merchants.map((m) => {
      const s = m.stores[0];
      const stage = conversionStage({
        phoneVerified: m.phoneVerified,
        approvedPayments: m._count.payments,
        store: s
          ? { type: s.type, products: s._count.products, orders: s._count.orders, bookableHours: hasBookableHours(s.bookingWorkingHours as WorkingHours | null, s.bookingSlotMinutes) }
          : null,
      });
      const daysLeft = m.subscriptionEndDate ? daysUntilEnd(m.subscriptionEndDate, now) : null;
      return {
        id: m.id,
        name: m.name.trim(),
        phone: m.phone,
        joined: m.createdAt.toISOString().slice(0, 10),
        store: s?.slug ?? null,
        products: s?._count.products ?? 0,
        orders: s?._count.orders ?? 0,
        stage,
        subscriptionStatus: m.subscriptionStatus,
        endsAt: m.subscriptionEndDate ? m.subscriptionEndDate.toISOString() : null,
        daysLeft,
        whatsappUrl: whatsappLink(m.phone, followUpMessage(m.name, stage, daysLeft)),
      };
    });
    rows.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));

    const byStage: Record<string, number> = {};
    for (const r of rows) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
    return NextResponse.json({ total: rows.length, byStage, rows });
  } catch (error) {
    console.error("Error building conversion view:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
