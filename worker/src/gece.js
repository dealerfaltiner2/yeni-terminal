// v14.23 (28.10 gece, Fatih onayıyla: 'kur, yayınla, Telegram'a bildir'; araştırma DEVIR 7a) GECE KUŞU — AKŞAM AL, SABAH SAT
// 13 ay / 92 büyük hisse / 276 gün: kapanış → ertesi sabah 10:30 ort. +%0,15/gün (günlerin %63'ü artı, iki dönemde de),
// 10:30 → kapanış −%0,13. O gün %3'ten fazla düşen hisse gece de düşüyor (−%0,3…−1), tavan kilitli hisseye kapanışta alım gerçekleşmeyebilir.
// Akış (ana iş, dakikada bir; pencere dışında tek meta okuması yok — saat kontrolü önce):
//   17:40–17:55  geceSec  : BIST 100 (meta idx_list.x100) taraması → eleme → en likit 8 → meta 'gece' {st:'secildi'} + Telegram sepet mesajı
//   18:12–18:40  geceKapa : aynı 8 hissenin RESMÎ kapanış fiyatı → giriş fiyatı (st:'alindi')
//   ertesi iş günü 10:25–10:45 geceSat : anlık fiyat → hisse başına sonuç, sepet ortalaması → Telegram + karne (sig src 'gece', done=1, rc = sonuç %, o31 = 0)
// Tatil: XU100 kapanışı bir önceki seçimdekiyle AYNIYSA o gün işlem yok sayılır (seçim yapılmaz; satış ertesi açık güne kalır).
// AL/SAT tavsiyesi değil; mesajda risk yazılı. cfg.opt.gece === 0 → Telegram kapalı (karne yine yazılır).
const TRMS = 3 * 3600e3;
export const GECE_N = 8, GECE_MIN_TL = 100e6;
// Resmî tatiller (sabit tarihli; dinî bayramlar endeks kontrolüyle yakalanır): bu günlerde seçim/satış yapılmaz
export const TATIL_MD = new Set(['01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29']);
const trT = ms => { const d = new Date(ms + TRMS); return { wd: d.getUTCDay(), m: d.getUTCHours() * 60 + d.getUTCMinutes(), day: d.toISOString().slice(0, 10) }; };
const f2 = v => Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pc = v => (v >= 0 ? '+' : '−') + '%' + f2(Math.abs(v));
const metaGet = async (env, k) => { try { const r = await env.BT.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; } catch (e) { return null; } };
const metaSet = (env, k, v) => env.BT.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind(k, JSON.stringify(v)).run();

// Saf seçim: Q = [{s, c, ch, v}] tarama satırları; bad = tedbirli kodlar kümesi
export function gecePick(Q, bad = new Set(), n = GECE_N) {
  return (Q || []).filter(x => x && x.s && x.c > 0 && x.ch != null && isFinite(x.ch))
    .map(x => ({ s: x.s, c: x.c, ch: Math.round(x.ch * 100) / 100, tl: x.c * (x.v || 0) }))
    .filter(x => x.ch > -3 && x.ch < 9.5 && x.tl >= GECE_MIN_TL && !bad.has(x.s))
    .sort((a, b) => b.tl - a.tl).slice(0, n);
}
export function geceBuyMsg(L, esc) {
  return '🌙 <b>GECE KUŞU · akşam sepeti</b>   <i>' + L.length + ' hisse</i>\n<blockquote>' +
    L.map(x => '<b>' + esc(x.s) + '</b>   <code>' + f2(x.c) + '</code>   bugün ' + pc(x.ch)).join('\n') + '</blockquote>' +
    '🕕 <b>Kapanış seansında</b> (18:00–18:10) her birine <b>eşit tutarla</b> al.\n☀️ Yarın <b>10:25–10:30</b> arası sat (Pusula hatırlatır).\n' +
    '<blockquote expandable>Neden: 13 ayda büyük hisseler kapanıştan ertesi sabah 10:30\'a ortalama +%0,15 kazandırdı (günlerin %63\'ü artı); gün içinde ise kaybettirdi. ' +
    'O gün %3\'ten fazla düşenler, tavandakiler ve Borsa tedbirliler sepete alınmaz.\n' +
    'Risk: gece stop konamaz; kötü bir haberle sabah boşlukla düşüş olabilir (13 ayın en kötü sabahı sepet ort. −%4). Çöküş aylarında bu strateji de kaybettirir. ' +
    'Hisse başına beklenen kazanç küçüktür (~%0,2); kazanç çok günün toplamından gelir.</blockquote>Yatırım tavsiyesi değildir.';
}
export function geceSellMsg(R, avg, esc, deneme) {
  const w = R.filter(x => x.r > 0).length;
  return '☀️ <b>GECE KUŞU · satış zamanı</b>   <i>sepet ' + pc(avg) + '</i>' + (deneme ? '\n<i>Deneme sepeti: ' + esc(deneme) + ' kapanış fiyatlarıyla kuruldu.</i>' : '') + '\n<blockquote>' +
    R.map(x => (x.r >= 0 ? '🟢' : '🔴') + ' <b>' + esc(x.s) + '</b>   ' + f2(x.p0) + ' → <code>' + f2(x.p1) + '</code>   ' + pc(x.r)).join('\n') + '</blockquote>' +
    w + ' artı · ' + (R.length - w) + ' eksi · <b>10:30\'a kadar sat.</b> Sonuç karnede "Gece Kuşu" olarak ölçülüyor.';
}
async function scanQ(h, env, syms) {
  const r = await h.scanRaw(env, JSON.stringify({ symbols: { tickers: syms.map(s => 'BIST:' + s) }, columns: ['name', 'close', 'change', 'volume'] }));
  const j = await r.json();
  return (j.data || []).map(x => ({ s: String(x.s).split(':').pop(), c: x.d[1], ch: x.d[2], v: x.d[3] }));
}
async function ixClose(h, env) { const q = await scanQ(h, env, ['XU100']); return q[0] && q[0].c > 0 ? q[0].c : null; }

