import { prisma } from "@/lib/prisma";
import { handleUpdateVariant, handleDeleteVariant } from "./handler";

// PATCH/DELETE /api/products/:id/variants/:variantId — see handler.ts for
// the actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const { id, variantId } = await params;
  return handleUpdateVariant(prisma, req, id, variantId);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const { id, variantId } = await params;
  return handleDeleteVariant(prisma, req, id, variantId);
}
