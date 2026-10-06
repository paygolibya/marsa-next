import { prisma } from "@/lib/prisma";
import { handleListTemplates } from "./handler";

// GET /api/templates — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  const storeType = new URL(req.url).searchParams.get("storeType");
  return handleListTemplates(prisma, storeType);
}
