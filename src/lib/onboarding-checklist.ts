import type { Store, StoreType } from "@/lib/api";

export type ChecklistStep = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  // Omitted entirely for steps with no reliable "done" signal (e.g.
  // "share your store link") rather than ever being null/false — those
  // always render as a plain action, never a checkmark that can't be real.
  done?: boolean;
};

const PRODUCT_STEP_COPY: Record<StoreType, { title: string; description: string }> = {
  physical: { title: "أضف منتجك الأول", description: "أضف منتجًا واحدًا على الأقل ليظهر متجرك جاهزًا للبيع." },
  digital: { title: "أضف منتجك الأول", description: "أضف منتجًا رقميًا واحدًا على الأقل ليبدأ عملاؤك بالشراء." },
  booking: { title: "أضف خدمتك الأولى", description: "أضف خدمة واحدة على الأقل ليتمكن عملاؤك من حجزها." },
  rental: { title: "أضف أول قطعة للتأجير", description: "أضف قطعة واحدة على الأقل مع سعرها اليومي." },
  showcase: { title: "أضف أول عنصر للعرض", description: "أضف عنصرًا واحدًا على الأقل ليستعرضه زوّار متجرك." },
};

// Pure — no fetching, no DOM, no localStorage — so the "which steps apply
// and which are done" logic can be unit tested directly against a plain
// Store/products shape, the same way src/lib/analytics.ts's aggregation
// helpers are tested without a database.
export function resolveChecklistSteps(store: Store, productCount: number): ChecklistStep[] {
  const steps: ChecklistStep[] = [];

  const productCopy = PRODUCT_STEP_COPY[store.type];
  steps.push({
    id: "add-product",
    title: productCopy.title,
    description: productCopy.description,
    ctaLabel: "أضف الآن",
    ctaHref: "/dashboard/products",
    done: productCount > 0,
  });

  steps.push({
    id: "customize-design",
    title: "خصص تصميم متجرك",
    description: "أضف شعار متجرك وألوانه ليعكس هوية علامتك التجارية.",
    ctaLabel: "تخصيص",
    ctaHref: "/dashboard/design",
    done: Boolean(store.customization?.logo),
  });

  // Showcase stores have no checkout at all — a payment method is
  // meaningless for them (matches the same store.type === "showcase"
  // exclusion already applied to orders/bundles/upsells/affiliates
  // throughout the dashboard nav and storefront).
  if (store.type !== "showcase") {
    steps.push({
      id: "enable-payment",
      title: "فعّل طريقة الدفع",
      description: "فعّل الدفع عند الاستلام أو الدفع الإلكتروني ليتمكن عملاؤك من الشراء.",
      ctaLabel: "الإعدادات",
      ctaHref: "/dashboard/settings",
      done: store.codEnabled || Boolean(store.walletProvider),
    });
  }

  if (store.type === "booking") {
    steps.push({
      id: "set-working-hours",
      title: "حدد ساعات العمل ومدة الموعد",
      description: "حدد الأيام والساعات المتاحة للحجز حتى يرى عملاؤك المواعيد الحقيقية.",
      ctaLabel: "الإعدادات",
      ctaHref: "/dashboard/settings",
      done: Boolean(store.bookingWorkingHours),
    });
  }

  steps.push({
    id: "share-link",
    title: "شارك رابط متجرك",
    description: "شارك رابط متجرك مع عملائك عبر وسائل التواصل الاجتماعي أو واتساب.",
    ctaLabel: "نسخ الرابط",
    ctaHref: `https://${store.slug}.rifqa.ly`,
    // No reliable signal a merchant has actually shared anything — always
    // a plain action, never marked done.
  });

  return steps;
}
