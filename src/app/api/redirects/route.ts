import { prisma } from "@/lib/prisma";
import { handleCreateRedirect, handleListRedirects } from "./handler";

// POST /api/redirects, GET /api/redirects?storeId=... — see handler.ts
// for the actual logic (injectable there so it can be
// integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateRedirect(prisma, req);
}
export async function GET(req: Request) {
  return handleListRedirects(prisma, req);
}
