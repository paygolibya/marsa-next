import { prisma } from "@/lib/prisma";
import { handleDeleteAccount } from "./handler";

// POST /api/merchant/account/delete — see handler.ts.
export async function POST(req: Request) {
  return handleDeleteAccount({ db: prisma }, req);
}

// Deleting a large store can take a while (see handler.ts timeout).
export const maxDuration = 60;
