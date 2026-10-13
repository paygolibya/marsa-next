import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

export type ListNotificationsDb = {
  notification: {
    findMany: (args: {
      where: { merchantId: string };
      orderBy: { createdAt: "desc" };
      take: 30;
    }) => Promise<NotificationRow[]>;
    count: (args: { where: { merchantId: string; read: false } }) => Promise<number>;
  };
};

// GET /api/notifications — the authenticated merchant's own recent
// notifications (newest 30) plus an unread count, for NotificationBell's
// badge + dropdown. No pagination beyond the last 30 — this is a glance
// surface, not an archive.
export async function handleListNotifications(db: ListNotificationsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({ where: { merchantId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { merchantId, read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
