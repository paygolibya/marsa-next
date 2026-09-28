import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleImageUpload, type UploadImageDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/uploads/image", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/uploads/image", { method: "POST", body: JSON.stringify(body) });
}

const uploadBody = { type: "blob.generate-client-token", payload: { pathname: "photo.jpg", callbackUrl: "http://x" } };

function makeFakeDeps() {
  const calls: { tokenConfig?: unknown } = {};
  const deps: UploadImageDeps = {
    handleUpload: async (args) => {
      calls.tokenConfig = await args.onBeforeGenerateToken();
      return { type: "blob.generate-client-token", clientToken: "fake-token" };
    },
  };
  return { deps, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleImageUpload(deps, noTokenReq(uploadBody));
  assert.equal(res.status, 401);
});

test("scopes the issued upload token to the authenticated merchant", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleImageUpload(deps, req(uploadBody, "merchant-42"));
  const config = calls.tokenConfig as { tokenPayload: string };
  assert.deepEqual(JSON.parse(config.tokenPayload), { merchantId: "merchant-42" });
});

test("caps the upload size at 15MB and restricts to real image content types", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleImageUpload(deps, req(uploadBody));
  const config = calls.tokenConfig as { maximumSizeInBytes: number; allowedContentTypes: string[] };
  assert.equal(config.maximumSizeInBytes, 15 * 1024 * 1024);
  assert.ok(config.allowedContentTypes.includes("image/png"));
  assert.ok(!config.allowedContentTypes.includes("application/pdf"));
});

test("returns 400 (not 500) when the Blob SDK call itself fails", async () => {
  const deps: UploadImageDeps = { handleUpload: async () => { throw new Error("Blob service error"); } };
  const res = await handleImageUpload(deps, req(uploadBody));
  assert.equal(res.status, 400);
});
