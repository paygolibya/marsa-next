import { prisma } from "@/lib/prisma";
import { handleNewsletterSubscribe } from "./handler";

// POST /api/newsletter/subscribe — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleNewsletterSubscribe(prisma, req);
}
