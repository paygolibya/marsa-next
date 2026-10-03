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
});

// Up to 8 photos per product — enough for a real gallery without inviting
// abuse; imageUrl is always derived as images[0] server-side, never sent
// independently.
const productImagesSchema = z.array(z.string().url()).max(8).optional();

export const createProductSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "اسم المنتج مطلوب"),
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر"),
  images: productImagesSchema,
});

export const updateProductSchema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب").optional(),
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر").optional(),
  images: productImagesSchema,
  active: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  stockQty: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
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
const bookingDaySchema = z.object({
  open: z.string().regex(/^\d{1,2}:\d{2}$/, "صيغة وقت غير صحيحة"),
  close: z.string().regex(/^\d{1,2}:\d{2}$/, "صيغة وقت غير صحيحة"),
});
export const bookingWorkingHoursSchema = z.record(z.string(), bookingDaySchema.nullable());

export const updateStoreSettingsSchema = z.object({
  aboutText: z.string().optional().nullable(),
  returnPolicy: z.string().optional().nullable(),
  shippingPolicy: z.string().optional().nullable(),
  businessHours: z.string().optional().nullable(),
  type: z.enum(["physical", "digital", "booking", "rental", "showcase"]).optional(),
  bookingSlotMinutes: z.number().int().positive().max(24 * 60).optional().nullable(),
  bookingWorkingHours: bookingWorkingHoursSchema.optional().nullable(),
});

export const createOrderSchema = z
  .object({
    storeSlug: z.string().min(1),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().positive(),
          variantId: z.string().optional(),
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
    }),
    paymentMethod: z.enum(["cod", "wallet"]),
    couponCode: z.string().optional(),
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
