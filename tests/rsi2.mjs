// v15.19 RSI2 Dönüş (deneme): RSI hesabı, seçim/çıkış kararı, sabah geçmiş → akşam seçim → kapanış → ertesi gün çıkış, tatil, karne kaydı
import { rsiW, rsi2Calc, rsi2Pick, rsi2Step, rsi2Route, rsi2SelMsg, rsi2FixMsg, rsi2BuyPx, rsi2SellPx, RSI2 } from '../worker/src/rsi2.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 1) RSI (Wilder, TradingView ta.rsi)
ok('RSI: hep artış 100, hep düşüş 0, düz 50', rsiW([1, 2, 3, 4]) === 100 && rsiW([4, 3, 2, 1]) === 0 && rsiW([5, 5, 5]) === 50);
{ const r = rsiW([10, 11, 10.5, 10]);   // ilk ort g=0,5 l=0,25 → g=0,25 l=0,375 → 40
  ok('RSI: Wilder ortalaması', Math.abs(r - 40) < 1e-9, r); }
// 2) karar
const up = Array.from({ length: 230 }, (_, i) => 100 + i * 0.5);           // 100 → 214,5 yükselen
const dip = up.slice(0, 227).concat([214, 208, 202]);                          // son 3 gün düşüş
ok('hesap: yükselen trendde 3 günlük düşüş → AL (RSI<10, 200 gün ortalama üstü)', (() => { const k = rsi2Calc(dip, 198); return k && k.al && k.r < 10 && k.s200 < 198; })(), rsi2Calc(dip, 198));
ok('hesap: yükseliş günü AL değil; 5 günlük ortalama üstü = çıkış', !rsi2Calc(dip, 215).al && rsi2Calc(dip, 215).cik);
ok('hesap: geçmiş yetersizse boş', rsi2Calc(up.slice(0, 150), 100) === null);
{ const H = { A: dip, B: dip, C: dip, D: dip, E: dip, F: dip, P1: dip, P2: dip }, Q = {};
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach((s, i) => { Q[s] = { c: 198 + i * 0.5, ch: -2 }; });
  Q.P1 = { c: 215, ch: 6 }; Q.P2 = { c: 197, ch: -2.5 };
  const pos = [{ s: 'P1', d: '2026-11-02', p0: 200, n: 2 }, { s: 'P2', d: '2026-11-01', p0: 210, n: 9 }];
  const P = rsi2Pick(pos, Q, H, new Set(['B']));
  ok('karar: 5 günlük ortalama üstü SAT, 10. gün SAT, tedbirli alınmaz, en düşük RSI önce, en çok 5 pozisyon', P.sat.map(x => x.s + ':' + x.why).join() === 'P1:ort,P2:sure' && P.kal.length === 0 &&
    P.al.length === 5 && !P.al.find(x => x.s === 'B') && P.al[0].s === 'A' && P.al.every((x, i) => i === 0 || x.r >= P.al[i - 1].r), P);
  const P3 = rsi2Pick([1, 2, 3, 4].map(i => ({ s: 'K' + i, p0: 1, n: 1 })).concat([{ s: 'A', p0: 1, n: 1 }]), Object.assign({}, Q, { K1: { c: 1, ch: 0 }, K2: { c: 1, ch: 0 }, K3: { c: 1, ch: 0 }, K4: { c: 1, ch: 0 } }), Object.assign({ K1: up, K2: up, K3: up, K4: up }, H));
  ok('karar: 5 pozisyon doluysa yeni AL yok, gün sayısı artar', P3.al.length === 0 && P3.kal.length === 5 && P3.kal[0].n === 2, P3); }
ok('emir fiyatı: alış %1 üstü, satış %1 altı (fiyat adımına)', rsi2BuyPx(198, -2) === 200 && rsi2SellPx(198, -2) === 196 && rsi2SellPx(10, -9.4) >= 9.07, [rsi2BuyPx(198, -2), rsi2SellPx(198, -2), rsi2SellPx(10, -9.4)]);
{ const m = rsi2SelMsg({ sat: [{ s: 'P<1', c: 215, ch: 6, why: 'ort' }], al: [{ s: 'A', c: 198, ch: -2, r: 3.2, s200: 157 }] }, [{ s: 'P<1', p0: 200 }], esc);
  ok('mesaj: AL/SAT, kapanış seansı, lot, deneme, tavsiye değil, kaçışlı', m.includes('SAT <code>') && m.includes('AL <code>') && m.includes('18:00–18:05') && m.includes('101 lot') && m.includes('deneme') && m.includes('tavsiyesi değildir') && m.includes('P&lt;1') && m.includes('+%7,50'), m);
  const f = rsi2FixMsg([{ s: 'A', p0: 198 }], [{ s: 'P1', p0: 200, p1: 210, r: 5, n: 3 }], esc);
  ok('kapanış mesajı: sonuç ve yeni alış', f.includes('+%5,00') && f.includes('3 gün') && f.includes('alış 198,00'), f); }
