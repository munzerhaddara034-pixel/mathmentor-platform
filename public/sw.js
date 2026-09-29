/* MathMentor SW v4 — safe pass-through. Old v2/v3 could reject FetchEvent with undefined Response (blank page). */
const CACHE = "mathmentor-shell-v4";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Do not call event.respondWith — let the browser handle all requests.
// This avoids "Failed to convert value to 'Response'" blank-page failures.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") void self.skipWaiting();
});
