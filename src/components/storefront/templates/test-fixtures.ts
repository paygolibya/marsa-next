import type { Store, StoreCustomization } from "@/lib/api";

// A minimal, valid Store for rendering a template in isolation — every
// field a template might read is present, so tests only need to override
// what they actually care about via customizationOverrides.
export function makeTestStore(customizationOverrides: Partial<StoreCustomization> = {}): Store {
  const customization: StoreCustomization = {
    primaryColor: "#0066cc",
    secondaryColor: "#f0f0f0",
    accentColor: null,
    logo: "https://example.com/logo.png",
    favicon: null,
    tagline: "Test tagline",
    description: "Test description",
    headerStyle: "standard",
    footerStyle: "standard",
    showLogo: true,
    showStoreName: true,
    logoSize: "md",
    textColor: null,
    textSize: "md",
    coverImage: null,
    coverImageSize: "md",
    heroEnabled: true,
    heroSize: "md",
    cartPosition: "left",
    showNewsletter: true,
    showReviews: true,
    showTestimonials: true,
    showSocialProof: true,
    template: { slug: "modern", nameAr: "الحديث" },
    ...customizationOverrides,
  };

  return {
    id: "store-1",
    merchantId: "merchant-1",
    name: "Test Store",
    slug: "test-store",
    theme: "souk",
    courier: "vanex",
    codEnabled: true,
    type: "physical",
    bookingSlotMinutes: null,
    bookingWorkingHours: null,
    walletProvider: null,
    currency: "LYD",
    createdAt: new Date().toISOString(),
    aboutText: null,
    returnPolicy: null,
    shippingPolicy: null,
    businessHours: null,
    customization,
  };
}

// Every prop a template needs besides `store` — none of these tests enable
// any body sections, so the section-rendering components (which have their
// own state/data needs) are never invoked; only header/logo/cart/cover/hero
// layout is under test here.
export const baseTemplateProps = {
  slug: "test-store",
  products: [],
  filtered: [],
  query: "",
  setQuery: () => {},
  categories: [],
  selectedCategoryId: null,
  setSelectedCategoryId: () => {},
  stats: null,
  testimonials: [],
  cartTotalItems: 0,
  onOpenCart: () => {},
  onAddToCart: () => {},
  newsletterEmail: "",
  setNewsletterEmail: () => {},
  newsletterState: "idle" as const,
  onNewsletterSubmit: () => {},
  sections: [],
};
