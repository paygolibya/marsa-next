import test from "node:test";
import assert from "node:assert/strict";
import { resolveVanexCourierStatus, isValidVanexWebhookKey } from "./vanex-webhook";

test("known Vanex event types map to this app's own courier status vocabulary", () => {
  assert.equal(resolveVanexCourierStatus("package_accepted"), "accepted");
  assert.equal(resolveVanexCourierStatus("package_delivered"), "delivered");
  assert.equal(resolveVanexCourierStatus("package_failed_delivery"), "failed_delivery");
  assert.equal(resolveVanexCourierStatus("packages_returned"), "returned");
});

test("an unrecognized event type resolves to null rather than a guessed status", () => {
  assert.equal(resolveVanexCourierStatus("some_new_event_vanex_added_later"), null);
});

test("webhook key must match the configured secret exactly", () => {
  assert.equal(isValidVanexWebhookKey("secret123", "secret123"), true);
  assert.equal(isValidVanexWebhookKey("wrong", "secret123"), false);
});

test("webhook key check fails closed when either side is missing", () => {
  assert.equal(isValidVanexWebhookKey(null, "secret123"), false);
  assert.equal(isValidVanexWebhookKey("secret123", undefined), false);
  assert.equal(isValidVanexWebhookKey(null, undefined), false);
});
