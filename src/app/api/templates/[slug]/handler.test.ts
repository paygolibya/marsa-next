import test from "node:test";
import assert from "node:assert/strict";
import { handleGetTemplate, type TemplateBySlugDb } from "./handler";

test("returns 404 for an unknown slug", async () => {
  const db: TemplateBySlugDb = { template: { findUnique: async () => null } };
  const res = await handleGetTemplate(db, "nope");
  assert.equal(res.status, 404);
});

test("returns the template with up to 5 most recent reviews", async () => {
  const reviews = [{ rating: 5, reviewText: "great", reviewTextAr: null, createdAt: new Date() }];
  const db: TemplateBySlugDb = { template: { findUnique: async () => ({ id: "t1", slug: "modern", reviewsData: reviews }) } };
  const res = await handleGetTemplate(db, "modern");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.template.slug, "modern");
  assert.equal(body.template.reviewsData.length, 1);
});

test("returns 500 if the lookup fails", async () => {
  const db: TemplateBySlugDb = { template: { findUnique: async () => { throw new Error("db down"); } } };
  const res = await handleGetTemplate(db, "modern");
  assert.equal(res.status, 500);
});
