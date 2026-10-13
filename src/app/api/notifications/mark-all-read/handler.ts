import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";

export type MarkAllReadDb = {
  notification: {
    updateMany: (args: { where: { merchantId: string; read: false }; data: { read: true } }) => Promise<{ count: number }>;
  };
};

// PATCH /api/notifications/mark-all-read — called when the bell's dropdown
// opens (see NotificationBell.tsx). Marks every unread notification for
// this merchant read in one call, not per-item.
export async function handleMarkAllRead(db: MarkAllReadDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  await db.notification.updateMany({ where: { merchantId, read: false }, data: { read: true } });
  return NextResponse.json({ ok: true });
}
