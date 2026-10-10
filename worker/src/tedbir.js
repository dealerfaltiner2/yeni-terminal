// v10.0 (11.10) BORSA TEDBİRLERİ — KAP'taki 'kisit' haberlerinden (brüt takas, tek fiyat, açığa satış / kredili işlem yasağı, işlem durdurma)
// hangi hissede şu an tedbir olduğunu tutar: D1 meta 'tedbir' = { SEMBOL: [{ k: tür, t: ms }] }.
// DAKİKALIK İŞE EK OKUMA YOK: kap.js yalnız yeni 'kisit' satırı eklendiğinde tedbirAdd çağırır. meta yoksa bir kez (kap_t indeksiyle, son 35 gün) kurulur.
// Süreler: işlem durdurma 1 gün, diğerleri 30 gün (Borsa'nın tedbirleri çoğunlukla 1 ay). 'kaldırıldı / sona erdi' haberi o türü siler.
const DAY = 864e5;
export const TEDBIR_AD = { brut: 'Brüt takas', tek: 'Tek fiyat', aciga: 'Açığa satış yasağı', kredi: 'Kredili işlem yasağı', durdur: 'İşlem durdurma', diger: 'İşlem kısıtı' };
const LIFE = k => (k === 'durdur' ? 1 : 30) * DAY;
export function tedbirKinds(txt) {
  const s = String(txt || '').toLocaleLowerCase('tr'), out = [];
  if (/brüt takas/.test(s)) out.push('brut');
  if (/tek fiyat/.test(s)) out.push('tek');
  if (/açığa satış/.test(s)) out.push('aciga');
  if (/kredili işlem/.test(s)) out.push('kredi');
  if (/işlem sırası.{0,20}(durdur|kapat)/.test(s)) out.push('durdur');
  return out.length ? out : ['diger'];
}
const LIFT = /kaldırıl|sona er|son veril|yeniden işleme açıl/;
export function tedbirPut(m, x) {
  const txt = (x.subj || '') + ' | ' + (x.summ || ''), kinds = tedbirKinds(txt), lift = LIFT.test(txt.toLocaleLowerCase('tr'));
  for (const s of String(x.syms || '').split(',').filter(Boolean)) {
    let a = (m[s] || []).filter(e => !kinds.includes(e.k) || e.t > x.t);
    if (!lift) for (const k of kinds) if (!a.some(e => e.k === k)) a.push({ k, t: x.t });
    if (a.length) m[s] = a; else delete m[s];
  }
  return m;
}
export function tedbirPrune(m, now) {
  const o = {};
  for (const [s, a] of Object.entries(m || {})) { const b = (Array.isArray(a) ? a : []).filter(e => e && now - e.t < LIFE(e.k)); if (b.length) o[s] = b; }
  return o;
}
async function tedbirLoad(env, now) {
  const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'tedbir'").first();
  if (r) { try { return { m: JSON.parse(r.v), built: false }; } catch (e) {} }
  const rs = (await env.BT.prepare("SELECT t, syms, subj, summ FROM kap INDEXED BY kap_t WHERE t > ? AND tip = 'kisit' ORDER BY t").bind(now - 35 * DAY).all()).results || [];
  const m = {}; for (const x of rs) tedbirPut(m, x);
  return { m, built: true };
}
const save = (env, m) => env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tedbir', ?)").bind(JSON.stringify(m)).run();
// kap.js: yeni eklenen satırlar (yalnız tip 'kisit' ve sembolü olanlar işlenir)
export async function tedbirAdd(env, rows, now = Date.now()) {
  const k = (rows || []).filter(r => r.tip === 'kisit' && r.syms);
  if (!k.length) return 0;
  const { m } = await tedbirLoad(env, now);
  k.sort((a, b) => a.t - b.t).forEach(x => tedbirPut(m, x));
  await save(env, tedbirPrune(m, now));
  return k.length;
}
// /tedbir (DATA): { ok, map: { SEMBOL: [{ k, ad, t }] } }
export async function tedbirRoute(env, json, now = Date.now()) {
  const { m, built } = await tedbirLoad(env, now);
  const p = tedbirPrune(m, now);
  if (built) await save(env, p);
  const map = {};
  for (const [s, a] of Object.entries(p)) map[s] = a.map(e => ({ k: e.k, ad: TEDBIR_AD[e.k] || e.k, t: e.t }));
  return json({ ok: true, map });
}
