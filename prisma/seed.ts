import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Ported from the original marsa-backend/src/db/seed.js — same merchant,
// same store slug, same four products, same login credentials.
async function main() {
  const merchant = await prisma.merchant.create({
    data: {
      name: "أحمد الطرابلسي",
      phone: "0910000000",
      passwordHash: bcrypt.hashSync("password123", 10),
    },
  });

  const store = await prisma.store.create({
    data: {
      merchantId: merchant.id,
      name: "أزياء الحياة",
      slug: "alhayes-fashion",
      theme: "souk",
      courier: "vanex",
      codEnabled: true,
      walletProvider: "anis",
    },
  });

  const products: [string, number][] = [
    ["حقيبة جلدية", 18500],
    ["ساعة رجالية", 24000],
    ["طقم شاي سيراميك", 9500],
    ["وشاح صوف", 6000],
  ];

  for (const [name, priceCents] of products) {
    await prisma.product.create({
      data: { storeId: store.id, name, priceCents },
    });
  }

  console.log("Seeded 1 merchant, 1 store (slug: alhayes-fashion), 4 products.");
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
