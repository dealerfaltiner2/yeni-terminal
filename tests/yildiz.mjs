// v14.39 ⭐ yıldız ayarları: sınırlar ve kayıt
import { starCfg, yildizRoute, STAR_DEF } from '../worker/src/yildiz.js';
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
ok(JSON.stringify(starCfg(null)) === JSON.stringify(STAR_DEF), 'varsayılan ±%0,5 · 16/21 · 60 dk · günde 10');
const c = starCfg({ band: 1, min: 25, wait: 1, max: 99 }); ok(c.band === 1 && c.min === 21 && c.wait === 5 && c.max === 30, 'sınırlar uygulanıyor');
ok(starCfg({ band: '0.7' }).band === 0.7 && starCfg({ band: 'x' }).band === 0.5, 'band 0,7 kabul, bozuk değer varsayılana döner');
const M = {}; const env = { BT: { prepare: q => ({ bind: (...a) => ({ run: async () => { M.v = a[0]; }, first: async () => null }), first: async () => (M.v ? { v: M.v } : null) }) } };
const json = (o, st) => ({ o, st: st || 200 });
const r = await yildizRoute('yildiz-set', { method: 'POST', text: async () => JSON.stringify({ band: 1 }) }, env, json);
ok(r.o.ok && r.o.cfg.band === 1, 'kaydet: band %1');
const g = await yildizRoute('yildiz', { method: 'GET' }, env, json);
ok(g.o.cfg.band === 1 && g.o.cfg.min === 16, 'okuma: kaydedilen değer geri geliyor, diğerleri aynı');
process.exit(fail ? 1 : 0);
