import { prisma } from "@/lib/prisma";
import { addDomainToProject, checkDomainVerification, removeDomainFromProject } from "@/lib/domains/vercel-client";
import { handleGetDomain, handleSetDomain } from "./handler";

const deps = { db: prisma, addDomainToProject, checkDomainVerification, removeDomainFromProject };

// GET/POST /api/merchant/domain — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleGetDomain(deps, req);
}

export async function POST(req: Request) {
  return handleSetDomain(deps, req);
}
