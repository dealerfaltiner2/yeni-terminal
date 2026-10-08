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
// v8.4 bot yarışı
{ const T = h => Date.parse('2026-10-02T' + h + ':00+03:00');
  const rr = [
    { ...R('2026-10-02', T('10:30'), 'algi', 'A1', 10, 2, 2, -3), tx: -0.4, pbn: 1, pb: 1, meta: '{"fc":0.6}' },
    { ...R('2026-10-02', T('11:30'), 'firsat-B', 'B1', 10, 2, 2, -2), tx: -1, pbn: 0, pb: null },
    { ...R('2026-10-02', T('14:00'), 'firsat-B', 'C1', 10, 2, 2, -2), tx: -1, pbn: 1, pb: -1 },
    { ...R('2026-10-02', T('15:00'), 'firsat-B', 'D1', 10, 1, 1, 2), tx: 0.5, pbn: null, pb: null } ];
  const v = paperSim(rr, { amt: 10000, max: 5, slip: 0 }, '2026-10-02'), B = Object.fromEntries(v.bots.map(b => [b.k, b]));
  ok('yarış: 9 bot, en çok kazanan en üstte', v.bots.length === 9 && v.bots[0].pl >= v.bots[8].pl);
  ok('mevcut bot = ana bot', B.mevcut.pl === v.tot.pl && B.mevcut.n === 4, B.mevcut.pl + ' / ' + v.tot.pl);
  ok('güçlüler: zayıf Algı alınmaz', B.guclu.n === 3);
  ok('öğle arası: 11:30 sinyali alınmaz', B.saat.n === 3 && B.saat.pl === -100, B.saat.pl);
  ok('günlük fren: 2 stoptan sonra işlem yok', B.fren.n === 2 && B.fren.l === 2);
  ok('geri çekilme: gelmeyen atlanır, ölçülmeyen eksik sayılır', B.geri.n === 2 && B.geri.eksik === 1 && B.geri.pl === Math.round(1005 * 9.95 * 0.01) + Math.round(1005 * 9.95 * -0.01), B.geri.pl);
  { const v2 = paperSim([...rr, { ...R('2026-10-02', T('10:31'), 'sessiz', 'S1', 10, 2, 1, 0) }], { amt: 10000, max: 5, slip: 0 }, '2026-10-02'), S2 = v2.bots.find(b => b.k === 'sessiz'), M2 = v2.bots.find(b => b.k === 'mevcut');
    ok('sessiz trend botu: yalnız kendi sinyali, ±%1,5', S2.n === 1 && S2.pl === 150 && M2.n === 4, JSON.stringify(S2)); }
  { const extra = [R('2026-10-02', T('10:31'), 'dunguclu', 'G1', 10, 2, 2, 0), R('2026-10-02', T('10:32'), 'momentum', 'M1', 10, 2, 1, 0, { meta: '{"yc":0.85}' }), R('2026-10-02', T('10:32'), 'momentum', 'M2', 10, 2, 2, 0, { meta: { yc: 0.3 } })];
    const v3 = paperSim([...rr, ...extra], { amt: 10000, max: 5, slip: 0 }, '2026-10-02'), G = v3.bots.find(b => b.k === 'dunguclu'), MG = v3.bots.find(b => b.k === 'momgk'), M3 = v3.bots.find(b => b.k === 'mevcut');
    ok('dün güçlü kapanış botu: yalnız kendi sinyali, ±%1,5 stop', G.n === 1 && G.pl === -150, JSON.stringify(G));
    ok('Momentum + dün güçlü: yalnız yc≥0,7 olan Momentum', MG.n === 1 && MG.pl === 150, JSON.stringify(MG));
    ok('dün güçlü kapanış ana bota karışmıyor', M3 && !v3.trades.some(x => x.src === 'dunguclu')); }
  ok('çabuk çıkış: 60 dk sonucu kullanılır', B.cabuk.n === 4 && B.cabuk.pl === -40 - 100 - 100 + 50, B.cabuk.pl); }
console.log(`KÂĞIT BOT: ${pass}/${pass + fail} geçti`); process.exit(fail ? 1 : 0);
