// v15.19 (18.11 gece, Fatih: 'en sonki sistemi kur, sinyal gelsin, denemek istiyorum') RSI2 DÖNÜŞ — DENEME (Connors RSI(2), günlük, BIST 30)
// Kural: kapanış 200 günlük ortalamanın ÜSTÜNDE ve RSI(2) < 10 → kapanışta AL. Kapanış 5 günlük ortalamanın ÜSTÜNE çıkınca ya da 10 iş günü dolunca → kapanışta SAT.
// Aynı anda en çok 5 hisse (RSI'ı en düşük olan önce). Mevcut sinyallerden AYRI: kendi meta'sı, karnede src 'rsi2'.
// Araştırma (18.11, DEVIR 7c): BIST 30, 2017–2026, ~13.000 işlem: işlem başı +0,30 (maliyet −0,1 dahil) — AMA aynı hisselerde 200 günlük ortalama üstünde
// rastgele alıp 3 gün tutmak +0,32. Yani kenar görünmüyor; Fatih yine de canlı denemek istedi. Mesajlarda 'deneme' yazar.
// Akış (ana iş, dakikada bir; pencere dışında meta okuması yok — saat kontrolü önce):
//   hafta içi 07:00–09:30  rsi2Hist : BIST 30 (meta idx_list.x30) günlük kapanışları (dünkü dahil, 230 gün) → meta 'rsi2_h' {d, s:{SYM:[kapanış…]}}; çalışmada 5 hisse
//   17:40–17:55            seçim    : anlık fiyat = bugünün kapanışı sayılır → SAT (açık pozisyonlar) + AL listesi → meta 'rsi2' st 'secildi' + Telegram
//   18:12–18:40            kapanış  : resmî kapanış fiyatıyla giriş/çıkış kaydı → biten işlemler karneye (sig src 'rsi2', done=1, o31=0, rc = sonuç %, d = alış günü) + Telegram özet
// Tatil: XU100 kapanışı önceki seçimdekiyle aynıysa o gün işlem yok. cfg.opt.rsi2 === 0 → Telegram kapalı (kayıt yine yapılır).
import { TATIL_MD, tickOf } from './gece.js';
const TRMS = 3 * 3600e3;
export const RSI2 = { esik: 10, trend: 200, cikis: 5, gun: 10, max: 5, hist: 230, tl: 100000 };
const trT = ms => { const d = new Date(ms + TRMS); return { wd: d.getUTCDay(), m: d.getUTCHours() * 60 + d.getUTCMinutes(), day: d.toISOString().slice(0, 10) }; };
const f2 = v => Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pc = v => (v >= 0 ? '+' : '−') + '%' + f2(Math.abs(v));
const metaGet = async (env, k) => { try { const r = await env.BT.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; } catch (e) { return null; } };
const metaSet = (env, k, v) => env.BT.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind(k, JSON.stringify(v)).run();
export function rsi2TgOn(cfg) { return !(cfg && cfg.opt && cfg.opt.rsi2 === 0); }

