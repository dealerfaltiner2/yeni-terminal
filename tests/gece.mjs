globalThis.__KAP_TG = true; globalThis.__GECE_TG = true; globalThis.__HABER_TG = true;   // v14.37: Telegram kapalı varsayılan; testler gönderim yolunu sınar
// v14.23 Gece Kuşu: seçim, mesajlar, akşam→sabah akışı, tatil, karne kaydı (D1 + tarama taklidi)
import { gecePick, geceBuyMsg, geceSellMsg, geceStep, geceRoute, geceNow, geceBuyPx, geceSellPx, geceFixMsg, gecePick2, tatilOncesi } from '../worker/src/gece.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 1) seçim
const Q = [{ s: 'AAA', c: 10, ch: 1, v: 50e6 }, { s: 'DUS', c: 10, ch: -3.5, v: 90e6 }, { s: 'TAV', c: 10, ch: 9.9, v: 90e6 }, { s: 'AZ', c: 10, ch: 1, v: 1e6 },
  { s: 'TED', c: 10, ch: 0, v: 80e6 }, { s: 'BBB', c: 10, ch: -2.9, v: 70e6 }, { s: 'NUL', c: 10, ch: null, v: 70e6 }];
const P = gecePick(Q, new Set(['TED']));
ok('seçim: −%3 altı, tavan, az işlem, tedbirli, eksik veri elenir; en likit önce', P.map(x => x.s).join() === 'BBB,AAA', P);
ok('en çok 8', gecePick(Array.from({ length: 20 }, (_, i) => ({ s: 'S' + i, c: 10, ch: 0, v: 2e7 + i }))).length === 8);
const bm = geceBuyMsg(P, esc), sm = geceSellMsg([{ s: 'AAA', p0: 10, p1: 10.2, r: 2 }, { s: 'B<B', p0: 10, p1: 9.9, r: -1 }], 0.5, esc);
ok('mesajlar: kapanış seansı, açılışta sat, risk, tavsiye değil; kaçışlı', bm.includes('Kapanış seansında') && bm.includes('açılış seansında') && bm.includes('AL <code>') && bm.includes('stop konamaz') && bm.includes('tavsiyesi değildir') &&
  sm.includes('+%0,50') && sm.includes('B&lt;B') && sm.includes('1 artı · 1 eksi'));
ok('emir fiyatları: fiyat adımına yuvarlı, alış %1 üstü (tavanı aşmaz), satış %2 altı', geceBuyPx(252.5, -0.2) === 255.25 && geceSellPx(252.5) === 247.4 && geceSellPx(34.48) === 33.78 && geceBuyPx(10, 9.4) === 10.05 && geceBuyPx(63, 0) === 63.65,
  [geceBuyPx(252.5, -0.2), geceSellPx(252.5), geceSellPx(34.48), geceBuyPx(10, 9.4), geceBuyPx(63, 0)]);
const fm = geceFixMsg([{ s: 'THYAO', c: 252.5, p0: 252.5 }, { s: 'A<B', c: 10, p0: 10 }], esc);
ok('satış emri mesajı: açılış seansı, SAT fiyatı, lot, kaçışlı', fm.includes('09:40–09:55') && fm.includes('SAT <code>247,40</code>') && fm.includes('49 lot') && fm.includes('A&lt;B'), fm);
// 1b) v2 seçim: sabahı güçlü, öğleden sonrası zayıf
{ const Q2 = [], P2 = {};
  for (let i = 0; i < 10; i++) { const s = 'V' + i; Q2.push({ s, c: 10, ch: 0, v: 2e7 }); P2[s] = 10 * (1 + (i - 5) / 100); }   // V9 sabah +4, öğle −3.8 → en iyi
  Q2.push({ s: 'VX', c: 10, ch: -4, v: 2e7 }); P2.VX = 12;
  const L = gecePick2(Q2, P2);
  ok('v2: skor sırası (sabah güçlü + öğleden sonra zayıf önce), eleme korunur, 8 hisse', L && L.length === 8 && L[0].s === 'V9' && L[7].s === 'V2' && !L.find(x => x.s === 'VX') && Math.abs(L[0].r30 - 4) < 0.01 && L[0].rest < -3, L);
  ok('v2: 10:30 fiyatı yetersizse null (eski kurala düşer)', gecePick2(Q2, { V1: 10 }) === null);
  ok('tatil öncesi: 28.10 evet, 27.10 hayır, 31.12 evet', tatilOncesi('2026-10-28') && !tatilOncesi('2026-10-27') && tatilOncesi('2026-12-31')); }
