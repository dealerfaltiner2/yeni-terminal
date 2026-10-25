// v14.12 (25.10, Fatih: 'BIST 100'de 600 hisse mi var?' → ekranda BIST 100 ile tüm borsa ayrı yazılsın)
// Güncel endeks üyeleri D1 meta 'idx_list' {at, kaynak, x100:[...], x30:[...]}.
// DİKKAT: eski meta 'xu100' araştırma (btStep / feat) listesidir — ona DOKUNMA (değişirse btStep yeni hisselerin mumlarını çekmeye başlar).
// Liste yılda 4 kez değişir (Ocak/Nisan/Temmuz/Ekim başı); güncellemek için idx_list satırını yeni listeyle yaz.
let cache = { at: 0, v: null };

export async function idxList(env) {
  if (cache.v && Date.now() - cache.at < 30 * 60e3) return cache.v;
  let v = null;
  try { const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'idx_list'").first(); if (r) v = JSON.parse(r.v); } catch (e) {}
  if (!v || !Array.isArray(v.x100)) v = { at: 0, x100: [], x30: [] };
  cache = { at: Date.now(), v };
  return v;
}

export async function endeksRoute(env, json) {
  const v = await idxList(env);
  return json({ ok: true, at: v.at || 0, x100: v.x100 || [], x30: v.x30 || [] });
}

// Saf fonksiyon: tarama satırlarından (s = 'BIST:KOD', d[1] = değişim %) yükselen / düşen / değişmeyen sayısı
export function idxBreadth(rows) {
  let nu = 0, nd = 0, n0 = 0;
  for (const x of rows || []) {
    const ch = x && x.d ? x.d[1] : null;
    if (ch == null || !isFinite(ch)) continue;
    if (ch > 0) nu++; else if (ch < 0) nd++; else n0++;
  }
  return { nu, nd, n0, n: nu + nd + n0 };
}

// Kapanış özeti için: BIST 100 üyelerinin bugünkü yükselen / düşen sayısı (tek tarama, 100 kod)
export async function idxBreadthScan(env, scanRaw) {
  const v = await idxList(env);
  if (!v.x100 || v.x100.length < 50) return null;
  const r = await scanRaw(env, JSON.stringify({ symbols: { tickers: v.x100.map(s => 'BIST:' + s) }, columns: ['name', 'change'] }));
  const j = await r.json();
  const b = idxBreadth(j && j.data);
  return b.n >= 50 ? b : null;
}
