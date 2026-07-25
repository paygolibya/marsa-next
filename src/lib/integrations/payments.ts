import { nanoid } from "nanoid";

/**
 * Two payment paths:
 *  - 'cod'    → nothing to call, order is marked pending until the courier
 *               collects cash and confirms delivery.
 *  - 'wallet' → routed through DPay, an aggregator that covers Moamalat,
 *               MobiCash, EDFali, OnePay etc. behind one API. Mocked here
 *               the same way couriers are: swap in a real call once you
 *               have a DPay merchant account.
 *
 * Ported directly from marsa-backend/src/integrations/payments/index.js.
 */

export type WalletOrder = { id: string; totalCents: number };
export type WalletPaymentResult = {
  status: "paid" | "failed";
  reference: string;
  raw: Record<string, unknown>;
};

export async function initiateWalletPayment(order: WalletOrder): Promise<WalletPaymentResult> {
  if (!process.env.DPAY_API_KEY) {
    await new Promise((r) => setTimeout(r, 150));
    return { status: "paid", reference: `DPAY-${nanoid(8)}`, raw: { mock: true } };
  }
  // TODO: replace with a real DPay call once you have merchant credentials, e.g.:
  // const res = await fetch(`${process.env.DPAY_API_BASE}/charges`, {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${process.env.DPAY_API_KEY}` },
  //   body: JSON.stringify({ merchantId: process.env.DPAY_MERCHANT_ID, amount: order.totalCents, ... }),
  // });
  // return await res.json();
  return { status: "paid", reference: `DPAY-${nanoid(8)}`, raw: { mock: true } };
}
