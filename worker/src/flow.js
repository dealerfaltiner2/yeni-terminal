// v9.4 (10.10) EMİR AKIŞI KAYDI — derinlik yerine geçen bilgi (yalnız araştırma; sinyal YOK).
// İş bilgisayarındaki motor canlı akışta her işlemin alıcılı mı satıcılı mı olduğunu dakika dakika toplar,
// 5 dakikada bir buraya yollar. Gövde ÇÖZÜLMEDEN olduğu gibi saklanır (10 ms işlemci sınırı).
// D1 tablo flow: d (gün), m (parçanın ilk dakikası, gün içi dakika), n (hisse sayısı), data (motorun JSON'u).
const MAXB = 900000;
export async function flowRoute(request, env, url, json) {
  if (!env.BT) return json({ ok: false, error: 'D1 yok' }, 500);
  if (request.method !== 'POST') return json({ ok: false, error: 'POST gerekir' }, 405);
  const d = String(url.searchParams.get('d') || '');
  const m = parseInt(url.searchParams.get('m'), 10), n = parseInt(url.searchParams.get('n'), 10) || 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !(m >= 540 && m < 1140)) return json({ ok: false, error: 'gün/dakika eksik' }, 400);
  const raw = await request.text();
  if (!raw || raw.length > MAXB || raw[0] !== '{') return json({ ok: false, error: 'boş ya da çok büyük' }, 413);
  const ins = () => env.BT.prepare('INSERT OR REPLACE INTO flow (d, m, n, data) VALUES (?, ?, ?, ?)').bind(d, m, n, raw).run();
  try { await ins(); }
  catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await env.BT.prepare('CREATE TABLE IF NOT EXISTS flow (d TEXT, m INTEGER, n INTEGER, data TEXT, PRIMARY KEY (d, m))').run();
    await ins();
  }
  return json({ ok: true });
}
