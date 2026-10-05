import { z } from "zod";
import { normalizeLibyanPhone } from "@/lib/integrations/sms";

export const registerSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  phone: z
    .string()
    .transform((v) => normalizeLibyanPhone(v) ?? v)
    .refine((v) => /^09\d{8}$/.test(v), "رقم هاتف ليبي صحيح مطلوب (مثال: 0912345678)"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

export const createStoreSchema = z.object({
  name: z.string().min(1, "اسم المتجر مطلوب"),
  theme: z.string().optional(),
  courier: z.enum(["vanex"]).optional(),
  codEnabled: z.boolean().optional(),
  walletProvider: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  type: z.enum(["physical", "digital", "booking", "rental", "showcase"]).optional(),
});

// Up to 8 photos per product — enough for a real gallery without inviting
// abuse; imageUrl is always derived as images[0] server-side, never sent
// independently.
const productImagesSchema = z.array(z.string().url()).max(8).optional();

// Capped well above what any real product description needs — a guard
// against someone pasting an entire page of text in, not a realistic limit.
const productDescriptionSchema = z.string().max(5000, "الوصف طويل جدًا").optional().nullable();

// Capped at typical search-engine display limits — anything longer is
// truncated by Google anyway, so a higher limit would just store text
// that never actually shows up.
const metaTitleSchema = z.string().max(70, "العنوان الوصفي طويل جدًا").optional().nullable();
const metaDescriptionSchema = z.string().max(160, "الوصف التعريفي طويل جدًا").optional().nullable();
const costPriceCentsSchema = z.number().int().min(0, "سعر التكلفة يجب أن يكون صفرًا أو أكبر").optional().nullable();

// Optional per-language overrides, keyed by language code — any field left
// out falls back to the product's own Arabic field, never to a blank string.
const productTranslationsSchema = z
  .record(
    z.string(),
    z.object({
      name: z.string().max(200).optional(),
      description: z.string().max(5000).optional(),
      metaTitle: z.string().max(70).optional(),
      metaDescription: z.string().max(160).optional(),
    }),
  )
  .optional()
  .nullable();

export const createProductSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "اسم المنتج مطلوب"),
  description: productDescriptionSchema,
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر"),
  images: productImagesSchema,
  categoryId: z.string().optional().nullable(),
  metaTitle: metaTitleSchema,
  metaDescription: metaDescriptionSchema,
  costPriceCents: costPriceCentsSchema,
  translations: productTranslationsSchema,
});

export const updateProductSchema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب").optional(),
  description: productDescriptionSchema,
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر").optional(),
  images: productImagesSchema,
  active: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  stockQty: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  categoryId: z.string().optional().nullable(),
  metaTitle: metaTitleSchema,
  metaDescription: metaDescriptionSchema,
  costPriceCents: costPriceCentsSchema,
  translations: productTranslationsSchema,
});

// Capped at 2 option types (e.g. "الحجم" + "اللون") — enough for the
// overwhelming majority of small-merchant catalogs this app targets,
// while keeping the generated combination matrix (values1 × values2)
// from growing unmanageably large in the editor UI.
export const productVariantOptionSchema = z.object({
  name: z.string().min(1, "اسم الخيار مطلوب").max(30),
  values: z.array(z.string().min(1).max(30)).min(1, "أضف قيمة واحدة على الأقل").max(10),
});
export const setProductVariantOptionsSchema = z.object({
  options: z.array(productVariantOptionSchema).max(2, "حتى نوعين من الخيارات (مثال: الحجم واللون)"),
});
export const updateProductVariantSchema = z.object({
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر").optional().nullable(),
  stockQty: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

// Keyed by day-of-week as a string ("0" = Sunday ... "6" = Saturday); a
// missing/null day means closed that day. See src/lib/booking.ts for how
// this turns into actual appointment slots.
// Bounds the hour/minute ranges too (not just the digit shape) — an
// out-of-range value like "25:99" would otherwise pass this schema but
// then be silently treated as "closed" by src/lib/booking.ts's
// parseHHMM, saving with a 200 while quietly producing zero slots for
// that day with no error ever surfaced to the merchant.
const bookingDaySchema = z.object({
  open: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "صيغة وقت غير صحيحة"),
  close: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "صيغة وقت غير صحيحة"),
});
export const bookingWorkingHoursSchema = z.record(z.string(), bookingDaySchema.nullable());

