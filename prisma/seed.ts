import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { phone: "0910000000" },
    update: {},
    create: {
      name: "أحمد الطرابلسي",
      phone: "0910000000",
      passwordHash: bcrypt.hashSync("password123", 10),
    },
  });

  const store = await prisma.store.upsert({
    where: { slug: "alhayes-fashion" },
    update: {},
    create: {
      merchantId: merchant.id,
      name: "أزياء الحياة",
      slug: "alhayes-fashion",
      theme: "souk",
      courier: "vanex",
      codEnabled: true,
      walletProvider: "anis",
    },
  });

  const templates = [
    {
      id: "template-modern",
      name: "Modern",
      nameAr: "الحديث",
      slug: "modern",
      description: "Clean and minimal design perfect for any business",
      descriptionAr: "تصميم نظيف وبسيط مناسب لأي متجر",
      category: "all",
      price: 0,
      billingType: "free",
      thumbnail: "/templates/modern-thumb.svg",
      previewUrl: "https://preview-modern.rifqa.ly",
      features: ["Fast Loading", "Mobile Optimized", "RTL Support", "High Conversion"],
      componentPath: "free/modern",
      defaultColors: { primaryColor: "#0066cc", secondaryColor: "#f0f0f0" },
      usageCount: 234,
      rating: 4.8,
      reviews: 145,
      isNew: false,
      featured: true,
      active: true,
    },
    {
      id: "template-bold",
      name: "Bold",
      nameAr: "المميز",
      slug: "bold",
      description: "Eye-catching colors and animations",
      descriptionAr: "ألوان جذابة وحركات أنيقة",
      category: "all",
      price: 0,
      billingType: "free",
      thumbnail: "/templates/bold-thumb.svg",
      previewUrl: "https://preview-bold.rifqa.ly",
      features: ["Animated Sections", "Strong Typography", "Mobile First", "Visual Storytelling"],
      componentPath: "free/bold",
      defaultColors: { primaryColor: "#ef4444", secondaryColor: "#fef2f2" },
      usageCount: 189,
      rating: 4.7,
      reviews: 112,
      isNew: false,
      featured: true,
      active: true,
    },
    {
      id: "template-luxury",
      name: "Luxury",
      nameAr: "الفاخر",
      slug: "luxury",
      description: "Premium dark theme with elegant touches",
      descriptionAr: "موضوع مظلم متميز مع لمسات أنيقة",
      category: "premium",
      price: 20,
      billingType: "monthly",
      thumbnail: "/templates/luxury-thumb.svg",
      previewUrl: "https://preview-luxury.rifqa.ly",
      features: ["Dark Mode", "Gold Accents", "Advanced Animations", "Wishlist Feature"],
      componentPath: "paid/luxury",
      defaultColors: { primaryColor: "#1f2937", secondaryColor: "#f59e0b" },
      usageCount: 67,
      rating: 4.9,
      reviews: 48,
      isNew: false,
      featured: false,
      active: true,
    },
    {
      id: "template-marketplace",
      name: "Marketplace",
      nameAr: "السوق",
      slug: "marketplace",
      description: "B2B & Wholesale focused template",
      descriptionAr: "قالب متخصص في البيع بالجملة والبيع B2B",
      category: "premium",
      price: 100,
      billingType: "one-time",
      thumbnail: "/templates/marketplace-thumb.svg",
      previewUrl: "https://preview-marketplace.rifqa.ly",
      features: ["Category Pages", "Bulk Orders", "Wholesale Pricing", "RFQ Feature"],
      componentPath: "paid/marketplace",
      defaultColors: { primaryColor: "#0066cc", secondaryColor: "#f8fafc" },
      usageCount: 42,
      rating: 4.6,
      reviews: 28,
      isNew: true,
      featured: false,
      active: true,
    },
  ];

  for (const template of templates) {
    await prisma.template.upsert({
      where: { slug: template.slug },
      update: {
        name: template.name,
        nameAr: template.nameAr,
        description: template.description,
        descriptionAr: template.descriptionAr,
        category: template.category,
        price: template.price,
        billingType: template.billingType,
        thumbnail: template.thumbnail,
        previewUrl: template.previewUrl,
        features: template.features as never,
        componentPath: template.componentPath,
        defaultColors: template.defaultColors as never,
        usageCount: template.usageCount,
        rating: template.rating,
        reviews: template.reviews,
        isNew: template.isNew,
        featured: template.featured,
        active: template.active,
      },
      create: {
        id: template.id,
        name: template.name,
        nameAr: template.nameAr,
        slug: template.slug,
        description: template.description,
        descriptionAr: template.descriptionAr,
        category: template.category,
        price: template.price,
        billingType: template.billingType,
        thumbnail: template.thumbnail,
        previewUrl: template.previewUrl,
        features: template.features as never,
        componentPath: template.componentPath,
        defaultColors: template.defaultColors as never,
        usageCount: template.usageCount,
        rating: template.rating,
        reviews: template.reviews,
        isNew: template.isNew,
        featured: template.featured,
        active: template.active,
      },
    });
  }

  const products: [string, number][] = [
    ["حقيبة جلدية", 18500],
    ["ساعة رجالية", 24000],
    ["طقم شاي سيراميك", 9500],
    ["وشاح صوف", 6000],
  ];

  for (const [name, priceCents] of products) {
    await prisma.product.upsert({
      where: { id: `${store.id}-${name}` },
      update: {},
      create: { id: `${store.id}-${name}`, storeId: store.id, name, priceCents },
    });
  }

  console.log("Seeded merchant, store, templates, and sample products.");
  console.log("Login with phone 0910000000 / password password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
