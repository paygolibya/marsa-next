"use client";

import { useMemo, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { templatesData } from "@/lib/templates-data";
import { STOREFRONT_TEMPLATES } from "@/components/storefront/templates/registry";
import type { Product, Store, StoreStats, StoreTestimonial } from "@/lib/api";

// Real sample data driving the ACTUAL template component — this used to
// be a generic color-swatch/feature-list mockup with no relationship to
// what the template really looks like. Every section a template can
// render (stats banner, testimonials, newsletter) gets real content here
// so nothing is hidden behind a default-off toggle; product images are
// deliberately left empty rather than filled with unrelated stock photos
// — every template already has a real "لا توجد صورة" placeholder state,
// and layout/color/typography (not photography) is what a template
// preview needs to actually show.
const MOCK_PRODUCTS: Array<{ id: string; name: string; priceCents: number }> = [
  { id: "p1", name: "قميص قطني كلاسيكي", priceCents: 8500 },
  { id: "p2", name: "حقيبة يد جلدية", priceCents: 15000 },
  { id: "p3", name: "ساعة يد أنيقة", priceCents: 22000 },
  { id: "p4", name: "نظارة شمسية", priceCents: 6000 },
  { id: "p5", name: "حذاء رياضي", priceCents: 12000 },
  { id: "p6", name: "عطر فاخر", priceCents: 18000 },
];

const MOCK_TESTIMONIALS: StoreTestimonial[] = [
  { buyerName: "سارة أحمد", rating: 5, reviewText: "جودة ممتازة وتوصيل سريع، تجربة شراء رائعة!", productName: "قميص قطني كلاسيكي" },
  { buyerName: "محمد علي", rating: 4, reviewText: "منتج مطابق للوصف تمامًا، سأطلب مرة أخرى.", productName: "حقيبة يد جلدية" },
  { buyerName: "ليلى سالم", rating: 5, reviewText: "خدمة عملاء ممتازة وسرعة في الاستجابة.", productName: "ساعة يد أنيقة" },
];

const MOCK_STATS: StoreStats = { deliveredOrderCount: 312, averageRating: 4.8, reviewCount: 96 };

export default function TemplatePreviewPage() {
  const { templateSlug } = useParams<{ templateSlug: string }>();
  const template = templatesData.find((t) => t.slug === templateSlug);
  const Template = template ? STOREFRONT_TEMPLATES[template.slug] : null;

  const [query, setQuery] = useState("");
  const [cartTotalItems, setCartTotalItems] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const products = useMemo<Product[]>(
    () =>
      MOCK_PRODUCTS.map((p) => ({
        id: p.id,
        storeId: "preview-store",
        name: p.name,
        priceCents: p.priceCents,
        imageUrl: null,
        images: [],
        variantOptions: null,
        variants: [],
        active: true,
        createdAt: new Date().toISOString(),
        trackInventory: false,
        stockQty: 0,
        lowStockThreshold: 0,
      })),
    []
  );

  const store = useMemo<Store | null>(() => {
    if (!template) return null;
    return {
      id: "preview-store",
      merchantId: "preview-merchant",
      name: "متجر تجريبي",
      slug: "preview",
      theme: "souk",
      courier: "vanex",
      codEnabled: true,
      walletProvider: null,
      currency: "LYD",
      createdAt: new Date().toISOString(),
      aboutText: null,
      returnPolicy: null,
      shippingPolicy: null,
      businessHours: null,
      customization: {
        primaryColor: template.defaultColors.primaryColor,
        secondaryColor: template.defaultColors.secondaryColor,
        accentColor: null,
        logo: null,
        favicon: null,
        tagline: "هذا مثال حي — تصفّح متجرًا تجريبيًا بهذا القالب بالضبط",
        description: "منتجات مختارة بعناية لتجربة تسوّق مريحة وسريعة.",
        headerStyle: "standard",
        footerStyle: "standard",
        showNewsletter: true,
        showReviews: true,
        showTestimonials: true,
        showSocialProof: true,
        template: { slug: template.slug, nameAr: template.nameAr },
      },
    };
  }, [template]);

  if (!template || !Template || !store) {
    notFound();
  }

  const filtered = products.filter((p) => p.name.includes(query));

  function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterState("loading");
    // No real backend behind this preview — just enough feedback to show
    // the template's own newsletter section actually working end to end.
    setTimeout(() => {
      setNewsletterState("done");
      setNewsletterEmail("");
    }, 400);
  }

  return (
    <>
      <div className="sticky top-0 z-40 bg-harbor text-canvas text-sm flex items-center justify-between px-6 py-2.5">
        <span>👀 معاينة حية لقالب &quot;{template.nameAr}&quot; ببيانات تجريبية</span>
        <Link href="/onboarding" className="rounded-full bg-signal px-4 py-1.5 font-bold text-canvas hover:bg-signal-dark transition-colors">
          اختر هذا القالب
        </Link>
      </div>
      <Template
        slug="preview"
        store={store}
        products={products}
        filtered={filtered}
        query={query}
        setQuery={setQuery}
        stats={MOCK_STATS}
        testimonials={MOCK_TESTIMONIALS}
        cartTotalItems={cartTotalItems}
        onOpenCart={() => {}}
        onAddToCart={() => setCartTotalItems((n) => n + 1)}
        newsletterEmail={newsletterEmail}
        setNewsletterEmail={setNewsletterEmail}
        newsletterState={newsletterState}
        onNewsletterSubmit={handleNewsletterSubmit}
      />
    </>
  );
}
