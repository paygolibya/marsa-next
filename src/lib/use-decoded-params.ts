"use client";

import { useParams } from "next/navigation";
import { safeDecode } from "@/lib/safe-decode";

// Next.js's useParams() returns dynamic segments still percent-encoded
// for non-ASCII values — on a store whose slug is "ع" it returns
// "%D8%B9". That's harmless inside a URL, but every request that sends the
// slug in a JSON body (order creation, coupon validation, analytics,
// newsletter, inquiries) then looked the store up by the encoded string
// and got a 404 — confirmed live: no Arabic-named store (51 of 75) could
// take an order. Product ids and page slugs can be Arabic too. Storefront
// pages read their params through this instead.
export function useDecodedParams<T extends Record<string, string>>(): T {
  const raw = useParams<T>();
  const decoded: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    decoded[key] = typeof value === "string" ? safeDecode(value) : value;
  }
  return decoded as T;
}
