import { cancelVanexPickup } from "@/lib/integrations/vanex";
import { handleCancelVanexPickup } from "./handler";

// DELETE /api/admin/vanex/pickups/[id] — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleCancelVanexPickup({ cancelVanexPickup }, req, id);
}
