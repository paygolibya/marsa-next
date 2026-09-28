import test from "node:test";
import assert from "node:assert/strict";
import { handleListTemplates, type ListTemplatesDb } from "./handler";

const fullTemplate = {
  id: "t1",
  name: "Modern",
  nameAr: "عصري",
  slug: "modern",
  description: "A modern template",
  descriptionAr: "قالب عصري",
  price: 0,
  billingType: "free",
  thumbnail: "thumb.png",
  previewUrl: null,
  features: [],
  usageCount: 5,
  rating: 4.5,
  reviews: 10,
  isNew: false,
  featured: true,
};

test("filters to active templates, ordered featured-first then by usage", async () => {
  let receivedArgs: unknown;
  const db: ListTemplatesDb = {
    template: {
      findMany: async (args) => {
        receivedArgs = args;
        return [fullTemplate];
      },
    },
  };
  const res = await handleListTemplates(db);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.templates.length, 1);
  assert.deepEqual((receivedArgs as any).where, { active: true });
  assert.deepEqual((receivedArgs as any).orderBy, [{ featured: "desc" }, { usageCount: "desc" }]);
});

test("returns a 500 if the query fails, not an unhandled exception", async () => {
  const db: ListTemplatesDb = { template: { findMany: async () => { throw new Error("db down"); } } };
  const res = await handleListTemplates(db);
  assert.equal(res.status, 500);
});
