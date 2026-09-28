import { handleUpload } from "@vercel/blob/client";
import { handleImageUpload } from "./handler";

// POST /api/uploads/image — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleImageUpload({ handleUpload }, req);
}
