import { prisma } from "@/lib/prisma";
import { expireIfLapsed } from "@/lib/subscription/expire";
import { handleMe } from "./handler";

// GET /api/auth/me — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  return handleMe({ db: prisma, expireIfLapsed }, req);
}
