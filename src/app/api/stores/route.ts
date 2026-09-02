import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createStoreSchema } from "@/lib/validation";

// POST /api/stores — create a store (needs auth).
// Mirrors the 4-step wizard: name, theme, courier, payment.
// Ported from marsa-backend/src/routes/stores.js (POST /).
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createStoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { name, theme, courier, codEnabled, walletProvider, templateId } = parsed.data;

    let slug = slugify(name) || nanoid(8);
    const clash = await prisma.store.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${nanoid(4)}`;

    const store = await prisma.store.create({
      data: {
        merchantId,
        name,
        slug,
        theme: theme || "souk",
        courier: courier || "vanex",
        codEnabled: codEnabled ?? true,
        walletProvider: walletProvider || null,
        templateId: templateId || null,
      },
    });

    if (templateId) {
      // Previously always started a new store at the schema's hardcoded
      // blue default regardless of which template was picked — a
      // merchant choosing a dark/gold template got the exact same blue
      // starting colors as everyone else. Templates carry their own
      // defaultColors for exactly this; use them when present.
      const template = await prisma.template.findUnique({ where: { id: templateId }, select: { defaultColors: true } });
      const defaults = (template?.defaultColors ?? {}) as { primaryColor?: string; secondaryColor?: string };

      await prisma.templateCustomization.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          templateId,
          primaryColor: defaults.primaryColor,
          secondaryColor: defaults.secondaryColor,
        },
        update: {
          templateId,
        },
      });
    }

    return NextResponse.json(store, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
