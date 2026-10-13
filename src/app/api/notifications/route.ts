import { prisma } from "@/lib/prisma";
import { handleListNotifications } from "./handler";

// GET /api/notifications — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  return handleListNotifications(prisma, req);
}
