// v10.0 (11.10) BORSA TEDBİRLERİ — KAP'taki Borsa duyurularından (işlem durdurma, Yakın İzleme Pazarı, hak kullanımı; metinde geçerse brüt takas/tek fiyat/açığa/kredili)
// hangi hissede şu an tedbir olduğunu tutar: D1 meta 'tedbir' = { SEMBOL: [{ k: tür, t: ms }] }.
// DAKİKALIK İŞE EK OKUMA YOK: kap.js yalnız tedbir türü çıkan yeni satır eklendiğinde tedbirAdd çağırır. meta yoksa bir kez (kap_t indeksiyle) kurulur.
// Süreler: işlem durdurma 1 gün, hak kullanımı 2 gün, Yakın İzleme Pazarı 180 gün, diğerleri 30 gün. 'kaldırıldı / işleme açıldı' haberi o türü siler.
const DAY = 864e5;
export const TEDBIR_AD = { brut: 'Brüt takas', tek: 'Tek fiyat', aciga: 'Açığa satış yasağı', kredi: 'Kredili işlem yasağı', durdur: 'İşlem durdurma', yip: 'Yakın İzleme Pazarı', hak: 'Hak kullanımı (temettü/bedelsiz)' };
const LIFE = k => (k === 'durdur' ? 1 : k === 'hak' ? 2 : k === 'yip' ? 180 : 30) * DAY;
// 11.10 (D1'de görüldü): Borsa'nın VBTS tedbirleri (brüt takas/tek fiyat…) KAP'ta YAYINLANMIYOR; KAP'ta gelenler:
// 'Pay İşlem Sırası Kapatma / Açma', 'Pazar Değişikliği — Payların Yakın İzleme Pazarına Alınması', 'Hak Kullanımı'. Hepsi tür ayrımı metinden (kap tipi 'diger' olabilir).
export function tedbirKinds(txt) {
  const s = String(txt || '').toLocaleLowerCase('tr'), out = [];
  if (/brüt takas/.test(s)) out.push('brut');
  if (/tek fiyat/.test(s)) out.push('tek');
  if (/açığa satış.{0,20}yasa/.test(s)) out.push('aciga');
  if (/kredili işlem.{0,20}(yasa|kapsam dışı)/.test(s)) out.push('kredi');
  if (/(işlem sırası|pay sırası).{0,30}(durdur|kapat|açıl|açma)/.test(s)) out.push('durdur');
  if (/pazar değişikliği|pazarına alın/.test(s)) out.push('yip');
  if (s.split('|').some(x => x.trim() === 'hak kullanımı')) out.push('hak');
  return out;
}
const LIFT = /kaldırıl|sona er|son veril|işleme açıl/;
export function tedbirPut(m, x) {
  const txt = (x.subj || '') + ' | ' + (x.summ || ''), low = txt.toLocaleLowerCase('tr'), kinds = tedbirKinds(txt);
  if (!kinds.length) return m;
  // pazar değişikliği: yalnız 'yakın izleme pazarına alınması' tedbirdir; başka pazara alınma YİP'i kaldırır
  const lift = LIFT.test(low) || (kinds.includes('yip') && !/yakın izleme/.test(low));
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
  // bir kez: son 35 gün (YİP için 180 gün) — kap_t indeksli aralık taraması
  const rs = (await env.BT.prepare("SELECT t, syms, subj, summ FROM kap INDEXED BY kap_t WHERE t > ? AND syms <> '' AND (tip = 'kisit' OR subj LIKE '%Pazar%' OR summ LIKE '%Pazar%' OR subj LIKE 'Hak Kullan%' OR summ LIKE 'Hak Kullan%' OR subj LIKE '%Sırası%') ORDER BY t").bind(now - 180 * DAY).all()).results || [];
  const m = {}; for (const x of rs) tedbirPut(m, x);
  return { m, built: true };
}
const save = (env, m) => env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tedbir', ?)").bind(JSON.stringify(m)).run();
// kap.js: yeni eklenen satırlar (yalnız tedbir türü metinden çıkan ve sembolü olanlar işlenir; yoksa hiç okuma yapılmaz)
export async function tedbirAdd(env, rows, now = Date.now()) {
  const k = (rows || []).filter(r => r.syms && tedbirKinds((r.subj || '') + ' | ' + (r.summ || '')).length);
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
