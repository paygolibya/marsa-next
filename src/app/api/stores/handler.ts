import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { customAlphabet } from "nanoid";

// Digits only, specifically for disambiguating a slug collision — nanoid's
// default alphabet includes Latin letters, which (confirmed directly
// against a real URL parser) breaks IDNA encoding entirely when appended
// to an Arabic slug: a hostname label mixing Arabic and Latin letters
// throws "Invalid URL" and can never be opened by any browser, while
// Arabic mixed with digits only encodes fine. Found live: three real
// stores whose name collided with another store's got exactly this
// unreachable-forever subdomain.
const numericSuffix = customAlphabet("0123456789", 4);

// Lowercase alphanumeric only — nanoid's default alphabet includes
// uppercase letters and underscores, neither of which survive as a
// subdomain: underscores aren't legal in a DNS hostname label, and
// uppercase gets silently lowercased by every browser, making a store
// permanently unreachable at the exact slug it was created with.
const fallbackSlug = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);
import { getAuthMerchantId } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createStoreSchema } from "@/lib/validation";

type StoreRow = { id: string; slug: string };

export type CreateStoreDb = {
  store: {
    findUnique: (args: { where: { slug: string } }) => Promise<{ id: string } | null>;
    create: (args: {
      data: {
        merchantId: string;
        name: string;
        slug: string;
        theme: string;
        courier: string;
        codEnabled: boolean;
        walletProvider: string | null;
        templateId: string | null;
        type?: string;
      };
    }) => Promise<StoreRow>;
  };
  template: {
    findUnique: (args: {
      where: { id: string };
      select: { defaultColors: true };
    }) => Promise<{ defaultColors: unknown } | null>;
  };
  templateCustomization: {
    upsert: (args: {
      where: { storeId: string };
      create: { storeId: string; templateId: string; primaryColor?: string; secondaryColor?: string };
      update: { templateId: string };
    }) => Promise<unknown>;
  };
};

// POST /api/stores — create a store (needs auth). Mirrors the 4-step
// wizard: name, theme, courier, payment.
export async function handleCreateStore(db: CreateStoreDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createStoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { name, theme, courier, codEnabled, walletProvider, templateId, type } = parsed.data;

    let slug = slugify(name) || fallbackSlug();
    const clash = await db.store.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${numericSuffix()}`;

    const store = await db.store.create({
      data: {
        merchantId,
        name,
        slug,
        theme: theme || "souk",
        courier: courier || "vanex",
        codEnabled: codEnabled ?? true,
        walletProvider: walletProvider || null,
        templateId: templateId || null,
        type: type || "physical",
      },
    });

    if (templateId) {
      // Previously always started a new store at the schema's hardcoded
      // blue default regardless of which template was picked — a
      // merchant choosing a dark/gold template got the exact same blue
      // starting colors as everyone else. Templates carry their own
      // defaultColors for exactly this; use them when present.
      const template = await db.template.findUnique({ where: { id: templateId }, select: { defaultColors: true } });
      const defaults = (template?.defaultColors ?? {}) as { primaryColor?: string; secondaryColor?: string };

      await db.templateCustomization.upsert({
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
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
