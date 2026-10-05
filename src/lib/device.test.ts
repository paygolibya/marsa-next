import test from "node:test";
import assert from "node:assert/strict";
import { parseDeviceType } from "./device";

test("defaults to desktop when there's no User-Agent at all", () => {
  assert.equal(parseDeviceType(null), "desktop");
});

test("detects a real iPhone User-Agent as mobile", () => {
  assert.equal(parseDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"), "mobile");
});

test("detects a real Android phone User-Agent as mobile", () => {
  assert.equal(parseDeviceType("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36"), "mobile");
});

test("detects a real iPad User-Agent as tablet", () => {
  assert.equal(parseDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15"), "tablet");
});

test("detects a real desktop Chrome User-Agent as desktop", () => {
  assert.equal(parseDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"), "desktop");
});

test("is case-insensitive", () => {
  assert.equal(parseDeviceType("MOZILLA/5.0 (IPHONE; CPU IPHONE OS)"), "mobile");
});