// 3) akış (D1 + tarama + mum taklidi)
const X = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const meta = { idx_list: JSON.stringify({ x30: X }), tedbir: JSON.stringify({}) }, sigs = [];
const stmt = q => { const S = { a: [], bind(...a) { const n = stmt(q); n.a = a; return n; },
  async first() { if (/FROM meta/.test(q)) { const v = meta[S.a[0]]; return v != null ? { v } : null; } return null; },
  async run() { if (/INSERT OR REPLACE INTO meta/.test(q)) meta[S.a[0]] = S.a[1]; if (/INSERT INTO sig/.test(q)) sigs.push(S.a); return {}; } }; return S; };
const env = { BT: { prepare: stmt } };
const at = (day, hh, mm) => Date.UTC(2026, 9, day, hh - 3, mm);   // TR saati (Ekim'in 33. günü = 2 Kasım Pazartesi)
let SER = {}; X.forEach(s => { SER[s] = s === 'A' ? dip : s === 'G' ? up.slice(0, 120) : up; });
let calls = 0, D0 = Date.UTC(2026, 10, 2, 7, 0) / 1000;   // bugünün mumunun zamanı (TradingView günlük mum: seans günü)
const fetchBarsTV = async (e, list, tf, n) => { calls++; const out = {}; const day0 = D0;
  list.forEach(k => { const s = k.split(':')[1], c = SER[s], m = new Map(); c.forEach((v, i) => { const t = day0 - (c.length - i) * 86400; m.set(t, [t, v, v, v, v, 1e6]); });
    m.set(day0, [day0, 999, 999, 999, 999, 1]); out[k] = { m }; });   // bugünün mumu (açılış seansı) — alınmamalı
  return out; };
