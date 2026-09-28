import { listVanexPickups, requestVanexPickup } from "@/lib/integrations/vanex";
import { handleListVanexPickups, handleRequestVanexPickup } from "./handler";

const deps = { listVanexPickups, requestVanexPickup };

// GET/POST /api/admin/vanex/pickups — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleListVanexPickups(deps, req);
}

export async function POST(req: Request) {
  return handleRequestVanexPickup(deps, req);
}
