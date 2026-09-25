// BIST Terminal — servis çalışanı (uygulama modu)
// Sayfa: HER ZAMAN önce internetten (güncelleme hemen gelir); internet yoksa son kopya.
// Grafik kütüphaneleri: önbellekten (hızlı açılış). Veri istekleri ve canlı akış: HİÇ dokunulmaz.
const V = 'bist-v1';
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