// Wilder RSI (TradingView ta.rsi ile aynı: ilk ortalama basit, sonra 1/n üstel)
export function rsiW(c, n = 2) {
  if (!c || c.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0); }
  g /= n; l /= n;
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  if (l === 0) return g === 0 ? 50 : 100;
  return 100 - 100 / (1 + g / l);
}
const sma = (c, n) => c.length >= n ? c.slice(-n).reduce((a, x) => a + x, 0) / n : null;
// Saf hesap: H = geçmiş kapanışlar (dün dahil), p = bugünkü fiyat
export function rsi2Calc(H, p) {
  if (!H || !(p > 0)) return null;
  const c = H.concat([p]);
  const s200 = sma(c, RSI2.trend), s5 = sma(c, RSI2.cikis), r = rsiW(c.slice(-60), 2);
  if (s200 == null || s5 == null || r == null) return null;
  return { r: Math.round(r * 10) / 10, s200: Math.round(s200 * 100) / 100, s5: Math.round(s5 * 100) / 100, al: p > s200 && r < RSI2.esik, cik: p > s5 };
}
// Saf karar: pos = açık pozisyonlar [{s,d,p0,n}], Q = {SYM:{c,ch}}, H = {SYM:[kapanışlar]}, bad = tedbirli
export function rsi2Pick(pos, Q, H, bad = new Set()) {
  const sat = [], kal = [];
  for (const x of pos || []) {
    const q = Q[x.s], k = q && H[x.s] ? rsi2Calc(H[x.s], q.c) : null, n = (x.n || 0) + 1;
    if (q && k && k.cik) sat.push({ s: x.s, c: q.c, why: 'ort', n });
    else if (q && n >= RSI2.gun) sat.push({ s: x.s, c: q.c, why: 'sure', n });
    else kal.push(Object.assign({}, x, { n }));
  }
  const tut = new Set((pos || []).map(x => x.s)), yer = RSI2.max - kal.length;
  const al = yer <= 0 ? [] : Object.keys(Q).filter(s => !tut.has(s) && !bad.has(s) && H[s] && Q[s].c > 0 && Q[s].ch != null && Q[s].ch > -9.5 && Q[s].ch < 9.5)
    .map(s => Object.assign({ s, c: Q[s].c, ch: Q[s].ch }, rsi2Calc(H[s], Q[s].c))).filter(x => x.al)
    .sort((a, b) => a.r - b.r).slice(0, yer).map(x => ({ s: x.s, c: x.c, ch: x.ch, r: x.r, s200: x.s200 }));
  return { sat, kal, al };
}
const rnd = (v, t, up) => { const k = v / t; return Math.round((up ? Math.ceil(k - 1e-9) : Math.floor(k + 1e-9)) * t * 100) / 100; };
export function rsi2BuyPx(c, ch) { let v = rnd(c * 1.01, tickOf(c * 1.01), true); if (ch != null && isFinite(ch)) { const tav = c / (1 + ch / 100) * 1.1; if (v > tav) v = rnd(tav, tickOf(tav), false); } return v; }
export function rsi2SellPx(c, ch) { let v = rnd(c * 0.99, tickOf(c * 0.99), false); if (ch != null && isFinite(ch)) { const tab = c / (1 + ch / 100) * 0.9; if (v < tab) v = rnd(tab, tickOf(tab), true); } return v; }
const lot = p => Math.floor(RSI2.tl / RSI2.max / p);
const WHY = { ort: 'fiyat 5 günlük ortalamanın üstüne çıktı', sure: '10 iş günü doldu' };
export function rsi2SelMsg(P, pos, esc) {
  let t = '🔁 <b>RSI2 DÖNÜŞ · bugünün emirleri</b>   <i>deneme</i>\n';
  if (P.sat.length) t += '\n🔴 <b>SAT</b> (kapanışta)\n<blockquote>' + P.sat.map(x => { const p = pos.find(y => y.s === x.s), r = p && p.p0 > 0 ? (x.c / p.p0 - 1) * 100 : null;
    return '<b>' + esc(x.s) + '</b>   şimdi ' + f2(x.c) + (r != null ? ' (' + pc(r) + ')' : '') + '  →  SAT <code>' + f2(rsi2SellPx(x.c, x.ch)) + '</code>\n      <i>' + WHY[x.why] + '</i>'; }).join('\n') + '</blockquote>';
  if (P.al.length) t += '\n🟢 <b>AL</b> (kapanışta)\n<blockquote>' + P.al.map(x => '<b>' + esc(x.s) + '</b>   şimdi ' + f2(x.c) + ' (' + pc(x.ch) + ')  →  AL <code>' + f2(rsi2BuyPx(x.c, x.ch)) + '</code>   (' + lot(x.c) + ' lot)\n      <i>RSI(2) ' + f2(x.r) + ' · 200 günlük ortalama ' + f2(x.s200) + '</i>').join('\n') + '</blockquote>';
  t += '\n🕕 Emirleri <b>kapanış seansında (18:00–18:05)</b> limit olarak gir; herkes tek kapanış fiyatından işlem görür, yazdığın fiyat sadece emrin dışarıda kalmaması için. Lot = 100.000 TL ÷ 5 hisse örneği.\n';
  t += '<blockquote expandable>Kural: BIST 30 hissesi 200 günlük ortalamasının üstündeyken RSI(2) 10\'un altına inerse kapanışta alınır; kapanış 5 günlük ortalamanın üstüne çıkınca ya da 10 iş günü dolunca kapanışta satılır. Aynı anda en çok 5 hisse. ' +
    'Stop yok (kuralın aslında da yok). Geçmiş testte (BIST 30, 2017–2026) işlem başı ortalama +%0,30 çıktı, ama aynı hisselerde rastgele alıp birkaç gün tutmak da benzer sonuç verdi — bu yüzden DENEME. Yatırım tavsiyesi değildir.</blockquote>';
  return t;
}
export function rsi2FixMsg(gir, cik, esc) {
  let t = '🔁 <b>RSI2 DÖNÜŞ · kapanış fiyatları</b>   <i>deneme</i>\n<blockquote>';
  const L = [];
  cik.forEach(x => L.push((x.r >= 0 ? '🟢' : '🔴') + ' <b>' + esc(x.s) + '</b>   ' + f2(x.p0) + ' → ' + f2(x.p1) + '   ' + pc(x.r) + '   <i>' + x.n + ' gün</i>'));
  gir.forEach(x => L.push('➕ <b>' + esc(x.s) + '</b>   alış ' + f2(x.p0)));
  return t + L.join('\n') + '</blockquote>Sonuçlar karnede "RSI2 Dönüş" olarak ölçülüyor.';
}
async function scanQ(h, env, syms) {
  const r = await h.scanRaw(env, JSON.stringify({ symbols: { tickers: syms.map(s => 'BIST:' + s) }, columns: ['name', 'close', 'change', 'volume'] }));
  const j = await r.json(), M = {};
  (j.data || []).forEach(x => { const s = String(x.s).split(':').pop(); if (x.d[1] > 0) M[s] = { c: x.d[1], ch: x.d[2] }; });
  return M;
}

