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
  storeTypes: ["physical", "digital"],
  industries: [],
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

test("with no storeType given, doesn't filter by storeTypes at all", async () => {
  let receivedArgs: unknown;
  const db: ListTemplatesDb = {
    template: { findMany: async (args) => { receivedArgs = args; return []; } },
  };
  await handleListTemplates(db, null);
  assert.deepEqual((receivedArgs as any).where, { active: true });
});

test("with a storeType given, filters to templates whose storeTypes array includes it", async () => {
  let receivedArgs: unknown;
  const db: ListTemplatesDb = {
    template: { findMany: async (args) => { receivedArgs = args; return []; } },
  };
  await handleListTemplates(db, "booking");
  assert.deepEqual((receivedArgs as any).where, { active: true, storeTypes: { has: "booking" } });
});

test("returns a 500 if the query fails, not an unhandled exception", async () => {
  const db: ListTemplatesDb = { template: { findMany: async () => { throw new Error("db down"); } } };
  const res = await handleListTemplates(db);
  assert.equal(res.status, 500);
});

test("with an industry given, sorts industry-matching templates first but keeps everyone", async () => {
  const unmatched1 = { ...fullTemplate, id: "t-unmatched-1", industries: [], featured: true, usageCount: 999 };
  const matched = { ...fullTemplate, id: "t-matched", industries: ["fashion"], featured: false, usageCount: 1 };
  const unmatched2 = { ...fullTemplate, id: "t-unmatched-2", industries: ["pets"], featured: false, usageCount: 0 };
  const db: ListTemplatesDb = {
    template: { findMany: async () => [unmatched1, matched, unmatched2] },
  };
  const res = await handleListTemplates(db, null, "fashion");
  const body = await res.json();
  assert.deepEqual(body.templates.map((t: { id: string }) => t.id), ["t-matched", "t-unmatched-1", "t-unmatched-2"]);
});

test("with no industry given, leaves the DB's own featured/usageCount order untouched", async () => {
  const db: ListTemplatesDb = {
    template: { findMany: async () => [fullTemplate, { ...fullTemplate, id: "t2", industries: ["fashion"] }] },
  };
  const res = await handleListTemplates(db, null, null);
  const body = await res.json();
  assert.deepEqual(body.templates.map((t: { id: string }) => t.id), ["t1", "t2"]);
});
