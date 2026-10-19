/* Service worker de la Agenda Tangululu
   - Recibe las notificaciones push (llegan aunque la agenda esté cerrada).
   - Al tocar una notificación abre la agenda (o la trae al frente) y abre la tarea.
   - Guarda una copia de la página para abrirla sin conexión (siempre intenta la red primero). */
const CACHE = 'tangululu-v5';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* red primero; si no hay conexión, la última copia guardada */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok && (req.mode === 'navigate' || /\.(png|ico|json|svg|webmanifest)$/.test(url.pathname))) {
        const c = await caches.open(CACHE);
        c.put(req.mode === 'navigate' ? './' : req, res.clone());
      }
      return res;
    } catch (err) {
      const c = await caches.open(CACHE);
      return (await c.match(req.mode === 'navigate' ? './' : req)) || (await c.match(req)) || Response.error();
    }
  })());
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Agenda Tangululu', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Agenda Tangululu';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    requireInteraction: true,
    icon: './apple-touch-icon.png',
    badge: './favicon-32.png',
    lang: 'es',
    vibrate: [120, 60, 120],
    data: { taskId: d.taskId || null, view: d.view || null },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const taskId = data.taskId, view = data.view;
  const q = taskId ? `./?tarea=${encodeURIComponent(taskId)}` : view ? `./?vista=${encodeURIComponent(view)}` : './';
  const target = new URL(q, self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        if (taskId) w.postMessage({ type: 'open-task', id: taskId });
        else if (view) w.postMessage({ type: 'open-view', view });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

/* si el navegador renueva la suscripción, la agenda la vuelve a registrar al abrirse */
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((ws) => ws.forEach((w) => w.postMessage({ type: 'resubscribe' }))));
});