export async function rsi2Step(env, h, now = Date.now()) {
  if (!env.BT || !h.scanRaw) return null;
  const T = trT(now);
  if (T.wd < 1 || T.wd > 5 || TATIL_MD.has(T.day.slice(5))) return null;
  const inHist = T.m >= 420 && T.m < 570, inSel = T.m >= 1060 && T.m < 1076, inFix = T.m >= 1092 && T.m < 1121;
  if (!inHist && !inSel && !inFix) return null;
  // 0) GEÇMİŞ KAPANIŞLAR (sabah, seans öncesi → dünkü kapanış dahil)
  if (inHist) {
    const HH = await metaGet(env, 'rsi2_h') || {};
    if (HH.d === T.day && HH.ok) return null;
    const L = await metaGet(env, 'idx_list'), all = ((L && L.x30) || []).slice(0, 40);
    if (!all.length || !h.fetchBarsTV) return null;
    const S = HH.d === T.day ? (HH.s || {}) : {}, need = all.filter(s => !S[s]).slice(0, 5);
    if (need.length) {
      const got = await h.fetchBarsTV(env, need.map(s => 'BIST:' + s), '1D', RSI2.hist + 5, 12000);
      const dayStart = Date.parse(T.day + 'T00:00:00Z') / 1000 - 3 * 3600;
      for (const s of need) {
        const st = got['BIST:' + s];
        const bars = st ? [...st.m.values()].filter(v => v && v.length >= 5 && v[0] < dayStart).sort((a, b) => a[0] - b[0]) : [];
        S[s] = bars.length >= RSI2.trend ? bars.slice(-RSI2.hist).map(b => b[4]) : [];   // boş = yetersiz geçmiş (yeniden denenmez)
      }
    }
    const ok = all.every(s => S[s]) ? 1 : 0;
    await metaSet(env, 'rsi2_h', { d: T.day, at: now, ok, s: S });
    return { gecmis: Object.keys(S).length, ok };
  }
  const G = await metaGet(env, 'rsi2') || { pos: [], hist: [] };
  // 1) SEÇİM (17:40–17:55)
  if (inSel && G.d !== T.day) {
    const HH = await metaGet(env, 'rsi2_h');
    if (!HH || HH.d !== T.day || !HH.s) return { bekle: 'geçmiş kapanışlar bugün alınamadı' };
    const ixq = await scanQ(h, env, ['XU100']), ix = ixq.XU100 && ixq.XU100.c;
    if (!ix) return null;
    if (G.ix && Math.abs(ix - G.ix) < 1e-9) { await metaSet(env, 'rsi2', Object.assign({}, G, { d: T.day, tatil: 1 })); return { tatil: 1 }; }
    const syms = Object.keys(HH.s).filter(s => HH.s[s] && HH.s[s].length);
    const Q = await scanQ(h, env, Array.from(new Set(syms.concat((G.pos || []).map(x => x.s)))));
    const tb = await metaGet(env, 'tedbir') || {};
    const P = rsi2Pick(G.pos || [], Q, HH.s, new Set(Object.keys(tb)));
    await metaSet(env, 'rsi2', Object.assign({}, G, { d: T.day, t: now, ix, st: 'secildi', tatil: 0, pos: G.pos || [], plan: { al: P.al, sat: P.sat, kal: P.kal } }));
    if (!P.al.length && !P.sat.length) return { al: 0, sat: 0, acik: (G.pos || []).length };
    const cfg = await h.kvGet(env, 'cfg', null);
    let tg = null; if (cfg && rsi2TgOn(cfg)) tg = await h.tgSend(cfg, rsi2SelMsg(P, G.pos || [], h.esc));
    return { al: P.al.length, sat: P.sat.length, tg: !!(tg && tg.ok) };
  }
  // 2) KAPANIŞ (18:12–18:40): resmî kapanışla giriş/çıkış
  if (inFix && G.d === T.day && G.st === 'secildi' && G.plan) {
    const syms = G.plan.al.map(x => x.s).concat(G.plan.sat.map(x => x.s));
    const Q = syms.length ? await scanQ(h, env, syms) : {};
    const px = x => Q[x.s] && Q[x.s].c > 0 ? Q[x.s].c : x.c;
    const cik = G.plan.sat.map(x => { const p = (G.pos || []).find(y => y.s === x.s) || {}, p1 = px(x); return { s: x.s, d: p.d, p0: p.p0, p1, n: x.n, why: x.why, r: p.p0 > 0 ? Math.round((p1 / p.p0 - 1) * 10000) / 100 : null }; }).filter(x => x.r != null);
    const gir = G.plan.al.map(x => ({ s: x.s, d: T.day, p0: px(x), n: 0, r: x.r }));
    for (const x of cik) {
      try { await env.BT.prepare('INSERT INTO sig (d,t,src,sym,dir,px,sc,dev,meta,done,o31,rc,nx) VALUES (?,?,?,?,?,?,?,?,?,1,0,?,1)')
        .bind(x.d, Date.parse(x.d + 'T15:10:00Z'), 'rsi2', x.s, 'AL', x.p0, null, '', JSON.stringify({ cikis: x.p1, sat: T.day, gun: x.n, why: x.why }), x.r).run(); } catch (e) {}
    }
    const pos = (G.plan.kal || []).concat(gir), hist = (G.hist || []).concat(cik.map(x => ({ s: x.s, d: x.d, sat: T.day, p0: x.p0, p1: x.p1, r: x.r, n: x.n, why: x.why }))).slice(-60);
    await metaSet(env, 'rsi2', Object.assign({}, G, { st: 'kapandi', pos, hist, plan: null, son: { d: T.day, gir: gir.map(x => x.s), cik: cik.map(x => ({ s: x.s, r: x.r })) } }));
    if (!gir.length && !cik.length) return { kapa: 0 };
    const cfg = await h.kvGet(env, 'cfg', null);
    let tg = null; if (cfg && rsi2TgOn(cfg)) tg = await h.tgSend(cfg, rsi2FixMsg(gir, cik, h.esc));
    return { gir: gir.length, cik: cik.length, tg: !!(tg && tg.ok) };
  }
  // Seçim günü 'kapandi' dışında kalan durum: pozisyonların gün sayısı seçimde artar; kapanış adımı kaçarsa plan ertesi seçimde yeniden hesaplanır
  if (inSel && G.d === T.day) return null;
  return null;
}
// GET /rsi2 — üyeye boş
let RC = { at: 0, v: null };
export async function rsi2Route(env, json, anon) {
  if (anon) return json({ ok: true, g: null });
  if (RC.v && Date.now() - RC.at < 30e3) return json(RC.v);
  RC = { at: Date.now(), v: { ok: true, g: await metaGet(env, 'rsi2') } };
  return json(RC.v);
}
