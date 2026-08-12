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

export const createProductSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "اسم المنتج مطلوب"),
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر"),
  imageUrl: z.string().url().optional().nullable(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب").optional(),
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر").optional(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  stockQty: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export const updateStoreSettingsSchema = z.object({
  aboutText: z.string().optional().nullable(),
  returnPolicy: z.string().optional().nullable(),
  shippingPolicy: z.string().optional().nullable(),
  businessHours: z.string().optional().nullable(),
});

export const createOrderSchema = z.object({
  storeSlug: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
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
