// v8.3 KÂĞIT ÜZERİNDE BOT — gerçek para yok, emir yok. Karnedeki (sig) sinyalleri "bot alsaydı ne olurdu?" diye hesaplar.
// Kurallar (gün içi, yalnız AL — Midas'ta açığa satış yok):
//   • Seçili kaynaklardan gelen sinyalde, sinyal fiyatından işlem başına sabit tutarla (lot = tutar ÷ fiyat) alır.
//   • Hedef/stop: Momentum ±%1,5, diğerleri ±%1 (karnedeki ölçümün aynısı; aynı dakikada ikisi → stop sayılır).
//   • İkisi de gelmezse gün sonu kapanışında satar. Her işlemden %0,1 kayma payı düşülür (alış-satış farkı).
//   • Günde en çok N işlem (ilk gelenler), aynı hisseye günde bir kez.
// Ayar: D1 meta 'paper' (yalnız ana cihaz değiştirir). Sonuç 2 dk önbellek.
const TRMS = 3 * 3600e3;
const trDay = ms => new Date(ms + TRMS).toISOString().slice(0, 10);
export const PAPER_SRCS = ['firsat-A', 'firsat-B', 'algi', 'momentum', 'radar'];
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
  const K = r.src === 'momentum' ? 1.5 : 1, o = r.src === 'momentum' ? r.o15 : r.o10;
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
    if (!r.done) { if (r.d === today) open.push({ t: r.t, src: r.src, sym: r.sym, px: r.px, lot, K: r.src === 'momentum' ? 1.5 : 1 }); else pend++; continue; }
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
  return { cfg: c, tot, days: DL.reverse(), trades: trades.slice(-40).reverse(), open, pend, bySrc };
}
let cache = { at: 0, v: null };
export async function paperCalc(env, fresh) {
  if (!fresh && cache.v && Date.now() - cache.at < 120e3) return cache.v;
  const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'paper'").first();
  let raw = null; try { raw = m ? JSON.parse(m.v) : null; } catch (e) {}
  const c = paperCfg(raw);
  let rows = [];
  try { rows = (await env.BT.prepare("SELECT d, t, src, sym, dir, px, done, o10, o15, rc, meta FROM sig WHERE d >= ? AND err IS NULL AND src IN ('firsat-A','firsat-B','algi','momentum','radar')").bind(c.start).all()).results || []; } catch (e) { if (!/no such table/i.test(String(e && e.message))) throw e; }
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
      '\n   başından beri: ' + t.n + ' işlem, ' + t.gun + ' gün → <b>' + tl(t.pl) + '</b> (' + (t.pct >= 0 ? '+' : '') + '%' + String(t.pct).replace('.', ',') + ')';
  } catch (e) { return ''; }
}
