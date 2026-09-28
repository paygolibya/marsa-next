import { syncVanexCities } from "@/lib/integrations/vanex";
import { handleSyncVanexCities } from "./handler";

// POST /api/admin/vanex/sync-cities — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleSyncVanexCities({ syncVanexCities }, req);
}
