// Kâğıt üzerinde bot — hesap testleri (ağ yok)
import { paperSim, tradePct, paperCfg } from '../worker/src/paper.js';
let pass = 0, fail = 0; const ok = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
const R = (d, t, src, sym, px, o10, o15, rc, extra = {}) => ({ d, t, src, sym, dir: 'AL', px, done: 1, o10, o15, rc, meta: null, ...extra });
ok('hedef → +%1 eksi kayma', tradePct(R('x', 0, 'algi', 'A', 10, 1, 2, -3), 0.1).pct === 0.9);
ok('stop → −%1 eksi kayma', tradePct(R('x', 0, 'algi', 'A', 10, 2, 2, 3), 0.1).pct === -1.1);
ok('ikisi de yok → gün sonu kapanışı', tradePct(R('x', 0, 'firsat-B', 'A', 10, 0, 0, 0.6), 0.1).pct === 0.5);
ok('momentum ±%1,5 (o15)', tradePct(R('x', 0, 'momentum', 'A', 10, 2, 1, 0), 0.1).pct === 1.4);
const rows = [
  R('2026-10-01', 1, 'algi', 'AAA', 10, 1, 1, 2),          // +0.9% · 2000 lot → +180
  R('2026-10-01', 2, 'firsat-B', 'AAA', 10, 2, 2, -2),     // aynı hisse aynı gün → atlanır
  R('2026-10-01', 3, 'radar', 'BBB', 10, 2, 2, -5),        // radar seçili değil → atlanır
  R('2026-10-01', 4, 'firsat-B', 'CCC', 20, 2, 2, -5),     // −1.1% · 1000 lot → −220
  { ...R('2026-10-01', 5, 'firsat-B', 'DDD', 10, 1, 1, 1), dir: 'SAT' }, // SAT → atlanır
  R('2026-10-02', 6, 'algi', 'EEE', 10, 0, 0, 0.6, { meta: '{"fc":0.7}' }), // +0.5% → +100
  R('2026-10-02', 7, 'algi', 'FFF', 10, 1, 1, 0, { meta: '{"fc":0.9}' }),   // +0.9% → +180
  R('2026-10-02', 8, 'firsat-A', 'GGG', 10, 1, 1, 0),      // günlük sınır 2 → atlanır
  R('2026-10-03', 9, 'algi', 'HHH', 10, null, null, null, { done: 0 }) // bugün açık
];
let v = paperSim(rows, { amt: 20000, max: 2, start: '2026-09-29' }, '2026-10-03');
ok('işlem sayısı (atlamalar doğru)', v.tot.n === 4, JSON.stringify(v.trades.map(x => x.sym)));
ok('toplam kâr/zarar TL', v.tot.pl === 240, v.tot.pl);
ok('gün listesi yeniden eskiye', v.days[0].d === '2026-10-02' && v.days[0].pl === 280 && v.days[1].pl === -40);
ok('bugünkü açık işlem', v.open.length === 1 && v.open[0].sym === 'HHH' && v.open[0].lot === 2000);
ok('en kötü düşüş', v.tot.dd === -220, v.tot.dd);
ok('kaynak tablosu (radar ayrı görünür)', v.bySrc.radar && v.bySrc.radar.n === 1 && v.bySrc['firsat-B'].n === 2);
v = paperSim(rows, { amt: 20000, max: 5, algiG: true }, '2026-10-03');
ok('Algı yalnız güçlü: zayıf olan atlanır', !v.trades.some(x => x.sym === 'EEE') && v.trades.some(x => x.sym === 'FFF'));
const c = paperCfg({ amt: -5, max: 999, srcs: ['algi', 'kotu'], start: 'x' });
ok('ayar sınırları', c.amt === 1000 && c.max === 30 && c.srcs.join() === 'algi' && c.start === '2026-09-29');
console.log(`KÂĞIT BOT: ${pass}/${pass + fail} geçti`); process.exit(fail ? 1 : 0);
