// v14.23 Gece Kuşu: seçim, mesajlar, akşam→sabah akışı, tatil, karne kaydı (D1 + tarama taklidi)
import { gecePick, geceBuyMsg, geceSellMsg, geceStep, geceRoute, geceNow } from '../worker/src/gece.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 1) seçim
const Q = [{ s: 'AAA', c: 10, ch: 1, v: 50e6 }, { s: 'DUS', c: 10, ch: -3.5, v: 90e6 }, { s: 'TAV', c: 10, ch: 9.9, v: 90e6 }, { s: 'AZ', c: 10, ch: 1, v: 1e6 },
  { s: 'TED', c: 10, ch: 0, v: 80e6 }, { s: 'BBB', c: 10, ch: -2.9, v: 70e6 }, { s: 'NUL', c: 10, ch: null, v: 70e6 }];
const P = gecePick(Q, new Set(['TED']));
ok('seçim: −%3 altı, tavan, az işlem, tedbirli, eksik veri elenir; en likit önce', P.map(x => x.s).join() === 'BBB,AAA', P);
ok('en çok 8', gecePick(Array.from({ length: 20 }, (_, i) => ({ s: 'S' + i, c: 10, ch: 0, v: 2e7 + i }))).length === 8);
const bm = geceBuyMsg(P, esc), sm = geceSellMsg([{ s: 'AAA', p0: 10, p1: 10.2, r: 2 }, { s: 'B<B', p0: 10, p1: 9.9, r: -1 }], 0.5, esc);
ok('mesajlar: kapanış seansı, 10:25–10:30, risk, tavsiye değil; kaçışlı', bm.includes('Kapanış seansında') && bm.includes('10:25–10:30') && bm.includes('stop konamaz') && bm.includes('tavsiyesi değildir') &&
  sm.includes('+%0,50') && sm.includes('B&lt;B') && sm.includes('1 artı · 1 eksi'));
// 2) akış
const meta = { idx_list: JSON.stringify({ x100: ['AAA', 'BBB', 'DUS'] }), tedbir: JSON.stringify({}) }, sigs = [];
const stmt = q => { const S = { a: [], bind(...a) { const n = stmt(q); n.a = a; return n; },
  async first() { if (/FROM meta/.test(q)) { const v = meta[S.a[0]]; return v != null ? { v } : null; } return null; },
  async run() { if (/INSERT OR REPLACE INTO meta/.test(q)) meta[S.a[0]] = S.a[1]; if (/INSERT INTO sig/.test(q)) sigs.push(S.a); return {}; } }; return S; };
