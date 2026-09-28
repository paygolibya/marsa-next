import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { setCustomDomainSchema } from "@/lib/validation";
import type { AddDomainResult } from "@/lib/domains/vercel-client";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "rifqa.ly";

type StoreRow = { id: string; slug: string; customDomain: string | null; customDomainVerified: boolean };

export type MerchantDomainDb = {
  store: {
    findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<StoreRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export type MerchantDomainDeps = {
  db: MerchantDomainDb;
  addDomainToProject: (domain: string) => Promise<AddDomainResult>;
  checkDomainVerification: (domain: string) => Promise<AddDomainResult>;
  removeDomainFromProject: (domain: string) => Promise<{ ok: boolean; error?: string }>;
};

// GET /api/merchant/domain?storeId=... — the store's subdomain (derived
// straight from its slug, always available, needs no setup) plus its
// custom domain status. Re-checks verification with Vercel live rather
// than trusting the last-stored value, so a merchant who just added their
// DNS record sees it flip to verified without needing to touch anything
// else first.
export async function handleGetDomain(deps: MerchantDomainDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const storeId = new URL(req.url).searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId مطلوب" }, { status: 400 });

  const store = await deps.db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

  const subdomain = `${store.slug}.${ROOT_DOMAIN}`;

  if (!store.customDomain) {
    return NextResponse.json({ subdomain, customDomain: null, customDomainVerified: false, records: [] });
  }

  if (store.customDomainVerified) {
    return NextResponse.json({ subdomain, customDomain: store.customDomain, customDomainVerified: true, records: [] });
  }

  const check = await deps.checkDomainVerification(store.customDomain);
  if (check.ok && check.verified) {
    await deps.db.store.update({ where: { id: store.id }, data: { customDomainVerified: true } });
  }
  return NextResponse.json({
    subdomain,
    customDomain: store.customDomain,
    customDomainVerified: check.ok && check.verified,
    records: check.ok && !check.verified ? check.records : [],
    error: !check.ok ? check.error : undefined,
  });
}

// POST /api/merchant/domain — { storeId, customDomain } (null clears it).
export async function handleSetDomain(deps: MerchantDomainDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = setCustomDomainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, customDomain } = parsed.data;

    const store = await deps.db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    if (customDomain === null) {
      if (store.customDomain) await deps.removeDomainFromProject(store.customDomain);
      await deps.db.store.update({ where: { id: store.id }, data: { customDomain: null, customDomainVerified: false } });
      return NextResponse.json({ customDomain: null, customDomainVerified: false, records: [] });
    }

    const result = await deps.addDomainToProject(customDomain);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    try {
      await deps.db.store.update({
        where: { id: store.id },
        data: { customDomain, customDomainVerified: result.verified },
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        return NextResponse.json({ error: "هذا النطاق مستخدم بالفعل من متجر آخر" }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({
      customDomain,
      customDomainVerified: result.verified,
      records: result.verified ? [] : result.records,
    });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
