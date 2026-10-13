import { prisma } from "@/lib/prisma";
import { handleListTemplates } from "./handler";

// GET /api/templates — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeType = url.searchParams.get("storeType");
  const industry = url.searchParams.get("industry");
  return handleListTemplates(prisma, storeType, industry);
}
