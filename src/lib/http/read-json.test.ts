import test from "node:test";
import assert from "node:assert/strict";
import { MalformedJsonError, malformedJsonResponse, readJsonBody } from "./read-json";

const post = (body: string) => new Request("http://localhost/x", { method: "POST", body });

test("parses a valid JSON body", async () => {
  assert.deepEqual(await readJsonBody(post('{"a":1}')), { a: 1 });
});

test("throws MalformedJsonError for invalid or empty bodies", async () => {
  await assert.rejects(readJsonBody(post("not-json{")), MalformedJsonError);
  await assert.rejects(readJsonBody(post("")), MalformedJsonError);
});

test("malformedJsonResponse is a 400", async () => {
  const res = malformedJsonResponse();
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid JSON" });
});
