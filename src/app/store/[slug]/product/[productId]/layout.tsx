import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isSupportedLanguage, resolveProductTranslation } from "@/lib/i18n";

// The product detail page itself (./page.tsx) is a Client Component (it
// fetches via useEffect + api.publicStore) — Client Components can't export
// generateMetadata, which only runs in Server Components. Mirrors the exact
// pattern the store-level layout already uses for the same reason.
async function getProductMeta(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
      translations: true,
      imageUrl: true,
      priceCents: true,
      store: { select: { language: true, name: true, currency: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await params;
  const product = await getProductMeta(productId);
  if (!product) return {};

  const language = isSupportedLanguage(product.store.language) ? product.store.language : "ar";
  const resolved = resolveProductTranslation(
    { ...product, translations: product.translations as Record<string, { name?: string; description?: string; metaTitle?: string; metaDescription?: string }> | null },
    language,
  );

  const title = resolved.metaTitle || resolved.name;
  const description = resolved.metaDescription || resolved.description?.slice(0, 160) || undefined;
  const images = product.imageUrl ? [{ url: product.imageUrl, alt: resolved.name }] : undefined;

  // Product link previews (WhatsApp/Facebook shares, and what Facebook's
  // ad crawler reads) — the product photo plus price, instead of a bare
  // title.
  return {
    title,
    description,
    openGraph: { type: "website", siteName: product.store.name, title, description, images },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
    other: {
      "product:price:amount": (product.priceCents / 100).toFixed(2),
      "product:price:currency": product.store.currency || "LYD",
    },
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
