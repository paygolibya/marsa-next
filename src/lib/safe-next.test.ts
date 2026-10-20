import test from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./safe-next";

test("accepts same-site paths", () => {
  assert.equal(safeNextPath("/payment?period=1m"), "/payment?period=1m");
});

test("rejects absolute, protocol-relative and backslash URLs (no open redirect)", () => {
  // "/\\evil.com" is the string `/\evil.com`, which browsers treat like //evil.com.
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null]) {
    assert.equal(safeNextPath(bad as string | null), null, String(bad));
  }
});
