// BIST Pusula — servis çalışanı (uygulama modu)
// Sayfa: HER ZAMAN önce internetten (güncelleme hemen gelir); internet yoksa son kopya.
// Grafik kütüphaneleri: önbellekten (hızlı açılış). Veri istekleri ve canlı akış: HİÇ dokunulmaz.
const V = 'bist-v2';
const LIBS = [
  'https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(c => Promise.all(LIBS.map(u => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (LIBS.includes(r.url)) {
    e.respondWith(caches.match(r.url).then(hit => hit || fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r.url, cp)); }
      return res;
    })));
    return;
  }
  const isPage = r.mode === 'navigate' || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname));
  if (u.origin === location.origin && isPage) {
    e.respondWith(fetch(r, { cache: 'no-store' }).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put('page', cp)); }
      return res;
    }).catch(() => caches.match('page').then(hit => hit || new Response('<meta charset="utf-8"><body style="background:#06090e;color:#ccc;font:16px -apple-system;padding:40px">İnternet bağlantısı yok. Bağlanınca tekrar aç.</body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
  }
});
// v8.2 iPhone bildirimleri: sunucudan gelen bildirimi göster; dokununca ilgili sayfayı aç / öne getir.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'BIST Pusula', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'BIST Pusula', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: 'icon-192.png?v=2', badge: 'icon-192.png?v=2', data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { try { await c.focus(); c.postMessage({ type: 'nav', url }); return; } catch (x) {} }
    await self.clients.openWindow(url);
  })());
});