// "ar" is always a supported language regardless of what's in the list —
// every string dictionary falls back to it, and the dashboard itself stays
// Arabic-only — so there's no scenario where a store should be able to drop
// it entirely.
const languageSchema = z.enum(["ar", "en"]);

export const updateStoreSettingsSchema = z.object({
  aboutText: z.string().optional().nullable(),
  returnPolicy: z.string().optional().nullable(),
  shippingPolicy: z.string().optional().nullable(),
  businessHours: z.string().optional().nullable(),
  type: z.enum(["physical", "digital", "booking", "rental", "showcase"]).optional(),
  bookingSlotMinutes: z.number().int().positive().max(24 * 60).optional().nullable(),
  bookingWorkingHours: bookingWorkingHoursSchema.optional().nullable(),
  language: languageSchema.optional(),
  supportedLanguages: z.array(languageSchema).min(1).optional(),
});

export const createOrderSchema = z
  .object({
    storeSlug: z.string().min(1),
    items: z
      .array(
        z
          .object({
            productId: z.string().optional(),
            bundleId: z.string().optional(),
            quantity: z.number().int().positive(),
            variantId: z.string().optional(),
          })
          .refine((v) => Boolean(v.productId) !== Boolean(v.bundleId), {
            message: "كل عنصر في السلة يجب أن يكون منتجًا أو باقة",
          })
      )
      .min(1, "السلة فارغة"),
    buyer: z.object({
      name: z.string().min(1, "اسم العميل مطلوب"),
      phone: z.string().min(6, "رقم هاتف غير صالح"),
      email: z.string().email("بريد إلكتروني غير صالح").optional().or(z.literal("")),
      city: z.string().min(1, "المدينة مطلوبة"),
      address: z.string().min(1, "العنوان مطلوب"),
      vanexAreaId: z.string().min(1).optional(),
      // City-level fallback: used only when the buyer picked a city but no
      // specific area, so shipping still prices at the city's own flat
      // Vanex rate instead of defaulting to free shipping.
      vanexCityId: z.string().min(1).optional(),
    }),
    paymentMethod: z.enum(["cod", "wallet"]),
    couponCode: z.string().optional(),
    // An affiliate's ?ref=CODE, carried from wherever the buyer first
    // landed through to checkout — see src/lib/referral.ts. An
    // unrecognized/inactive code is silently ignored at order-creation,
    // never a reason to fail the order (it's a marketing attribution
    // signal, not part of the checkout's own validity).
    referralCode: z.string().optional(),
    // Rental stores: a rental period (store.type === "rental"); booking
    // stores: an appointment slot start, with the end recomputed
    // server-side from Store.bookingSlotMinutes, never trusted from the
    // client (store.type === "booking"). ISO strings, parsed/validated
    // against the actual store type in the handler, since a plain zod
    // shape here can't see which store this request is for.
    scheduledStartAt: z.string().optional(),
    scheduledEndAt: z.string().optional(),
  });

// Showcase stores (store.type === "showcase") have no checkout — a buyer
// interested in a product sends this instead of placing an order.
export const createInquirySchema = z.object({
  storeSlug: z.string().min(1),
  productId: z.string().optional(),
  buyerName: z.string().min(1, "الاسم مطلوب"),
  buyerPhone: z.string().min(6, "رقم هاتف غير صالح"),
  message: z.string().min(1, "الرسالة مطلوبة").max(1000),
});

const bundleItemsSchema = z
  .array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() }))
  .min(1, "أضف منتجًا واحدًا على الأقل");

export const createBundleSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "اسم الباقة مطلوب").max(100),
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر"),
  imageUrl: z.string().url().optional().nullable(),
  items: bundleItemsSchema,
});

export const updateBundleSchema = z.object({
  name: z.string().min(1, "اسم الباقة مطلوب").max(100).optional(),
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر").optional(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  items: bundleItemsSchema.optional(),
});

export const createUpsellSchema = z
  .object({
    storeId: z.string().min(1),
    triggerProductId: z.string().min(1),
    offeredProductId: z.string().min(1),
  })
  .refine((v) => v.triggerProductId !== v.offeredProductId, { message: "لا يمكن اقتراح المنتج نفسه عند شرائه" });

