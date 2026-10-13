import { prisma } from "@/lib/prisma";
import { handleMarkAllRead } from "./handler";

// PATCH /api/notifications/mark-all-read — see handler.ts (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function PATCH(req: Request) {
  return handleMarkAllRead(prisma, req);
}
