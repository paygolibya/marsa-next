import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  phone: z.string().min(6, "رقم هاتف غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

export const createStoreSchema = z.object({
  name: z.string().min(1, "اسم المتجر مطلوب"),
  theme: z.string().optional(),
  courier: z.enum(["vanex", "sabil", "shaheen"]).optional(),
  codEnabled: z.boolean().optional(),
  walletProvider: z.string().optional().nullable(),
});

export const createProductSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "اسم المنتج مطلوب"),
  priceCents: z.number().int().positive("السعر يجب أن يكون أكبر من صفر"),
  imageUrl: z.string().url().optional().nullable(),
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
    city: z.string().min(1, "المدينة مطلوبة"),
    address: z.string().min(1, "العنوان مطلوب"),
  }),
  paymentMethod: z.enum(["cod", "wallet"]),
});
