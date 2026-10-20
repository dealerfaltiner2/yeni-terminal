// v13.0 (20.10, Fatih: aracı kurum uygulamasındaki 'Keşfet' gibi hazır listeler) — sunucu tarafı.
// /kesif (DATA yolu): yeni iş ilişkisi (son 30 gün, KAP detay metninden TUTAR), şirket geri alımları (son 7 gün), dün tavan kapananlar.
// Ortak önbellek meta 'kesif_v' (30 dk) → okuma: 30 dk'da bir ~1 kaph taraması (kaph_st indeksi) + 7 günlük kap (kap_t indeksi).
// Dakikalık işe HİÇBİR sorgu eklenmez; yalnız biri listeyi açınca ve önbellek eskiyse hesaplanır.
const TTL = 30 * 60e3;

// Sayıyı Türkçe/İngilizce yazımdan çöz: '111.719.627' / '111,719,627' / '3,2' / '3.2' / '1.234,5'
export function kesNum(s) {
  s = String(s || '').trim();
  if (!/\d/.test(s)) return null;
  const hasD = s.includes('.'), hasC = s.includes(',');
  if (hasD && hasC) { const li = Math.max(s.lastIndexOf('.'), s.lastIndexOf(',')); const dec = s[li]; s = s.split(dec === '.' ? ',' : '.').join(''); if (dec === ',') s = s.replace(',', '.'); }
  else if (hasC) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (hasD) s = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  const v = parseFloat(s);
  return isFinite(v) ? v : null;
}
const CUR = { TRY: 'TRY', TL: 'TRY', 'TÜRK LIRASI': 'TRY', 'TURKISH LIRA': 'TRY', USD: 'USD', 'US$': 'USD', $: 'USD', 'ABD DOLARI': 'USD', DOLAR: 'USD', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD', 'USD DOLLARS': 'USD',
  EUR: 'EUR', EURO: 'EUR', AVRO: 'EUR', '€': 'EUR', EUROS: 'EUR', GBP: 'GBP', STERLIN: 'GBP', '£': 'GBP' };
