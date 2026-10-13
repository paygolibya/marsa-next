import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (publicKey && privateKey && subject) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

// Sends a real browser push to every device the merchant has enabled
// notifications on (src/components/dashboard/NotificationBell.tsx), via
// src/lib/notifications/notify.ts — the one caller. Mock-logs instead of
// sending when VAPID keys aren't configured, same convention as every
// other integration in this directory (email.ts, sms.ts). A subscription
// whose send comes back 404/410 (browser revoked it, or the device hasn't
// used this origin in a long time) is deleted — there's no reason to keep
// retrying a dead endpoint on every future notification.
export async function sendPushToMerchant(merchantId: string, payload: { title: string; body: string; link?: string | null }): Promise<void> {
  if (!publicKey || !privateKey || !subject) {
    console.log(`[push mock] merchant=${merchantId} title="${payload.title}"`);
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { merchantId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      } catch (error) {
        const statusCode = error && typeof error === "object" && "statusCode" in error ? (error as { statusCode: number }).statusCode : null;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`sendPushToMerchant: failed for subscription ${sub.id}:`, error);
        }
      }
    })
  );
}
