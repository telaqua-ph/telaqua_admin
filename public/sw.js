/* Tel-Aqua admin Web Push service worker — new-order alerts only. */
/* eslint-disable no-restricted-globals */

function sanitizeUrl(raw) {
  const url = String(raw || "").trim();
  if (url === "/orders") return "/orders";
  if (/^\/orders\/\d+$/.test(url)) return url;
  return null;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = { body: event.data ? event.data.text() : "" };
    } catch {
      data = {};
    }
  }

  const title = String(data.title || "New order received");
  const options = {
    body: String(data.body || "A new order was saved."),
    icon: String(data.icon || "/favicon.svg"),
    badge: String(data.badge || "/favicon.svg"),
    tag: String(data.tag || "telaqua-order"),
    renotify: true,
    data: {
      url: sanitizeUrl(data.url) || "/orders",
      orderId: data.orderId || null,
      test: Boolean(data.test),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = sanitizeUrl(event.notification?.data?.url) || "/orders";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(targetPath);
            } else {
              client.postMessage({ type: "telaqua-open-order", path: targetPath });
            }
            return;
          }
        } catch {
          // continue
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetPath);
      }
    })()
  );
});
