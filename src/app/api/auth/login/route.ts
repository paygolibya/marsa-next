import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { expireIfLapsed } from "@/lib/subscription/expire";
import { handleLogin } from "./handler";

// POST /api/auth/login — see handler.ts for the actual logic (it's
// injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleLogin({ db: prisma, expireIfLapsed, comparePassword: bcrypt.compareSync }, req);
}
