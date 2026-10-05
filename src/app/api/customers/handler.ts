import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";

type CustomerRow = {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  city: string | null;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: Date;
};

export type CustomersDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  customer: {
    findMany: (args: { where: { storeId: string }; orderBy: { totalSpentCents: "desc" } }) => Promise<CustomerRow[]>;
  };
};

// GET /api/customers?storeId=... — a merchant's buyer list, entirely
// derived from real Order history (see /api/orders' Customer upsert) —
// nothing here is merchant-editable.
export async function handleListCustomers(db: CustomersDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const customers = await db.customer.findMany({ where: { storeId }, orderBy: { totalSpentCents: "desc" } });
  return NextResponse.json(customers);
}
