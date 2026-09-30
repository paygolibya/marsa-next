import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId, signImpersonationToken, toMerchantDTO } from "@/lib/auth";

type MerchantRow = {
  id: string;
  name: string;
  phone: string;
  subscriptionTier: string | null;
  subscriptionStatus: string;
  phoneVerified: boolean;
  subscriptionEndDate: Date | null;
  trialEndsAt: Date | null;
  stores: { id: string }[];
};

export type ImpersonateMerchantDb = {
  merchant: {
    findUnique: (args: { where: { id: string }; include: { stores: { take: 1 } } }) => Promise<MerchantRow | null>;
  };
  impersonationSession: {
    create: (args: { data: { adminId: string; merchantId: string; storeId: string | null } }) => Promise<unknown>;
  };
};

// POST /api/admin/merchants/impersonate — { merchantId }. Mints a real,
// short-lived token for the target merchant (signImpersonationToken, 2h)
// so the admin can be dropped into that merchant's real dashboard to help
// them — every existing merchant-facing route already trusts a token's
// merchantId completely, so nothing else needs to change for this to
// work. Logs a real ImpersonationSession row for audit purposes, at start
// only (see the model's own comment in schema.prisma for why).
export async function handleImpersonateMerchant(db: ImpersonateMerchantDb, req: Request): Promise<Response> {
  const adminId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(adminId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId } = await req.json();

    const merchant = await db.merchant.findUnique({
      where: { id: merchantId },
      include: { stores: { take: 1 } },
    });
    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    await db.impersonationSession.create({
      data: { adminId: adminId!, merchantId, storeId: merchant.stores[0]?.id ?? null },
    });

    const token = signImpersonationToken(merchantId, adminId!);
    return NextResponse.json({ token, merchant: toMerchantDTO(merchant) });
  } catch (error) {
    console.error("Error starting impersonation:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to start impersonation" }, { status: 500 });
  }
}
