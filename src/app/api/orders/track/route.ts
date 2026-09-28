import { verifyBuyerOrder } from "@/lib/verify-buyer";
import { handleTrackOrder } from "./handler";

// GET /api/orders/track — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  return handleTrackOrder({ verifyBuyerOrder }, req);
}
