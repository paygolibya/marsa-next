import { prisma } from "@/lib/prisma";
import { handleCreateCategory, handleListCategories } from "./handler";

// POST /api/categories, GET /api/categories?storeId=... — see handler.ts
// for the actual logic (injectable there so it can be integration-tested
// with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateCategory(prisma, req);
}
export async function GET(req: Request) {
  return handleListCategories(prisma, req);
}