// 2) akış
const X = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH', 'III', 'DUS'];
const meta = { idx_list: JSON.stringify({ x100: X }), tedbir: JSON.stringify({}) }, sigs = [];
const stmt = q => { const S = { a: [], bind(...a) { const n = stmt(q); n.a = a; return n; },
  async first() { if (/FROM meta/.test(q)) { const v = meta[S.a[0]]; return v != null ? { v } : null; } return null; },
  async run() { if (/INSERT OR REPLACE INTO meta/.test(q)) meta[S.a[0]] = S.a[1]; if (/INSERT INTO sig/.test(q)) sigs.push(S.a); return {}; } }; return S; };
const env = { BT: { prepare: stmt } };
let PX = { XU100: 11000, DUS: 5 }, CH = { DUS: -4, XU100: 0.2 }, OP = {}, openFail = 0;
X.slice(0, 9).forEach((s, i) => { PX[s] = 10 + i; CH[s] = 0.5; });
const scanRaw = async (e, body) => { const b = JSON.parse(body); const wo = b.columns.includes('open'); if (wo && openFail) throw new Error('bilinmeyen alan');
  return { json: async () => ({ data: b.symbols.tickers.map(t => { const s = t.split(':')[1]; return { s: t, d: [s, PX[s], CH[s], 1e8].concat(wo ? [OP[s] ?? null] : []) }; }) }) }; };
const sent = []; const h = { scanRaw, esc, kvGet: async () => ({ tgTok: 'x', chat: 'y', opt: {} }), tgSend: async (c, t) => { sent.push(t); return { ok: true }; } };
const at = (day, hh, mm) => Date.UTC(2026, 9, day, hh - 3, mm);   // TR saati (Ekim'in 33. günü = 2 Kasım Pazartesi)
ok('pencere dışında hiçbir şey yapmaz', (await geceStep(env, h, at(33, 15, 0))) === null && !meta.gece);
// 10:31 kayıt: III sabah en güçlü (+%8 gibi) sonra düşecek
const P30 = {}; X.slice(0, 9).forEach((s, i) => { P30[s] = PX[s]; }); PX.III = 18 * 1.06; PX.AAA = 10 * 0.99;
let r = await geceStep(env, h, at(33, 10, 31));
ok('10:31 BIST 100 fiyat kaydı (günde bir)', r && r.k1030 === 10 && JSON.parse(meta.gece_1030).d === '2026-11-02' && (await geceStep(env, h, at(33, 10, 40))) === null, r);
PX.III = 18 * 1.06 * 0.97; CH.III = 2.82; PX.AAA = 10 * 0.99 * 1.03; CH.AAA = 1.97;
r = await geceStep(env, h, at(33, 17, 41));
let G0 = JSON.parse(meta.gece);
ok('17:41 v2 seçim + Telegram (sabah/öğleden sonra satırı, düşen yok)', r && r.sec === 8 && r.v === 2 && G0.v === 2 && G0.list[0].s === 'III' && G0.list[G0.list.length - 1].s !== 'III' && !G0.list.find(x => x.s === 'AAA') &&
  sent.length === 1 && /sabah \+%/.test(sent[0]) && !/DUS/.test(sent[0]) && /açılış seansında/.test(sent[0]), { r, l: G0.list.map(x => x.s) });
