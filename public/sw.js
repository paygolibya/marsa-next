// Minimal push-delivery service worker — not a full offline-caching worker
// (no fetch handler, no asset precaching). Registered by
// src/components/dashboard/NotificationBell.tsx when a merchant enables
// browser notifications. Payload shape matches what
// src/lib/integrations/push.ts sends: { title, body, link? }.
self.addEventListener("push", (event) => {
  let data = { title: "رفقة", body: "" };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    // Non-JSON payload — fall back to the defaults above rather than crash.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "رفقة", {
      body: data.body || "",
      icon: "/icon-192.png",
      data: { link: data.link || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(link) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
