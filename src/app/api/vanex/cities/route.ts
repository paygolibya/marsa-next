import { prisma } from "@/lib/prisma";
import { handleVanexCities } from "./handler";

// GET /api/vanex/cities — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET() {
  return handleVanexCities(prisma);
}
