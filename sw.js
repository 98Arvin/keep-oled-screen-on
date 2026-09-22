self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      } catch (_) {}

      try {
        await self.registration.unregister();
      } catch (_) {}

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      await Promise.all(
        clients.map(client => client.navigate(client.url).catch(() => {}))
      );
    })()
  );
});