const env = { BT: { prepare: stmt } };
let PX = { XU100: 11000, AAA: 10, BBB: 20, DUS: 5 }, CH = { AAA: 1, BBB: 0.5, DUS: -4, XU100: 0.2 };
const scanRaw = async (e, body) => { const b = JSON.parse(body); return { json: async () => ({ data: b.symbols.tickers.map(t => { const s = t.split(':')[1]; return { s: t, d: [s, PX[s], CH[s], 1e8] }; }) }) }; };
const sent = []; const h = { scanRaw, esc, kvGet: async () => ({ tgTok: 'x', chat: 'y', opt: {} }), tgSend: async (c, t) => { sent.push(t); return { ok: true }; } };
const at = (day, hh, mm) => Date.UTC(2026, 9, day, hh - 3, mm);   // TR saati
ok('pencere dışında hiçbir şey yapmaz', (await geceStep(env, h, at(30, 15, 0))) === null && !meta.gece);
let r = await geceStep(env, h, at(30, 17, 41));   // Cuma 17:41
ok('17:41 seçim + Telegram (düşen hisse yok)', r && r.sec === 2 && sent.length === 1 && /GECE KUŞU/.test(sent[0]) && !/DUS/.test(sent[0]), r);
ok('aynı gün ikinci kez seçmez', (await geceStep(env, h, at(30, 17, 50))) === null);
PX.AAA = 10.1; PX.BBB = 19.9; PX.XU100 = 11010;
r = await geceStep(env, h, at(30, 18, 13));
const G1 = JSON.parse(meta.gece);
ok('18:13 resmî kapanış giriş fiyatı olur', r && r.kapa === 2 && G1.st === 'alindi' && G1.list.find(x => x.s === 'AAA').p0 === 10.1 && G1.ix === 11010, G1);
// Pazartesi tatil gibi: endeks kıpırdamamış → bekler
r = await geceStep(env, h, at(33, 10, 26));   // 2 Kasım Pazartesi (Ekim'in 33. günü = 2 Kasım)
ok('endeks kıpırdamadıysa (tatil) satış beklenir', r && r.bekle && sigs.length === 0, r);
PX.XU100 = 11100; PX.AAA = 10.3; PX.BBB = 20.1;
r = await geceStep(env, h, at(33, 10, 27));
const G2 = JSON.parse(meta.gece);
ok('ertesi iş günü 10:27 satış: sonuç, Telegram, karne (done=1, o31=0, rc=sonuç)', r && r.sat === 2 && Math.abs(r.ort - 1.5) < 0.02 && G2.st === 'satildi' && G2.hist.length === 1 &&
  sigs.length === 2 && sigs[0][2] === 'gece' && sigs[0][0] === '2026-10-30' && /satış zamanı/.test(sent[sent.length - 1]), { r, G2, sigs });
ok('satıştan sonra yeniden satmaz', (await geceStep(env, h, at(33, 10, 30))) === null && sigs.length === 2);
// tatil akşamı: endeks son kapanışla aynı → seçim yok
PX.XU100 = 11010; meta.gece = JSON.stringify(Object.assign(JSON.parse(meta.gece), { st: 'satildi', ix: 11010, d: '2026-11-02' }));
r = await geceStep(env, h, at(34, 17, 45));
ok('tatil akşamı (endeks aynı) sepet gönderilmez', r && r.tatil === 1, r);
const json = (o, st) => ({ o, st: st || 200 });
ok('/gece: sahibe durum, üyeye boş', (await geceRoute(env, json, false)).o.g.st === 'satildi' && (await geceRoute(env, json, true)).o.g === null);
// 3) v14.24 deneme sepeti (kapanışla, tek seferlik)
PX = { XU100: 11100, AAA: 10, BBB: 20, DUS: 5 }; CH = { AAA: 1, BBB: 0.5, DUS: -4, XU100: 0.1 };
meta.gece = JSON.stringify({ d: '2026-10-30', st: 'satildi', hist: [{ ort: 1 }] }); sent.length = 0;
let dn = await geceNow(env, scanRaw, at(28, 23, 15));
let GD = JSON.parse(meta.gece);
ok('deneme sepeti: kapanışla alındı, Telegram yok, geçmiş korunur', /^tamam/.test(dn) && GD.st === 'alindi' && GD.deneme === 1 && GD.d === '2026-10-28' && GD.list.every(x => x.p0 === x.c) && GD.hist.length === 1 && !sent.length, dn);
ok('deneme: ikinci kez kurmaz', (await geceNow(env, scanRaw, at(28, 23, 20))) === 'zaten sepet var');
ok('29 Ekim tatil: satış yok', (await geceStep(env, h, at(29, 10, 26))) === null);
PX.AAA = 10.2; PX.BBB = 20; PX.XU100 = 11200;
r = await geceStep(env, h, at(30, 10, 26));
ok('Cuma 10:26 deneme satış mesajında not', r && r.sat === 2 && /Deneme sepeti: 28\.10/.test(sent[0]) && JSON.parse(meta.gece).deneme === 0, r);
if (bad) { console.log('GECE KUŞU: ' + bad + ' HATA'); process.exit(1); } else console.log('GECE KUŞU: hepsi geçti');
