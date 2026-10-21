import { emaArr, emaAt, levelPath, emarCalc } from '../worker/src/emar.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };
// EMA: sabit seri → sabit
const e = emaArr(Array(250).fill(10), 200); ok('EMA sabit seride sabit', Math.abs(e[249] - 10) < 1e-9 && e[198] === null, e[249]);
// emaAt: bitmiş mum seçimi
const t0 = Date.parse('2026-10-20T07:00:00Z') / 1000, bars = Array.from({ length: 260 }, (_, i) => [t0 - (259 - i) * 1800, 1, 1, 1, i < 259 ? 100 : 200, 1]);
ok('emaAt son (bitmemiş) mumu almaz', Math.abs(emaAt(bars, 30, (t0 + 600) * 1000, 200) - 100) < 1e-6, emaAt(bars, 30, (t0 + 600) * 1000, 200));
// 5 dk yol: sinyal 10:30 İst (07:30Z), px 100, seviye 102
const s0 = Date.parse('2026-10-20T07:30:00Z') / 1000;
const mk = hs => hs.map((h, i) => [s0 + i * 300, 100, h[0], h[1], h[2], 1]);
let p = levelPath(mk([[100.5, 99.5, 100], [102.3, 100, 102.1], [103, 101, 101.5]]), s0 * 1000, 100, 102);
ok('seviyeye stoptan önce ulaştı, sonra ne kadar üstüne çıktı ve gün sonu', p.r === 1 && p.ext === 0.98 && p.back === -0.49, p);
p = levelPath(mk([[100.5, 98.9, 99], [103, 99, 102]]), s0 * 1000, 100, 102);
ok('önce −%1 stop', p.r === 2 && p.ext === null, p);
p = levelPath(mk([[101, 99.5, 100.5]]), s0 * 1000, 100, 102);
ok('ikisi de yok', p.r === 0, p);
// emarCalc: 7 seviye, altta kalan seviyenin yolu hesaplanmaz
const tb = { 30: bars, 60: bars.map(b => [b[0], 1, 1, 1, 103, 1]), 120: [], 240: bars.map(b => [b[0], 1, 1, 1, 90, 1]) };
const lv = emarCalc({ t: s0 * 1000, px: 100 }, mk([[103.2, 99.5, 103]]), tb);
const g = k => lv.find(x => x[0] === k);
ok('7 seviye üretir', lv.length === 7, lv.map(x => x[0]));
ok('üstteki seviye (60-200 = 103) için yol var, alttaki (240-200 = 90) için yok, mum yoksa boş', g('60-200')[2] === 3 && g('60-200')[3] === 1 && g('240-200')[3] === null && g('120-200')[1] === null, lv);
if (bad) { console.log('EMA araştırması: ' + bad + ' HATA'); process.exit(1); } else console.log('EMA araştırması: hepsi geçti');