export async function geceStep(env, h, now = Date.now()) {
  if (!env.BT || !h.scanRaw) return null;
  const T = trT(now);
  if (T.wd < 1 || T.wd > 5) return null;
  if (TATIL_MD.has(T.day.slice(5))) return null;
  const inSel = T.m >= 1060 && T.m < 1076, inFix = T.m >= 1092 && T.m < 1121, inSell = T.m >= 625 && T.m < 646;
  if (!inSel && !inFix && !inSell) return null;
  const G = await metaGet(env, 'gece') || {};
  // 1) SATIŞ (ertesi iş günü sabahı)
  if (inSell && (G.st === 'alindi' || G.st === 'secildi') && G.d && G.d < T.day) {
    const ix = await ixClose(h, env);
    if (!ix) return null;
    if (G.ix && Math.abs(ix - G.ix) < 1e-9) return { bekle: 'piyasa kapalı (tatil?)' };   // endeks hiç kıpırdamadıysa bugün işlem yok
    const Q = await scanQ(h, env, G.list.map(x => x.s)), M = {}; Q.forEach(x => { M[x.s] = x; });
    const R = G.list.map(x => Object.assign({}, x, { p0: x.p0 > 0 ? x.p0 : x.c })).filter(x => x.p0 > 0 && M[x.s] && M[x.s].c > 0).map(x => ({ s: x.s, p0: x.p0, p1: M[x.s].c, r: Math.round((M[x.s].c / x.p0 - 1) * 10000) / 100 }));
    if (!R.length) return null;
    const avg = Math.round(R.reduce((a, x) => a + x.r, 0) / R.length * 100) / 100;
    for (const x of R) {
      try { await env.BT.prepare('INSERT INTO sig (d,t,src,sym,dir,px,sc,dev,meta,done,o31,rc,nx) VALUES (?,?,?,?,?,?,?,?,?,1,0,?,1)')
        .bind(G.d, G.t || now, 'gece', x.s, 'AL', x.p0, null, '', JSON.stringify({ cikis: x.p1, sat: T.day }), x.r).run(); } catch (e) {}
    }
    const hist = (G.hist || []).concat([{ d: G.d, s: T.day, ort: avg, n: R.length, w: R.filter(x => x.r > 0).length }]).slice(-30);
    await metaSet(env, 'gece', Object.assign({}, G, { deneme: 0, st: 'satildi', res: { d: T.day, ort: avg, list: R }, hist }));
    const cfg = await h.kvGet(env, 'cfg', null);
    let tg = null; if (cfg && !(cfg.opt && cfg.opt.gece === 0)) tg = await h.tgSend(cfg, geceSellMsg(R, avg, h.esc, G.deneme ? G.d.split('-').reverse().slice(0, 2).join('.') : ''));
    return { sat: R.length, ort: avg, tg: !!(tg && tg.ok) };
  }
  // 2) SEÇİM (17:40–17:55)
  if (inSel && G.d !== T.day) {
    const L100 = await metaGet(env, 'idx_list');
    const syms = ((L100 && L100.x100) || []).slice(0, 120);
    if (!syms.length) return null;
    const ix = await ixClose(h, env);
    if (!ix) return null;
    if (G.ix && Math.abs(ix - G.ix) < 1e-9 && G.d) { await metaSet(env, 'gece', Object.assign({}, G, { tatil: T.day })); return { tatil: 1 }; }
    if (G.st === 'alindi') return { bekle: 'önceki sepet henüz satılmadı' };   // (sabah satışı kaçtıysa yeni sepet açılmaz, ertesi sabah satılır)
    const tb = await metaGet(env, 'tedbir') || {};
    const L = gecePick(await scanQ(h, env, syms), new Set(Object.keys(tb)));
    if (!L.length) return null;
    await metaSet(env, 'gece', { d: T.day, t: now, ix, st: 'secildi', list: L.map(x => ({ s: x.s, c: x.c, ch: x.ch })), hist: G.hist || [], res: G.res || null });
    const cfg = await h.kvGet(env, 'cfg', null);
    let tg = null; if (cfg && !(cfg.opt && cfg.opt.gece === 0)) tg = await h.tgSend(cfg, geceBuyMsg(L, h.esc));
    return { sec: L.length, tg: !!(tg && tg.ok) };
  }
  // 3) KAPANIŞ FİYATI (18:12–18:40) — giriş fiyatı = resmî kapanış
  if (inFix && G.d === T.day && G.st === 'secildi') {
    const Q = await scanQ(h, env, G.list.map(x => x.s)), M = {}; Q.forEach(x => { M[x.s] = x; });
    const list = G.list.map(x => Object.assign({}, x, { p0: M[x.s] && M[x.s].c > 0 ? M[x.s].c : x.c }));
    const ix = await ixClose(h, env);
    await metaSet(env, 'gece', Object.assign({}, G, { st: 'alindi', list, ix: ix || G.ix }));
    return { kapa: list.length };
  }
  return null;
}
// v14.24 (28.10 gece, Fatih: 'sepeti kapanış verilerine göre oluştur'): TEK SEFERLİK deneme sepeti — probe 'gece_now' çağırır.
// Seans kapandıktan sonra tarama = günün kapanışı → giriş fiyatı p0 = kapanış, st 'alindi'. Telegram'a alış mesajı GİTMEZ; satış her zamanki gibi ertesi iş günü 10:25.
export async function geceNow(env, scanRaw, now = Date.now()) {
  const T = trT(now), G = await metaGet(env, 'gece') || {};
  if (G.d === T.day && (G.st === 'secildi' || G.st === 'alindi')) return 'zaten sepet var';
  if (G.st === 'alindi' || G.st === 'secildi') return 'satılmamış sepet var';
  const h = { scanRaw };
  const L100 = await metaGet(env, 'idx_list'), syms = ((L100 && L100.x100) || []).slice(0, 120);
  if (!syms.length) return 'idx_list yok';
  const ix = await ixClose(h, env); if (!ix) return 'endeks yok';
  const tb = await metaGet(env, 'tedbir') || {};
  const L = gecePick(await scanQ(h, env, syms), new Set(Object.keys(tb)));
  if (!L.length) return 'sepet boş';
  await metaSet(env, 'gece', { d: T.day, t: now, ix, st: 'alindi', deneme: 1, list: L.map(x => ({ s: x.s, c: x.c, ch: x.ch, p0: x.c })), hist: G.hist || [], res: G.res || null });
  return 'tamam ' + L.map(x => x.s + ' ' + x.c + ' ' + x.ch).join(', ');
}
// GET /gece (terminal kartı) — üyeye boş
let GC = { at: 0, v: null };
export async function geceRoute(env, json, anon) {
  if (anon) return json({ ok: true, g: null });
  if (GC.v && Date.now() - GC.at < 30e3) return json(GC.v);
  const g = await metaGet(env, 'gece');
  GC = { at: Date.now(), v: { ok: true, g } };
  return json(GC.v);
}
