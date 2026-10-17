"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type Notification } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { useEscapeKey } from "@/lib/use-escape-key";

const POLL_MS = 30000;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Push subscription endpoints are base64url; PushManager.subscribe wants
// its applicationServerKey as a raw Uint8Array — this is the standard
// conversion (no library needed for one function).
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} س`;
  return `قبل ${Math.floor(hours / 24)} ي`;
}

// Bell icon + unread badge, mounted in both dashboard header spots
// (sidebar header and the mobile top bar, src/app/dashboard/layout.tsx) —
// same className-driven styling pattern ThemeToggle already uses so it
// adapts to either placement. Polls GET /api/notifications every 30s (the
// first interval-based polling in this codebase — kept simple on purpose,
// see the project plan's own reasoning: no WebSockets/SSE for "a merchant
// glances at their dashboard").
export default function NotificationBell({ className = "" }: { className?: string }) {
  const { token, merchant, refreshMerchant } = useAuth();
  const [open, setOpen] = useState(false);
  useEscapeKey(open, () => setOpen(false));
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const pushSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && Boolean(VAPID_PUBLIC_KEY);

  useEffect(() => {
    if (!pushSupported) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(async (registration) => {
      const sub = await registration?.pushManager.getSubscription();
      setPushSubscribed(Boolean(sub));
    });
    // pushSupported is derived from constants that never change within a
    // mount — safe to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEnablePush() {
    if (!token || !VAPID_PUBLIC_KEY) return;
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.subscribePush(token, { endpoint: json.endpoint, keys: json.keys });
      setPushSubscribed(true);
    } catch (error) {
      console.error("Failed to enable push notifications:", error);
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    if (!token) return;
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(token, sub.endpoint);
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      const { notifications, unreadCount } = await api.listNotifications(token!);
      if (!cancelled) {
        setNotifications(notifications);
        setUnreadCount(unreadCount);
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  async function handleOpen() {
    setOpen(true);
    if (unreadCount > 0 && token) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      await api.markAllNotificationsRead(token);
    }
  }

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !emailDraft.trim()) return;
    setSavingEmail(true);
    try {
      await api.updateMerchantProfile(token, { email: emailDraft.trim() });
      await refreshMerchant();
    } finally {
      setSavingEmail(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label={unreadCount > 0 ? `الإشعارات — ${unreadCount} غير مقروءة` : "الإشعارات"}
        aria-expanded={open}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full ${className}`}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 left-1 h-4 min-w-4 px-1 rounded-full bg-signal text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-harbor" aria-hidden>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            dir="rtl"
            className="absolute left-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl border border-harbor/10 bg-white shadow-2xl z-50 overflow-hidden text-right"
          >
            <div className="px-4 py-3 border-b border-harbor/10 flex items-center justify-between">
              <span className="font-bold text-harbor text-sm">الإشعارات</span>
              {pushSupported && (
                <button
                  type="button"
                  onClick={() => (pushSubscribed ? handleDisablePush() : handleEnablePush())}
                  disabled={pushBusy}
                  className="text-xs font-bold text-signal hover:underline disabled:opacity-50"
                >
                  {pushSubscribed ? "إيقاف إشعارات المتصفح" : "فعّل إشعارات المتصفح"}
                </button>
              )}
            </div>

            {!merchant?.email && (
              <form onSubmit={handleSaveEmail} className="px-4 py-3 border-b border-harbor/10 bg-canvas/50 flex gap-2">
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="بريدك الإلكتروني للتنبيهات"
                  className="input !py-1.5 text-xs flex-1"
                />
                <button
                  type="submit"
                  disabled={savingEmail || !emailDraft.trim()}
                  className="rounded-lg bg-harbor px-3 py-1.5 text-xs font-bold text-canvas disabled:opacity-50 hover:bg-harbor-deep transition-colors"
                >
                  حفظ
                </button>
              </form>
            )}

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-rope">لا توجد إشعارات بعد</p>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 border-b border-harbor/5 hover:bg-canvas/50 transition-colors ${!n.read ? "bg-signal/5" : ""}`}
                  >
                    <p className="font-bold text-sm text-harbor">{n.title}</p>
                    <p className="text-xs text-rope mt-0.5">{n.body}</p>
                    <p className="text-[11px] text-rope/70 mt-1">{timeAgo(n.createdAt)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
