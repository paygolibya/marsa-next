"use client";

import { useMemo, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { templatesData } from "@/lib/templates-data";
import { STOREFRONT_TEMPLATES } from "@/components/storefront/templates/registry";
import type { Product, Store, StoreStats, StoreTestimonial } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";
import { Icon } from "@/components/ui/Icon";

// Real sample data driving the ACTUAL template component — this used to
// be a generic color-swatch/feature-list mockup with no relationship to
// what the template really looks like. Every section a template can
// render (stats banner, testimonials, newsletter) gets real content here
// so nothing is hidden behind a default-off toggle. Products use Rifqa's
// own demo photos (public/demo-products, the same ones the public demo
// store uses) — previews used to be all grey "لا توجد صورة" boxes, which
// made every template look empty exactly where merchants choose one.
const MOCK_PRODUCTS: Array<{ id: string; name: string; priceCents: number; imageUrl: string }> = [
  { id: "p1", name: "حقيبة يد جلدية", priceCents: 15000, imageUrl: "/demo-products/leather-bag.png" },
  { id: "p2", name: "ساعة يد أنيقة", priceCents: 22000, imageUrl: "/demo-products/mens-watch.png" },
  { id: "p3", name: "وشاح صوف ناعم", priceCents: 6500, imageUrl: "/demo-products/wool-scarf.png" },
  { id: "p4", name: "طقم شاي سيراميك", priceCents: 9500, imageUrl: "/demo-products/ceramic-tea-set.png" },
];

const MOCK_TESTIMONIALS: StoreTestimonial[] = [
  { buyerName: "سارة أحمد", rating: 5, reviewText: "جودة ممتازة وتوصيل سريع، تجربة شراء رائعة!", productName: "وشاح صوف ناعم" },
  { buyerName: "محمد علي", rating: 4, reviewText: "منتج مطابق للوصف تمامًا، سأطلب مرة أخرى.", productName: "حقيبة يد جلدية" },
  { buyerName: "ليلى سالم", rating: 5, reviewText: "خدمة عملاء ممتازة وسرعة في الاستجابة.", productName: "ساعة يد أنيقة" },
];

const MOCK_STATS: StoreStats = { deliveredOrderCount: 312, averageRating: 4.8, reviewCount: 96 };

// Every section on, in the default order — same reasoning as the mock
// products/testimonials above: a preview shouldn't hide behind a
// default-off toggle.
const MOCK_SECTIONS: SectionData[] = [
  { type: "stats", position: 0, enabled: true, settings: {} },
  { type: "bestSellers", position: 1, enabled: true, settings: {} },
  { type: "products", position: 2, enabled: true, settings: {} },
  { type: "testimonials", position: 3, enabled: true, settings: {} },
  { type: "newsletter", position: 4, enabled: true, settings: {} },
];

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
        description: null,
        categoryId: null,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        images: [p.imageUrl],
        variantOptions: null,
        variants: [],
        active: true,
        createdAt: new Date().toISOString(),
        trackInventory: false,
        stockQty: 0,
        lowStockThreshold: 0,
        metaTitle: null,
        metaDescription: null,
        costPriceCents: null,
        isBestSeller: false,
      })),
    []
  );

  // First 3 mock products stand in for the bestSellers section — same
  // "nothing hidden behind a default-off toggle" reasoning as the other
  // mock data above.
  const bestSellers = useMemo(() => products.slice(0, 3), [products]);

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
      type: "physical",
      industry: null,
      bookingSlotMinutes: null,
      bookingWorkingHours: null,
      walletProvider: null,
      currency: "LYD",
      createdAt: new Date().toISOString(),
      aboutText: null,
      returnPolicy: null,
      shippingPolicy: null,
      businessHours: null,
      language: "ar",
      supportedLanguages: ["ar"],
      facebookPixelId: null,
      tiktokPixelId: null,
      googleAdsConversionId: null,
      googleAdsConversionLabel: null,
      customization: {
        primaryColor: template.defaultColors.primaryColor,
        secondaryColor: template.defaultColors.secondaryColor,
        accentColor: null,
        logo: null,
        favicon: null,
        coverImage: null,
        coverImageSize: "md",
        tagline: "هذا مثال حي — تصفّح متجرًا تجريبيًا بهذا القالب بالضبط",
        description: "منتجات مختارة بعناية لتجربة تسوّق مريحة وسريعة.",
        headerStyle: "standard",
        footerStyle: "standard",
        showLogo: true,
        showStoreName: true,
        logoSize: "md",
        textColor: null,
        textSize: "md",
        heroEnabled: true,
        heroSize: "md",
        cartPosition: "left",
        instagramUrl: null,
        facebookUrl: null,
        tiktokUrl: null,
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
        <span className="flex items-center gap-2">
          <Icon name="eye" size={18} className="text-brass" />
          معاينة حية لقالب &quot;{template.nameAr}&quot; ببيانات تجريبية
        </span>
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
        categories={[]}
        selectedCategoryId={null}
        setSelectedCategoryId={() => {}}
        bundles={[]}
        navMenuItems={[]}
        stats={MOCK_STATS}
        testimonials={MOCK_TESTIMONIALS}
        bestSellers={bestSellers}
        cartTotalItems={cartTotalItems}
        onOpenCart={() => {}}
        onAddToCart={() => setCartTotalItems((n) => n + 1)}
        onAddBundleToCart={() => setCartTotalItems((n) => n + 1)}
        newsletterEmail={newsletterEmail}
        setNewsletterEmail={setNewsletterEmail}
        newsletterState={newsletterState}
        onNewsletterSubmit={handleNewsletterSubmit}
        sections={MOCK_SECTIONS}
      />
    </>
  );
}
