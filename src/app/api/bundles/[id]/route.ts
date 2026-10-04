import { prisma } from "@/lib/prisma";
import { handleUpdateBundle, handleDeleteBundle } from "./handler";

// PATCH/DELETE /api/bundles/:id — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleUpdateBundle(prisma, req, id);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleDeleteBundle(prisma, req, id);
}
