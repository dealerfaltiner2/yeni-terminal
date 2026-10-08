// v8.3 KÂĞIT ÜZERİNDE BOT — gerçek para yok, emir yok. Karnedeki (sig) sinyalleri "bot alsaydı ne olurdu?" diye hesaplar.
// Kurallar (gün içi, yalnız AL — Midas'ta açığa satış yok):
//   • Seçili kaynaklardan gelen sinyalde, sinyal fiyatından işlem başına sabit tutarla (lot = tutar ÷ fiyat) alır.
//   • Hedef/stop: Momentum ±%1,5, diğerleri ±%1 (karnedeki ölçümün aynısı; aynı dakikada ikisi → stop sayılır).
//   • İkisi de gelmezse gün sonu kapanışında satar. Her işlemden %0,1 kayma payı düşülür (alış-satış farkı).
//   • Günde en çok N işlem (ilk gelenler), aynı hisseye günde bir kez.
// Ayar: D1 meta 'paper' (yalnız ana cihaz değiştirir). Sonuç 2 dk önbellek.
const TRMS = 3 * 3600e3;
import { sigEnsure } from './sig.js';
const trDay = ms => new Date(ms + TRMS).toISOString().slice(0, 10);
export const PAPER_SRCS = ['firsat-A', 'firsat-B', 'algi', 'momentum', 'radar', 'sessiz', 'dunguclu'];
const K15 = new Set(['momentum', 'sessiz', 'dunguclu']);
// Sessiz kayıt botları: Telegram'daki yarış satırlarında gösterilmez (yalnız Karne ekranı)
export const QUIET_BOTS = new Set(['sessiz', 'dunguclu', 'momgk']);
const metaOf = r => { try { return (typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta) || {}; } catch (e) { return {}; } };   // ±%1,5 ile ölçülen kaynaklar
export const PAPER_DEF = { amt: 20000, cap: 100000, max: 5, srcs: ['firsat-A', 'firsat-B', 'algi', 'momentum'], algiG: false, slip: 0.1, start: '2026-09-29' };
const r2 = v => Math.round(v * 100) / 100;

