import { prisma } from "@/lib/prisma";
import { handleUpdateStore } from "./handler";

// PATCH /api/stores/:id — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleUpdateStore(prisma, req, id);
}
