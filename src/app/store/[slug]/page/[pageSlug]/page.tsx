"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Store } from "@/lib/api";
import { SiteFooter } from "@/components/site-footer";

export default function StorePageDetail() {
  const params = useParams<{ slug: string; pageSlug: string }>();
  const slug = params.slug;
  const pageSlug = params.pageSlug;

  const [store, setStore] = useState<Store | null>(null);
  const [page, setPage] = useState<{ title: string; content: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([api.publicStore(slug), api.publicPage(slug, pageSlug)])
      .then(([{ store }, page]) => {
        setStore(store);
        setPage(page);
      })
      .catch(() => setNotFound(true));
  }, [slug, pageSlug]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-harbor">هذه الصفحة غير موجودة</h1>
        <Link href={`/store/${slug}`} className="text-brass font-bold mt-4 inline-block">
          العودة إلى المتجر
        </Link>
      </main>
    );
  }

  if (!store || !page) return null;

  const primary = store.customization?.primaryColor || "#0066cc";
  const secondary = store.customization?.secondaryColor || "#f0f0f0";

  return (
    <div className="min-h-screen" style={{ backgroundColor: secondary }}>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link href={`/store/${slug}`} className="text-sm text-rope hover:text-harbor">
          ← العودة إلى المتجر
        </Link>
        <h1 className="font-display text-2xl font-extrabold text-harbor mt-6" style={{ color: primary }}>
          {page.title}
        </h1>
        {/* Plain text with paragraph breaks only — same safe rendering as
            Product.description, no HTML/sanitization scope creep. */}
        <p className="text-harbor/90 mt-4 whitespace-pre-line leading-relaxed">{page.content}</p>
      </main>

      <SiteFooter
        store={
          store.customization?.footerStyle === "branded"
            ? { name: store.name, tagline: store.customization?.tagline, logo: store.customization?.logo }
            : undefined
        }
      />
    </div>
  );
}
