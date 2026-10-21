// v14.3 (22.10, Fatih onayıyla: 'Evet') EMA HEDEF MERDİVENİ ARAŞTIRMASI — bir kerelik, yalnız araştırma (sinyal/Telegram DEĞİŞMEZ).
// Soru (Fatih + Nihat): 15 dk AL sinyalinden sonra üst zaman dilimlerindeki EMA 200 (30 dk → 1 sa → 2 sa → 4 sa) ve saatlik EMA 50 seviyeleri
// hedef/direnç olarak çalışıyor mu? Fiyat −%1 stop gelmeden bu seviyelere ulaşıyor mu, ulaşınca durup dönüyor mu?
// Çalışma: seans DIŞINDA ana işte dakikada 1 hisse (meta 'emar_on'='1' iken). Kuyruk meta 'emar_q' (29.09'dan beri AL sinyali olan hisseler, bir kez kurulur).
// Hisse kuyruktan ÖNCE çıkarılır (çalışma kesilirse aynı hisse tekrar denenmez). Sonuç D1 tablo 'emar' (sinyal başına bir satır, lv = JSON).
// Bitince meta 'emar_st' = {bitti, n}. Analiz yerelde (tools/) yapılır; dakikalık işe ek okuma yalnız meta + sig_sym indeksli tek sorgu.
export const EMAR_FROM = '2026-09-29';
export const EMAR_SRCS = ['algi', 'firsat-A', 'firsat-B', 'momentum', 'tavan6'];
const TFS = [['30', 700], ['60', 500], ['120', 420], ['240', 420]];

export function emaArr(c, n) { const k = 2 / (n + 1), o = new Array(c.length).fill(null); let e = null;
  for (let i = 0; i < c.length; i++) { const v = c[i]; if (v == null) continue; if (i < n - 1) { o[i] = null; e = e == null ? v : e + (v - e) * k; continue; }
    if (i === n - 1) { let s = 0; for (let j = 0; j < n; j++) s += c[j]; e = s / n; } else e = e + (v - e) * k; o[i] = e; }
  return o; }
// tf mumlarında sinyal anında BİTMİŞ son mumun EMA'sı (bar [t,o,h,l,c,v], t = açılış saniyesi)
export function emaAt(bars, tfMin, sigT, n) {
  if (!bars || bars.length < n + 5) return null;
  const c = bars.map(b => b[4]), e = emaArr(c, n);
  let idx = -1; for (let i = bars.length - 1; i >= 0; i--) { if ((bars[i][0] + tfMin * 60) * 1000 <= sigT) { idx = i; break; } }
  return idx >= 0 && e[idx] != null ? e[idx] : null; }
