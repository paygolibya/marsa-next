import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { setCustomDomainSchema } from "@/lib/validation";
import { addDomainToProject, checkDomainVerification, removeDomainFromProject } from "@/lib/domains/vercel-client";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "rifqa.ly";

// GET /api/merchant/domain?storeId=... — the store's subdomain (derived
// straight from its slug, always available, needs no setup) plus its
// custom domain status. Re-checks verification with Vercel live rather
// than trusting the last-stored value, so a merchant who just added their
// DNS record sees it flip to verified without needing to touch anything
// else first.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const storeId = new URL(req.url).searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId مطلوب" }, { status: 400 });

  const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

  const subdomain = `${store.slug}.${ROOT_DOMAIN}`;

  if (!store.customDomain) {
    return NextResponse.json({ subdomain, customDomain: null, customDomainVerified: false, records: [] });
  }

  if (store.customDomainVerified) {
    return NextResponse.json({ subdomain, customDomain: store.customDomain, customDomainVerified: true, records: [] });
  }

  const check = await checkDomainVerification(store.customDomain);
  if (check.ok && check.verified) {
    await prisma.store.update({ where: { id: store.id }, data: { customDomainVerified: true } });
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
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = setCustomDomainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, customDomain } = parsed.data;

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    if (customDomain === null) {
      if (store.customDomain) await removeDomainFromProject(store.customDomain);
      await prisma.store.update({ where: { id: store.id }, data: { customDomain: null, customDomainVerified: false } });
      return NextResponse.json({ customDomain: null, customDomainVerified: false, records: [] });
    }

    const result = await addDomainToProject(customDomain);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    try {
      await prisma.store.update({
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
