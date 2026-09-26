// Tangululu — service worker
// Sube este número cada vez que publiques cambios importantes en index.html
// para forzar a los teléfonos a refrescar la versión guardada.
const CACHE_VERSION = 'tangululu-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Instala: guarda una copia mínima de la app para que abra aunque no haya internet.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activa: borra versiones viejas de la caché.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: la app depende de Supabase en tiempo real, así que SIEMPRE se
// prefiere la red primero (datos frescos). Solo si no hay internet, se
// usa lo guardado en caché para que la app al menos abra.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // No interceptar llamadas a Supabase ni a otros orígenes (API, websockets, CDN de librerías).
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
