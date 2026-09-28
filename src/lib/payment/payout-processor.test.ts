import test from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "./payout-processor";

test("withRetry returns the result immediately without retrying on first success", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(calls, 1);
});

test("withRetry retries a failing call up to `retries` times, then succeeds if a later attempt works", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error(`attempt ${calls} failed`);
      return "ok";
    },
    3,
    1 // baseDelayMs — kept tiny so the test doesn't wait on real backoff
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("withRetry exhausts its retries and throws the LAST error, not the first", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls += 1;
          throw new Error(`attempt ${calls} failed`);
        },
        2,
        1
      ),
    /attempt 3 failed/
  );
  assert.equal(calls, 3); // the initial attempt + 2 retries
});
