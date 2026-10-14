// v8.2 TAVAN TAKİBİ (deneme) — her iş günü 18:12'den sonra tavan kapanan hisseler karneye yazılır (src 'tavan', px yok):
// giriş = ertesi işlem gününün açılışı, 'pre' = açılışın tavan kapanışına göre farkı (araştırma: %76 yukarı açılış, ort. +%1,8–2,1).
// Sinyal değil; karne bu bulgu canlıda tutuyor mu diye ölçer. Telegram + iPhone bildirimi (kategori 'tavan').
import { kapEntry } from './kap.js';
const TRMS = 3 * 3600e3;
export async function tavanScan(env, h) {
  const d = new Date(Date.now() + TRMS), wd = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes(), day = d.toISOString().slice(0, 10);
  if (wd < 1 || wd > 5 || m < 1092 || m > 1140) return null;
  const done = await env.BT.prepare("SELECT v FROM meta WHERE k = 'tavan_day'").first();
  if (done && done.v === day) return null;
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tavan_day', ?)").bind(day).run();
  const body = { filter: [{ left: 'change', operation: 'egreater', right: 9.4 }, { left: 'type', operation: 'equal', right: 'stock' }], columns: ['name', 'close', 'change', 'high', 'volume'], sort: { sortBy: 'change', sortOrder: 'desc' }, range: [0, 40] };
  const r = await h.scanRaw(env, JSON.stringify(body)); const j = await r.json();
  const L = (j.data || []).map(x => ({ s: String(x.s).split(':').pop(), c: x.d[1], ch: x.d[2], hi: x.d[3], v: x.d[4] }))
    .filter(x => x.c > 0 && x.hi > 0 && x.c >= x.hi * 0.999 && x.v * x.c >= 5e6);
  const t = kapEntry(Date.now()); // giriş = sonraki işlem günü 09:59 (KAP'taki gibi): ölçüm o gün açılıştan başlar
  for (const x of L.slice(0, 25)) await h.sigAdd(env, { src: 'tavan', sym: x.s, dir: 'AL', px: null, sc: Math.round(x.ch * 10) / 10, t, meta: { c: x.c, ch: x.ch } });
  if (L.length) {
    const cfg = await h.kvGet(env, 'cfg', null), names = L.slice(0, 25).map(x => x.s).join(', ');
    const msg = '🚀 <b>TAVAN KAPANANLAR (deneme)</b> · ' + L.length + ' hisse\n' + h.esc(names) +
      '\n<i>Geçmiş 13 ayda tavan kapananların %76\'sı ertesi gün yukarı açıldı (ortalama +%1,8). Yarın açılış farkı karnede ölçülecek.</i>';
    // v8.8: tavan listesi Telegram'a gitmez (karne mesajındaki tavan bloğu yeterli)
    try { await h.pushSend(env, { cat: 'tavan', title: '🚀 Tavan kapananlar · ' + L.length + ' hisse', body: names + ' — yarın açılış farkı ölçülecek (deneme)', url: './', tag: 'tavan' + day }, 3); } catch (e) {}
  }
  return { n: L.length };
}
// v10.8 (14.10, Fatih: 'karne raporunun başına kısa piyasa özeti') — 18:12'den sonra bir kez: endeksler + çok işlem görenlerde
// günün en çok yükselen/düşen 3'er hissesi + kaç hisse yükseldi/düştü → meta 'mkt_close'. Karne mesajı (sig.js sigSummary) en üstte kullanır.
// Yalnız bilinen tarama alanları (name, close, change, high, low, volume) — bilinmeyen alan taramayı bozar.
export async function mktClose(env, h) {
  const d = new Date(Date.now() + TRMS), wd = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes(), day = d.toISOString().slice(0, 10);
  if (wd < 1 || wd > 5 || m < 1092 || m > 1260) return null;
  const done = await env.BT.prepare("SELECT v FROM meta WHERE k = 'mkt_close'").first();
  try { if (done && JSON.parse(done.v).d === day) return null; } catch (e) {}
  const scan = async b => (await h.scanRaw(env, JSON.stringify(b))).json();
  const ix = await scan({ symbols: { tickers: ['BIST:XU100', 'BIST:XU030', 'BIST:XBANK'], query: { types: [] } }, columns: ['name', 'close', 'change', 'high', 'low'] });
  const idx = (ix.data || []).map(x => ({ s: String(x.s).split(':').pop(), c: x.d[1], ch: x.d[2], hi: x.d[3], lo: x.d[4] })).filter(x => x.c > 0);
  if (!idx.length) return null;   // veri yok → sonraki dakika yeniden
  const side = async (op, ord) => {
    const j = await scan({ filter: [{ left: 'type', operation: 'equal', right: 'stock' }, { left: 'change', operation: op, right: 0 }], columns: ['name', 'close', 'change', 'volume'], sort: { sortBy: 'change', sortOrder: ord }, range: [0, 60] });
    const L = (j.data || []).map(x => ({ s: String(x.s).split(':').pop(), c: x.d[1], ch: x.d[2], tl: (x.d[1] || 0) * (x.d[3] || 0) }))
      .filter(x => x.tl >= 100e6 && Math.abs(x.ch) < 9.4).slice(0, 3)   // 100 Mn TL üstü işlem; tavan/taban zaten karnede ayrı
      .map(x => ({ s: x.s, ch: Math.round(x.ch * 100) / 100 }));
    return { L, n: +j.totalCount || 0 };
  };
  const up = await side('greater', 'desc'), dn = await side('less', 'asc');
  const v = { d: day, idx, up: up.L, dn: dn.L, nu: up.n, nd: dn.n };
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('mkt_close', ?)").bind(JSON.stringify(v)).run();
  return v;
}