let PX = { XU100: 11000, A: 198, B: 215, C: 215, D: 215, E: 215, F: 215, G: 100 }, CH = { XU100: 0.2, A: -2, B: 0.3, C: 0.3, D: 0.3, E: 0.3, F: 0.3, G: 0 };
const scanRaw = async (e, body) => { const b = JSON.parse(body); return { json: async () => ({ data: b.symbols.tickers.map(t => { const s = t.split(':')[1]; return { s: t, d: [s, PX[s], CH[s], 1e8] }; }) }) }; };
const sent = []; const h = { scanRaw, esc, fetchBarsTV, kvGet: async () => ({ tgTok: 'x', chat: 'y', opt: {} }), tgSend: async (c, t) => { sent.push(t); return { ok: true }; } };
ok('pencere dışında hiçbir şey yapmaz', (await rsi2Step(env, h, at(33, 15, 0))) === null && !meta.rsi2 && !meta.rsi2_h);
let r = await rsi2Step(env, h, at(33, 7, 1));
ok('07:01 geçmiş: 5 hisse (bugünün mumu hariç)', r && r.gecmis === 5 && r.ok === 0 && JSON.parse(meta.rsi2_h).s.A.length === RSI2.hist && JSON.parse(meta.rsi2_h).s.A.slice(-1)[0] === 202, r);
r = await rsi2Step(env, h, at(33, 7, 2));
const HH = JSON.parse(meta.rsi2_h);
ok('07:02 geçmiş tamam; yetersiz geçmiş (G) boş', r && r.ok === 1 && HH.s.G.length === 0 && calls === 2, r);
ok('geçmiş tamamsa yeniden çekmez', (await rsi2Step(env, h, at(33, 8, 0))) === null && calls === 2);
r = await rsi2Step(env, h, at(33, 17, 41));
let G0 = JSON.parse(meta.rsi2);
ok('17:41 seçim: A alınır, Telegram', r && r.al === 1 && r.sat === 0 && G0.st === 'secildi' && G0.plan.al[0].s === 'A' && sent.length === 1 && sent[0].includes('AL <code>'), { r, G0 });
ok('aynı gün ikinci kez seçmez', (await rsi2Step(env, h, at(33, 17, 50))) === null);
PX.A = 197.5;
r = await rsi2Step(env, h, at(33, 18, 13));
let G1 = JSON.parse(meta.rsi2);
ok('18:13 resmî kapanış = giriş, pozisyon açık', r && r.gir === 1 && G1.st === 'kapandi' && G1.pos.length === 1 && G1.pos[0].p0 === 197.5 && G1.pos[0].d === '2026-11-02' && sent.length === 2, G1);
ok('kapanış adımı tekrar çalışmaz', (await rsi2Step(env, h, at(33, 18, 20))) === null);
// ertesi gün: geçmiş yeniden (dünkü kapanış eklendi), fiyat 5 günlük ortalamanın üstüne çıktı → SAT
SER.A = dip.slice(1).concat([197.5]); calls = 0; D0 += 86400;
await rsi2Step(env, h, at(34, 7, 1)); await rsi2Step(env, h, at(34, 7, 2));
ok('ertesi sabah geçmiş yenilenir', JSON.parse(meta.rsi2_h).d === '2026-11-03' && JSON.parse(meta.rsi2_h).ok === 1 && calls === 2);
PX.A = 207; CH.A = 4.8; PX.XU100 = 11100;
r = await rsi2Step(env, h, at(34, 17, 42));
ok('17:42 SAT: kapanış 5 günlük ortalama üstünde', r && r.sat === 1 && JSON.parse(meta.rsi2).plan.sat[0].why === 'ort' && sent[sent.length - 1].includes('SAT <code>'), r);
PX.A = 208;
r = await rsi2Step(env, h, at(34, 18, 13));
const G2 = JSON.parse(meta.rsi2);
ok('18:13 çıkış: karne kaydı (alış günü, sonuç %), pozisyon kapandı, geçmişe yazıldı', r && r.cik === 1 && G2.pos.length === 0 && G2.hist.length === 1 && Math.abs(G2.hist[0].r - 5.32) < 0.01 &&
  sigs.length === 1 && sigs[0][2] === 'rsi2' && sigs[0][0] === '2026-11-02' && sigs[0][5] === 197.5 && Math.abs(sigs[0][9] - 5.32) < 0.01 && /5,32/.test(sent[sent.length - 1]), { r, G2, s: sigs[0] });
// tatil: endeks aynı → işlem yok
SER.A = dip; D0 += 86400; await rsi2Step(env, h, at(35, 7, 1)); await rsi2Step(env, h, at(35, 7, 2));
const n0 = sent.length;
r = await rsi2Step(env, h, at(35, 17, 45));
ok('tatil (endeks önceki seçimle aynı): seçim yok, mesaj yok', r && r.tatil === 1 && sent.length === n0, r);
// sabit tatil ve hafta sonu
ok('29 Ekim ve Cumartesi çalışmaz', (await rsi2Step(env, h, at(29, 17, 45))) === null && (await rsi2Step(env, h, at(31, 17, 45))) === null);
// geçmiş alınamadıysa seçim bekler
delete meta.rsi2_h; PX.XU100 = 11300;
r = await rsi2Step(env, h, at(36, 17, 45));
ok('geçmiş yoksa seçim beklenir', r && r.bekle, r);
// Telegram kapalı ayarı
meta.rsi2_h = JSON.stringify({ d: '2026-11-05', ok: 1, s: { A: dip } }); PX.A = 198; CH.A = -2; meta.rsi2 = JSON.stringify({ d: '2026-11-04', pos: [], hist: [], ix: 1 }); const n1 = sent.length;
r = await rsi2Step(env, Object.assign({}, h, { kvGet: async () => ({ tgTok: 'x', chat: 'y', opt: { rsi2: 0 } }) }), at(36, 17, 45));
ok('cfg.opt.rsi2 = 0 → Telegram yok, kayıt var', r && r.al === 1 && !r.tg && sent.length === n1, r);
const json = (o, st) => ({ o, st: st || 200 });
ok('/rsi2: sahibe durum, üyeye boş', (await rsi2Route(env, json, false)).o.g.st === 'secildi' && (await rsi2Route(env, json, true)).o.g === null);
if (bad) { console.log('RSI2: ' + bad + ' HATA'); process.exit(1); } else console.log('RSI2: hepsi geçti');