ok('aynı gün ikinci kez seçmez', (await geceStep(env, h, at(33, 17, 50))) === null);
PX.XU100 = 11010; const L0 = G0.list.map(x => x.s); L0.forEach(s => { PX[s] = PX[s] * 1.001; });
r = await geceStep(env, h, at(33, 18, 13));
const G1 = JSON.parse(meta.gece);
ok('18:13 resmî kapanış giriş fiyatı olur', r && r.kapa === 8 && G1.st === 'alindi' && G1.list[0].p0 === PX[G1.list[0].s] && G1.ix === 11010, G1);
r = await geceStep(env, h, at(34, 10, 5));
ok('endeks kıpırdamadıysa (tatil) satış beklenir', r && r.bekle && sigs.length === 0, r);
PX.XU100 = 11100; L0.forEach(s => { OP[s] = G1.list.find(x => x.s === s).p0 * 1.02; PX[s] = OP[s] * 0.99; });
ok('eski 10:25 penceresinde satmaz', (await geceStep(env, h, at(34, 10, 26))) === null);
r = await geceStep(env, h, at(34, 10, 6));
const G2 = JSON.parse(meta.gece);
ok('ertesi gün 10:06 satış AÇILIŞ fiyatıyla: +%2, Telegram, karne', r && r.sat === 8 && Math.abs(r.ort - 2) < 0.02 && G2.st === 'satildi' && G2.hist.length === 1 && G2.res.list.every(x => x.ac === 1) &&
  sigs.length === 8 && sigs[0][2] === 'gece' && sigs[0][0] === '2026-11-02' && /açılış fiyatıyla/.test(sent[sent.length - 1]), { r, G2 });
ok('satıştan sonra yeniden satmaz', (await geceStep(env, h, at(34, 10, 7))) === null && sigs.length === 8);
// Cuma ve tatil öncesi akşam sepet yok
ok('Cuma akşamı sepet kurulmaz', (await geceStep(env, h, at(37, 17, 45))) === null && JSON.parse(meta.gece).st === 'satildi');
meta.gece = JSON.stringify(Object.assign(JSON.parse(meta.gece), { d: '2026-10-27' }));
ok('tatil öncesi (28.10) akşam sepet kurulmaz', (await geceStep(env, h, at(28, 17, 45))) === null && JSON.parse(meta.gece).d === '2026-10-27');
// tatil akşamı: endeks son kapanışla aynı → seçim yok
PX.XU100 = 11010; meta.gece = JSON.stringify(Object.assign(JSON.parse(meta.gece), { st: 'satildi', ix: 11010, d: '2026-11-03' }));
r = await geceStep(env, h, at(35, 17, 45));
ok('tatil akşamı (endeks aynı) sepet gönderilmez', r && r.tatil === 1, r);
// 10:30 kaydı yoksa eski kural (en likit 8)
PX.XU100 = 11500; delete meta.gece_1030;
r = await geceStep(env, h, at(36, 17, 45));
ok('10:30 kaydı yoksa eski kural (v1)', r && r.v === 1 && JSON.parse(meta.gece).v === 1, r);
const json = (o, st) => ({ o, st: st || 200 });
ok('/gece: sahibe durum, üyeye boş', (await geceRoute(env, json, false)).o.g.st === 'secildi' && (await geceRoute(env, json, true)).o.g === null);
// 3) v14.24 deneme sepeti + açılış alanı gelmezse anlık fiyat
PX = { XU100: 11100, AAA: 10, BBB: 20, DUS: 5 }; CH = { AAA: 1, BBB: 0.5, DUS: -4, XU100: 0.1 }; meta.idx_list = JSON.stringify({ x100: ['AAA', 'BBB', 'DUS'] });
meta.gece = JSON.stringify({ d: '2026-10-30', st: 'satildi', hist: [{ ort: 1 }] }); sent.length = 0;
let dn = await geceNow(env, scanRaw, at(28, 23, 15));
let GD = JSON.parse(meta.gece);
ok('deneme sepeti: kapanışla alındı, Telegram yok, geçmiş korunur', /^tamam/.test(dn) && GD.st === 'alindi' && GD.deneme === 1 && GD.d === '2026-10-28' && GD.list.every(x => x.p0 === x.c) && GD.hist.length === 1 && !sent.length, dn);
ok('deneme: ikinci kez kurmaz', (await geceNow(env, scanRaw, at(28, 23, 20))) === 'zaten sepet var');
ok('29 Ekim tatil: satış yok', (await geceStep(env, h, at(29, 10, 6))) === null);
PX.AAA = 10.2; PX.BBB = 20; PX.XU100 = 11200; openFail = 1;
r = await geceStep(env, h, at(30, 10, 6));
ok('açılış alanı hata verirse anlık fiyatla satar; deneme notu', r && r.sat === 2 && /Deneme sepeti: 28\.10/.test(sent[0]) && JSON.parse(meta.gece).deneme === 0 && JSON.parse(meta.gece).res.list.every(x => x.ac === 0), r);
if (bad) { console.log('GECE KUŞU: ' + bad + ' HATA'); process.exit(1); } else console.log('GECE KUŞU: hepsi geçti');
