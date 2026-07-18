const CACHE_VERSION = "ji-admin-static-v3";
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
