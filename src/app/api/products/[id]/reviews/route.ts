import { prisma } from "@/lib/prisma";
import { verifyBuyerOrder } from "@/lib/verify-buyer";
import { handleListReviews, handleCreateReview } from "./handler";

// GET/POST /api/products/:id/reviews — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleListReviews(prisma, id);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleCreateReview({ db: prisma, verifyBuyerOrder }, req, id);
}
