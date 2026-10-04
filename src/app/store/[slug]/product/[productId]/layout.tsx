import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// The product detail page itself (./page.tsx) is a Client Component (it
// fetches via useEffect + api.publicStore) — Client Components can't export
// generateMetadata, which only runs in Server Components. Mirrors the exact
// pattern the store-level layout already uses for the same reason.
async function getProductMeta(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, description: true, metaTitle: true, metaDescription: true },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await params;
  const product = await getProductMeta(productId);
  if (!product) return {};

  return {
    title: product.metaTitle || product.name,
    description: product.metaDescription || product.description?.slice(0, 160) || undefined,
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