const istDay = ms => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
// 5 dk mumlarla aynı gün yolu: seviye L için r = 1 (−%1 stoptan önce ulaştı) / 2 (önce stop) / 0 (ikisi de yok); ext = ulaştıktan sonra L'nin üstüne en çok kaç % çıktı; back = ulaştıktan sonra gün sonu L'ye göre %
export function levelPath(b5, sigT, px, L) {
  const d = istDay(sigT), stop = px * 0.99;
  const path = b5.filter(b => b[0] * 1000 >= sigT && istDay(b[0] * 1000) === d);
  if (!path.length) return null;
  let r = 0, hitI = -1;
  for (let i = 0; i < path.length; i++) { const b = path[i]; if (b[3] <= stop) { r = 2; break; } if (b[2] >= L) { r = 1; hitI = i; break; } }
  let ext = null, back = null;
  if (hitI >= 0) { let hi = 0; for (let i = hitI; i < path.length; i++) hi = Math.max(hi, path[i][2]); ext = +((hi / L - 1) * 100).toFixed(2); back = +((path[path.length - 1][4] / L - 1) * 100).toFixed(2); }
  return { r, ext, back };
}
// bir sinyal için tüm seviyeler: [anahtar, seviye, uzaklık %, r, ext, back]
export function emarCalc(sig, b5, tb) {
  const out = [];
  for (const [tf] of TFS) for (const n of [200, 50]) {
    if (n === 50 && tf === '30') continue;
    const L = emaAt(tb[tf], +tf, sig.t, n); if (L == null) { out.push([tf + '-' + n, null]); continue; }
    const dist = +((L / sig.px - 1) * 100).toFixed(2);
    const p = dist > 0 ? levelPath(b5, sig.t, sig.px, L) : null;
    out.push([tf + '-' + n, +L.toFixed(4), dist, p ? p.r : null, p ? p.ext : null, p ? p.back : null]);
  }
  return out;
}
export async function emarStep(env, fetchBarsTV) {
  if (!env.BT) return null;
  let on = null; try { on = await env.BT.prepare("SELECT v FROM meta WHERE k = 'emar_on'").first(); } catch (e) {}
  if (!on || on.v !== '1') return null;
  await env.BT.prepare('CREATE TABLE IF NOT EXISTS emar (id INTEGER PRIMARY KEY, sym TEXT, src TEXT, t INTEGER, px REAL, tg INTEGER, o31 INTEGER, mfe REAL, mae REAL, lv TEXT)').run();
  let q = null; const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'emar_q'").first();
  if (m) { try { q = JSON.parse(m.v); } catch (e) { q = []; } }
  else {   // bir kez: kuyruğu kur (sig_d indeksi)
    const rs = (await env.BT.prepare(`SELECT DISTINCT sym FROM sig INDEXED BY sig_d WHERE d >= ? AND src IN (${EMAR_SRCS.map(() => '?').join(',')}) AND px IS NOT NULL`).bind(EMAR_FROM, ...EMAR_SRCS).all()).results || [];
    q = rs.map(r => r.sym).filter(Boolean);
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('emar_q', ?)").bind(JSON.stringify(q)).run();
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('emar_st', ?)").bind(JSON.stringify({ basla: Date.now(), toplam: q.length })).run();
    return { kuyruk: q.length };
  }
  if (!q.length) { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('emar_on', '0')").run();
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('emar_st', ?)").bind(JSON.stringify({ bitti: Date.now() })).run(); return { bitti: 1 }; }
  const sym = q.shift();
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('emar_q', ?)").bind(JSON.stringify(q)).run();   // önce çıkar (kesilirse tekrar denenmez)
  const sigs = (await env.BT.prepare(`SELECT rowid id, t, src, px, meta, o31, mfe, mae FROM sig INDEXED BY sig_sym WHERE sym = ? AND d >= ? AND src IN (${EMAR_SRCS.map(() => '?').join(',')}) AND px IS NOT NULL`).bind(sym, EMAR_FROM, ...EMAR_SRCS).all()).results || [];
  if (!sigs.length) return { sym, n: 0 };
  const key = 'BIST:' + sym, toBars = st => st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
  const b5 = toBars((await fetchBarsTV(env, [key], '5', 2200, 12000))[key]);
  const tb = {};
  for (const [tf, n] of TFS) tb[tf] = toBars((await fetchBarsTV(env, [key], tf, n, 9000))[key]);
  if (!b5.length) return { sym, n: 0, err: 'mum yok' };
  let w = 0;
  for (const s of sigs) {
    let mt = {}; try { mt = JSON.parse(s.meta || '{}') || {}; } catch (e) {}
    const tg = s.src === 'algi' ? (mt.fc >= 0.8 && mt.rv >= 2 ? 1 : 0) : 1;
    const lv = emarCalc(s, b5, tb);
    await env.BT.prepare('INSERT OR REPLACE INTO emar (id, sym, src, t, px, tg, o31, mfe, mae, lv) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(s.id, sym, s.src, s.t, s.px, tg, s.o31, s.mfe, s.mae, JSON.stringify(lv)).run();
    w++;
  }
  return { sym, n: w, kalan: q.length };
}
