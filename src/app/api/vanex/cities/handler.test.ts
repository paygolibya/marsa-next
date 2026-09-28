import test from "node:test";
import assert from "node:assert/strict";
import { handleVanexCities, type VanexCitiesDb } from "./handler";

test("returns cities with their areas, ordered by name", async () => {
  let receivedArgs: unknown;
  const db: VanexCitiesDb = {
    vanexCity: {
      findMany: async (args) => {
        receivedArgs = args;
        return [{ id: "c1", name: "طرابلس", areas: [{ id: "a1", name: "حي الأندلس", priceCents: 1500 }] }];
      },
    },
  };
  const res = await handleVanexCities(db);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.cities.length, 1);
  assert.equal(body.cities[0].areas.length, 1);
  assert.deepEqual((receivedArgs as any).orderBy, { name: "asc" });
});

test("returns an empty list (not an error) when no cities are synced yet", async () => {
  const db: VanexCitiesDb = { vanexCity: { findMany: async () => [] } };
  const res = await handleVanexCities(db);
  const body = await res.json();
  assert.deepEqual(body, { cities: [] });
});