export function paperCfg(raw) {
  const c = { ...PAPER_DEF, ...(raw || {}) };
  c.amt = Math.min(1e7, Math.max(1000, +c.amt || PAPER_DEF.amt));
  c.cap = Math.min(1e8, Math.max(c.amt, +c.cap || PAPER_DEF.cap));
  c.max = Math.min(30, Math.max(1, Math.round(+c.max || PAPER_DEF.max)));
  c.srcs = (Array.isArray(c.srcs) ? c.srcs : PAPER_DEF.srcs).filter(s => PAPER_SRCS.includes(s));
  c.algiG = !!c.algiG;
  c.slip = Math.min(1, Math.max(0, +c.slip >= 0 ? +c.slip : PAPER_DEF.slip));
  c.start = /^\d{4}-\d{2}-\d{2}$/.test(c.start) ? c.start : PAPER_DEF.start;
  return c;
}
const fcOf = r => { try { const m = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta; return m && m.fc != null ? +m.fc : null; } catch (e) { return null; } };
// Tek bir işlemin sonucu (yüzde): hedef → +K, stop → −K, ikisi de yok → gün sonu kapanışı (rc)
export function tradePct(r, slip) {
  const K = K15.has(r.src) ? 1.5 : 1, o = K15.has(r.src) ? r.o15 : r.o10;
  let p, res;
  if (o === 1) { p = K; res = 'hedef'; } else if (o === 2) { p = -K; res = 'stop'; } else if (r.rc != null) { p = +r.rc; res = 'kapanış'; } else return null;
  return { pct: r2(p - slip), res, K };
}
// Saf hesap (test edilebilir): rows = sig satırları (t sırasız olabilir)
export function paperSim(rows, cfg, today) {
  const c = paperCfg(cfg);
  rows = rows.filter(r => r.d >= c.start && r.dir === 'AL' && r.px > 0).sort((a, b) => a.t - b.t);
  const pick = (r, srcs, algiG) => srcs.includes(r.src) && !(r.src === 'algi' && algiG && !(fcOf(r) >= 0.8));
  // ana bot
  const days = new Map(), trades = [], open = [];
  let pend = 0;
  for (const r of rows) {
    if (!pick(r, c.srcs, c.algiG)) continue;
    const D = days.get(r.d) || (days.set(r.d, { d: r.d, syms: new Set(), n: 0, w: 0, l: 0, z: 0, pl: 0 }), days.get(r.d));
    if (D.syms.has(r.sym) || D.syms.size >= c.max) continue;
    D.syms.add(r.sym);
    const lot = Math.floor(c.amt / r.px);
    if (!lot) continue;
    if (!r.done) { if (r.d === today) open.push({ t: r.t, src: r.src, sym: r.sym, px: r.px, lot, K: K15.has(r.src) ? 1.5 : 1 }); else pend++; continue; }
    const o = tradePct(r, c.slip); if (!o) continue;
    const pl = Math.round(lot * r.px * o.pct / 100);
    D.n++; D.pl += pl; if (o.res === 'hedef') D.w++; else if (o.res === 'stop') D.l++; else D.z++;
    trades.push({ d: r.d, t: r.t, src: r.src, sym: r.sym, px: r.px, lot, res: o.res, pct: o.pct, pl });
  }
  let eq = 0, peak = 0, dd = 0, win = 0;
  for (const x of trades) { eq += x.pl; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); if (x.pl > 0) win++; }
  const DL = [...days.values()].filter(x => x.n).map(({ syms, ...x }) => x);
  const tot = { n: trades.length, w: DL.reduce((a, x) => a + x.w, 0), l: DL.reduce((a, x) => a + x.l, 0), z: DL.reduce((a, x) => a + x.z, 0), kar: win, pl: eq, pct: r2(eq / c.cap * 100), dd: Math.round(dd), gun: DL.length, iyi: DL.filter(x => x.pl > 0).length };
  // her kaynak tek başına (aynı tutar, günlük sınır yok, hisse başına günde bir)
  const bySrc = {};
  for (const s of PAPER_SRCS) {
    const seen = new Set(); const B = { n: 0, w: 0, l: 0, z: 0, pl: 0 };
    for (const r of rows) {
      if (r.src !== s || !r.done) continue;
      const k = r.d + r.sym; if (seen.has(k)) continue; seen.add(k);
      const lot = Math.floor(c.amt / r.px), o = tradePct(r, c.slip); if (!lot || !o) continue;
      B.n++; B.pl += Math.round(lot * r.px * o.pct / 100); if (o.res === 'hedef') B.w++; else if (o.res === 'stop') B.l++; else B.z++;
    }
    if (B.n) bySrc[s] = B;
  }
  return { cfg: c, tot, days: DL.reverse(), trades: trades.slice(-40).reverse(), open, pend, bySrc, bots: botRace(rows, c, today) };
}
// v8.4 BOT YARIŞI — aynı sinyallerle, tek bir kuralı farklı 6 kâğıt bot. Hangisi daha çok kazandırıyor?
// Ayar (tutar, günlük sınır, kaynaklar) ana botla aynı; her bot yalnız kendi kuralında farklı.
const trM = ms => { const d = new Date(ms + TRMS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const resOf = (p, K) => p >= K - 1e-9 ? 'hedef' : p <= -K + 1e-9 ? 'stop' : 'süre';
export const BOTS = [
  { k: 'mevcut', ad: 'Mevcut kurallar', not: 'Ana botun aynısı (karşılaştırma için).' },
  { k: 'guclu', ad: 'Algı\'da yalnız güçlüler', not: 'Algı sinyalinde alıcı oranı %80\'in altındaysa almaz.' },
  { k: 'saat', ad: 'Öğle arası yok', not: '11:00–13:00 arasında gelen sinyalleri almaz.' },
  { k: 'geri', ad: 'Geri çekilmede gir', not: 'Hemen almaz; 30 dk içinde fiyat %0,5 geri gelirse oradan alır, gelmezse geçer.' },
  { k: 'cabuk', ad: 'Çabuk çık', not: 'Hedef ya da stop 60 dk içinde gelmezse satar; gün sonunu beklemez.' },
  { k: 'fren', ad: 'Günlük fren', not: 'O gün 2 stop olduysa başka işlem açmaz.' },
  { k: 'sessiz', ad: '🤫 Sessiz trend (deneme)', not: 'Yalnız sessiz kayıt sinyalleri: trendde, sabah sessiz ve sıkışık hisse, 10:30 alım, ±%1,5.' },
  { k: 'dunguclu', ad: '💪 Dün güçlü kapanış (deneme)', not: 'Sessiz kayıt: oynak hisse dünü günün tepesine yakın kapatmış, 10:30\'da yatay (−%1…+%1) → al, ±%1,5.' },
  { k: 'momgk', ad: '🧪 Momentum + dün güçlü kapanış', not: 'Yalnız dünü günün tepesine yakın kapatan Momentum sinyalleri (dün kapanış yeri ≥ %70), ±%1,5.' }
];
export function botRace(rows, c, today) {
  const wk = new Date(Date.parse(today) - 6 * 864e5).toISOString().slice(0, 10);
  return BOTS.map(b => {
    const days = new Map(); let n = 0, w = 0, l = 0, pl = 0, hafta = 0, eksik = 0, bugun = 0;
    for (const r of rows) {
      if (!r.done) continue;
      if (b.k === 'sessiz' || b.k === 'dunguclu') { if (r.src !== b.k) continue; }
      else if (b.k === 'momgk') { if (r.src !== 'momentum' || !(+metaOf(r).yc >= 0.7)) continue; }
      else if (!c.srcs.includes(r.src)) continue;
      if (r.src === 'algi' && (c.algiG || b.k === 'guclu') && !(fcOf(r) >= 0.8)) continue;
      if (b.k === 'saat') { const m = trM(r.t); if (m >= 660 && m < 780) continue; }
      const D = days.get(r.d) || (days.set(r.d, { syms: new Set(), stop: 0, pl: 0 }), days.get(r.d));
      if (D.syms.has(r.sym) || D.syms.size >= c.max) continue;
      if (b.k === 'fren' && D.stop >= 2) continue;
      const K = K15.has(r.src) ? 1.5 : 1;
      let p, res, px = r.px;
      if (b.k === 'geri') {
        if (r.pbn == null || r.pbn < 0) { eksik++; continue; }
        if (r.pbn === 0) continue;                       // fiyat geri gelmedi → işlem yok
        p = +r.pb; px = r.px * 0.995; res = resOf(p, K);
      } else if (b.k === 'cabuk') {
        if (r.tx == null) { eksik++; continue; }
        p = +r.tx; res = resOf(p, K);
      } else { const o = tradePct(r, 0); if (!o) continue; p = o.pct; res = o.res; }
      D.syms.add(r.sym);
      const lot = Math.floor(c.amt / px); if (!lot) continue;
      const x = Math.round(lot * px * (p - c.slip) / 100);
      n++; pl += x; D.pl += x; if (res === 'hedef') w++; else if (res === 'stop') { l++; D.stop++; }
      if (r.d >= wk) hafta += x; if (r.d === today) bugun += x;
    }
    const DL = [...days.values()].filter(x => x.syms.size);
    return { k: b.k, ad: b.ad, not: b.not, n, w, l, pl, hafta, bugun, gun: DL.length, iyi: DL.filter(x => x.pl > 0).length, eksik };
  }).sort((a, b) => b.pl - a.pl);
}
let cache = { at: 0, v: null };
export async function paperCalc(env, fresh) {
  if (!fresh && cache.v && Date.now() - cache.at < 120e3) return cache.v;
  const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'paper'").first();
  let raw = null; try { raw = m ? JSON.parse(m.v) : null; } catch (e) {}
  const c = paperCfg(raw);
  let rows = [];
  try { await sigEnsure(env); } catch (e) {}
  try { rows = (await env.BT.prepare("SELECT d, t, src, sym, dir, px, done, o10, o15, rc, tx, pb, pbn, meta FROM sig WHERE d >= ? AND err IS NULL AND src IN ('firsat-A','firsat-B','algi','momentum','radar','sessiz','dunguclu')").bind(c.start).all()).results || []; } catch (e) { if (!/no such table/i.test(String(e && e.message))) throw e; }
  const v = { ok: true, at: Date.now(), ...paperSim(rows, c, trDay(Date.now())) };
  cache = { at: Date.now(), v };
  return v;
}
export async function paperRoute(route, request, env, json) {
  if (route === 'paper-set') {
    if (request.method !== 'POST') return json({ ok: false, error: 'POST' }, 400);
    let b; try { b = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
    const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'paper'").first();
    let old = null; try { old = m ? JSON.parse(m.v) : null; } catch (e) {}
    const c = paperCfg({ ...(old || {}), ...b });
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('paper', ?)").bind(JSON.stringify(c)).run();
    return json(await paperCalc(env, true));
  }
  return json(await paperCalc(env));
}
// Karne mesajına eklenecek satır (bugün + başından beri)
export async function paperLine(env, today) {
  try {
    const v = await paperCalc(env, true), D = v.days.find(x => x.d === today), t = v.tot;
    if (!t.n) return '';
    const tl = n => (n >= 0 ? '+' : '−') + Math.abs(Math.round(n)).toLocaleString('tr-TR') + ' TL';
    return '\n\n🤖 <b>Kâğıt üzerinde bot</b> <i>(gerçek para yok)</i>\n   bugün: ' + (D ? D.n + ' işlem → <b>' + tl(D.pl) + '</b>' : 'işlem yok') +
      '\n   başından beri: ' + t.n + ' işlem, ' + t.gun + ' gün → <b>' + tl(t.pl) + '</b> (' + (t.pct >= 0 ? '+' : '') + '%' + String(t.pct).replace('.', ',') + ')' +
      ((B0 => B0 ? '\n   🏁 yarışta önde: <b>' + B0.ad + '</b> (' + tl(B0.pl) + ')' : '')((v.bots || []).find(b => b.n && !QUIET_BOTS.has(b.k))));
  } catch (e) { return ''; }
}