export const updateUpsellSchema = z.object({
  active: z.boolean().optional(),
});

export const createPageSchema = z.object({
  storeId: z.string().min(1),
  title: z.string().min(1, "عنوان الصفحة مطلوب").max(100),
  // Capped like Product.description — a guard against pasting in an
  // entire document, not a realistic page-length limit.
  content: z.string().max(20000, "محتوى الصفحة طويل جدًا"),
});

export const updatePageSchema = z.object({
  title: z.string().min(1, "عنوان الصفحة مطلوب").max(100).optional(),
  content: z.string().max(20000, "محتوى الصفحة طويل جدًا").optional(),
});

export const createNavMenuItemSchema = z.object({
  storeId: z.string().min(1),
  label: z.string().min(1, "اسم الرابط مطلوب").max(40),
  url: z.string().min(1, "الرابط مطلوب").max(500),
});

export const updateNavMenuItemSchema = z.object({
  label: z.string().min(1, "اسم الرابط مطلوب").max(40).optional(),
  url: z.string().min(1, "الرابط مطلوب").max(500).optional(),
  position: z.number().int().min(0).optional(),
});

export const createRedirectSchema = z
  .object({
    storeId: z.string().min(1),
    fromPath: z.string().min(1, "المسار الأصلي مطلوب").max(300),
    toPath: z.string().min(1, "المسار الجديد مطلوب").max(300),
  })
  .refine((v) => v.fromPath !== v.toPath, { message: "لا يمكن أن يكون المسار الأصلي والجديد متطابقين" });

export const updateRedirectSchema = z.object({
  toPath: z.string().min(1, "المسار الجديد مطلوب").max(300).optional(),
});

export const createAffiliateSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "اسم المسوّق مطلوب").max(60),
  phone: z.string().min(1, "رقم الهاتف مطلوب").max(20),
  commissionPercent: z.number().int().min(1, "النسبة يجب أن تكون أكبر من صفر").max(100, "النسبة لا يمكن أن تتجاوز 100").optional(),
});

export const updateAffiliateSchema = z.object({
  name: z.string().min(1, "اسم المسوّق مطلوب").max(60).optional(),
  phone: z.string().min(1, "رقم الهاتف مطلوب").max(20).optional(),
  commissionPercent: z.number().int().min(1, "النسبة يجب أن تكون أكبر من صفر").max(100, "النسبة لا يمكن أن تتجاوز 100").optional(),
  active: z.boolean().optional(),
});

export const ANALYTICS_EVENT_TYPES = ["pageview", "add_to_cart", "checkout_started", "order_completed"] as const;
export const createAnalyticsEventSchema = z.object({
  storeSlug: z.string().min(1),
  type: z.enum(ANALYTICS_EVENT_TYPES),
  path: z.string().min(1).max(500),
  referrer: z.string().max(500).optional(),
  sessionId: z.string().min(1).max(100),
});

export const createCouponSchema = z.object({
  storeId: z.string().min(1),
  code: z.string().min(1, "رمز الكوبون مطلوب").transform((v) => v.trim().toUpperCase()),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.number().int().positive("قيمة الخصم يجب أن تكون أكبر من صفر"),
  minOrderCents: z.number().int().min(0).optional().nullable(),
  maxUsage: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const updateCouponSchema = z.object({
  active: z.boolean().optional(),
  maxUsage: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const createCategorySchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "اسم التصنيف مطلوب").max(60),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, "اسم التصنيف مطلوب").max(60).optional(),
  position: z.number().int().min(0).optional(),
});

export const createReviewSchema = z.object({
  orderId: z.string().min(1),
  phone: z.string().min(6, "رقم هاتف غير صالح"),
  buyerName: z.string().min(1, "الاسم مطلوب"),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().optional().nullable(),
});

export const setCustomDomainSchema = z.object({
  storeId: z.string().min(1),
  // null clears the domain. Basic hostname shape only — Vercel's own API
  // is the real validator (rejects anything it can't actually route to).
  customDomain: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, "نطاق غير صالح")
    .transform((v) => v.toLowerCase())
    .nullable(),
});

export const transferPayoutSchema = z.object({
  payoutId: z.string().min(1),
  transferReference: z.string().max(200).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});
