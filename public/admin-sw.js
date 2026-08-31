const CACHE_VERSION = "ji-admin-static-v4";
const OFFLINE_PAGE = "/admin-offline.html";
const PRECACHE_URLS = [
  OFFLINE_PAGE,
  "/admin-manifest.webmanifest",
  "/pwa/admin-icon-192.png",
  "/pwa/admin-icon-512.png",
  "/pwa/admin-icon-maskable-512.png",
  "/pwa/admin-apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ji-admin-static-") && key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function staticAssetResponse(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isAdminNavigation =
    request.mode === "navigate" && url.pathname.startsWith("/admin");
  if (isAdminNavigation) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match(OFFLINE_PAGE)),
    );
    return;
  }

  const isSensitiveRequest =
    url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/admin/auth/")
    || url.searchParams.has("_rsc")
    || request.headers.has("RSC");
  if (isSensitiveRequest) return;

  const isSafeStaticAsset =
    url.pathname.startsWith("/_next/static/")
    || url.pathname.startsWith("/pwa/")
    || url.pathname === "/admin-manifest.webmanifest"
    || url.pathname === OFFLINE_PAGE;

  if (isSafeStaticAsset) {
    event.respondWith(staticAssetResponse(request));
  }
});

function safeAdminUrl(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "/admin", self.location.origin);
    if (url.origin !== self.location.origin || !url.pathname.startsWith("/admin")) return new URL("/admin", self.location.origin).href;
    return url.href;
  } catch {
    return new URL("/admin", self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "Abra o painel para conferir o novo alerta." };
  }
  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.slice(0, 100)
    : "Junior Imports";
  const body = typeof payload.body === "string" && payload.body.trim()
    ? payload.body.slice(0, 240)
    : "Há uma atualização importante no painel.";
  const notificationKey = typeof payload.notificationKey === "string" ? payload.notificationKey.slice(0, 240) : "admin-update";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: typeof payload.icon === "string" ? payload.icon : "/pwa/admin-icon-192.png",
    badge: typeof payload.badge === "string" ? payload.badge : "/pwa/admin-icon-192.png",
    tag: notificationKey,
    renotify: true,
    requireInteraction: payload.priority === "critical",
    data: {
      href: safeAdminUrl(payload.href),
      notificationKey,
      category: typeof payload.category === "string" ? payload.category : "system",
    },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = safeAdminUrl(event.notification.data?.href);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin && new URL(client.url).pathname.startsWith("/admin"));
    if (existing) {
      if ("navigate" in existing) await existing.navigate(destination);
      return existing.focus();
    }
    return self.clients.openWindow(destination);
  })());
});