const MUL = { BIN: 1e3, THOUSAND: 1e3, MILYON: 1e6, MILLION: 1e6, MN: 1e6, MILYAR: 1e9, BILLION: 1e9, MLR: 1e9 };
const RATE = { TRY: 1, USD: 42, EUR: 49, GBP: 56 };   // yalnız 'en büyük tutar hangisi' seçimi için kaba kur; gerçek oranı terminal günün kuruyla hesaplar
const up = s => String(s || '').toLocaleUpperCase('tr-TR').replace(/İ/g, 'I');   // 'million' → 'MILLION' (Türkçe büyük harfte i → İ olur)
// KAP 'Yeni İş İlişkisi' açıklamasındaki en büyük para tutarı → {v, c} (c: TRY/USD/EUR/GBP) ya da null
export function kesAmount(txt) {
  const t = String(txt || '').replace(/\s+/g, ' ');
  const N = '(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)';
  const C = '(TRY|TL|Türk Lirası|Turkish Lira|ABD Doları|US Dollars?|USD Dollars?|USD|US\\$|\\$|Dolar|EUR|Euros?|Avro|€|GBP|Sterlin|£)';
  const M = '(bin|thousand|milyon|million|mn|milyar|billion|mlr)?';
  const P = [new RegExp(C + '\\s?' + N + '\\s?' + M + '(?![\\w])', 'gi'), new RegExp(N + '\\s?' + M + '\\s?' + C + '(?![\\w])', 'gi')];
  let best = null;
  P.forEach((re, k) => { let m; while ((m = re.exec(t))) {
    const cur = CUR[up(k ? m[3] : m[1])], num = kesNum(k ? m[1] : m[2]), mul = MUL[up(k ? m[2] : m[3]) || ''] || 1;
    if (!cur || num == null || num <= 0) continue;
    const v = num * mul; if (v < 1e4) continue;   // küçük rakamlar (sayfa, adet, yıl) tutar sayılmaz
    if (!best || v * RATE[cur] > best.v * RATE[best.c]) best = { v, c: cur };
  } });
  return best;
}
export async function kesifData(env, force) {
  if (!env.BT) return { ok: false, error: 'D1 yok' };
  if (!force) {
    try { const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'kesif_v'").first(); if (m) { const v = JSON.parse(m.v); if (Date.now() - v.at < TTL) return v; } } catch (e) {}
  }
  const now = Date.now(), out = { ok: true, at: now, is: [], geri: [], tavan: null };
  const seen = new Set();
  // 1) yeni iş — detay metinleri (kaph, dünden geriye); kaph_st (st, kind, idx) indeksi
  try {
    const rs = (await env.BT.prepare("SELECT idx, t, sym, summ, substr(txt, instr(txt, 'oda_ExplanationTextBlock'), 2500) x FROM kaph WHERE st = 1 AND kind = 'is' AND t >= ? ORDER BY idx DESC LIMIT 80")
      .bind(now - 30 * 864e5).all()).results || [];
    rs.forEach(r => { seen.add(r.idx); const a = kesAmount(r.x); out.is.push({ idx: r.idx, t: r.t, sym: r.sym, sum: String(r.summ || '').slice(0, 120), amt: a ? Math.round(a.v) : null, cur: a ? a.c : null }); });
  } catch (e) {}
  // 2) bugün / henüz detayı toplanmamış yeni işler + son 7 günün geri alımları — kap_t indeksi
  try {
    const rs = (await env.BT.prepare("SELECT idx, t, syms, summ, tip FROM kap INDEXED BY kap_t WHERE t >= ? AND tip IN ('is', 'geri') ORDER BY t DESC LIMIT 1500").bind(now - 7 * 864e5).all()).results || [];
    const G = {};
    rs.forEach(r => { const sym = String(r.syms || '').split(',')[0]; if (!sym) return;
      if (r.tip === 'is') { if (!seen.has(r.idx)) { seen.add(r.idx); out.is.push({ idx: r.idx, t: r.t, sym, sum: String(r.summ || '').slice(0, 120), amt: null, cur: null }); } }
      else { const g = G[sym] = G[sym] || { sym, n: 0, last: 0 }; g.n++; if (r.t > g.last) g.last = r.t; } });
    out.geri = Object.values(G).sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 60);
  } catch (e) {}
  out.is.sort((a, b) => b.t - a.t);
  // 3) dün tavan kapananlar (tavan.js tavanScan → meta 'tavan_list')
  try { const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'tavan_list'").first(); if (m) out.tavan = JSON.parse(m.v); } catch (e) {}
  // 4) v13.2 sermaye artırımı (bedelsiz / bedelli / tahsisli, son 30 gün) — 30 günlük kap taraması pahalı (~12 bin satır) → ayrı 6 saatlik önbellek meta 'kesif_sa'
  try {
    let sa = null; const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'kesif_sa'").first();
    if (m) { try { const v = JSON.parse(m.v); if (now - v.at < 6 * 3600e3) sa = v.L; } catch (e) {} }
    if (!sa) {
      const rs = (await env.BT.prepare("SELECT idx, t, syms, summ, tip FROM kap INDEXED BY kap_t WHERE t >= ? AND tip IN ('bedelsiz', 'bedelli', 'tahsisli') ORDER BY t DESC LIMIT 200").bind(now - 30 * 864e5).all()).results || [];
      sa = rs.map(r => ({ idx: r.idx, t: r.t, sym: String(r.syms || '').split(',')[0], tip: r.tip, sum: String(r.summ || '').slice(0, 120) })).filter(x => x.sym);
      await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('kesif_sa', ?)").bind(JSON.stringify({ at: now, L: sa })).run();
    }
    out.sa = sa;
  } catch (e) { out.sa = []; }
  try { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('kesif_v', ?)").bind(JSON.stringify(out)).run(); } catch (e) {}
  return out;
}
