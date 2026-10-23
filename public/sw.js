self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function readMessage(event) {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
}

function sameOrigin(path) {
  if (typeof path !== "string") return null;
  try {
    const url = new URL(path, self.location.origin);
    return url.origin === self.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const message = readMessage(event);
  const title =
    message && typeof message.title === "string" ? message.title : "Stride";
  const options = {
    body: message && typeof message.body === "string" ? message.body : "",
    tag: message && typeof message.tag === "string" ? message.tag : undefined,
    lang: "fr",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: sameOrigin(message && message.url) ?? sameOrigin("/today"),
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    sameOrigin(event.notification.data && event.notification.data.url) ??
    sameOrigin("/today");
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (open) {
        try {
          await open.focus();
          await open.navigate(target);
          return;
        } catch {
          await self.clients.openWindow(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
