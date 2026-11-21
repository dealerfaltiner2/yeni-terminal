// v15.20 (21.11, Fatih: 'BIST Pusula'ya duyurular ekle, orada görünsün') DUYURULAR
// D1 meta 'duyuru' = JSON dizi [{id, t, tag, ic, baslik, ozet, bloklar:[{p}|{li:[…]}|{adim:[[durum,baslik,metin]…]}|{not}] }]
// Yeni duyuru için yayın GEREKMEZ: meta satırı güncellenir (terminal 10 dk'da bir okur). Terminalde yerleşik duyurular da var (DUY_DEF), aynı id sunucudakiyle ezilir.
// GET /duyuru (DATA) → { ok, list } — 60 sn bellek önbelleği. Metin düz yazı; terminal htmlEsc + **kalın** uygular.
const S = (x, n) => String(x == null ? '' : x).slice(0, n);
const TAGS = ['Yeni', 'Yakında', 'Bilgi', 'Önemli', 'Güncelleme'];
const ADIM = ['bitti', 'simdi', 'sonra'];
export function duyClean(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const d of arr.slice(0, 30)) {
    if (!d || typeof d !== 'object' || !d.id || !d.baslik) continue;
    const bl = [];
    for (const b of (Array.isArray(d.bloklar) ? d.bloklar : []).slice(0, 20)) {
      if (!b || typeof b !== 'object') continue;
      if (b.p != null) bl.push({ p: S(b.p, 1500) });
      else if (b.not != null) bl.push({ not: S(b.not, 600) });
      else if (b.h != null) bl.push({ h: S(b.h, 80) });
      else if (Array.isArray(b.li)) bl.push({ li: b.li.slice(0, 12).map(x => S(x, 400)) });
      else if (Array.isArray(b.adim)) bl.push({ adim: b.adim.slice(0, 8).filter(Array.isArray).map(a => [ADIM.includes(a[0]) ? a[0] : 'sonra', S(a[1], 80), S(a[2], 300)]) });
    }
    out.push({ id: S(d.id, 40), t: +d.t || 0, tag: TAGS.includes(d.tag) ? d.tag : 'Bilgi', ic: S(d.ic || '📣', 4), baslik: S(d.baslik, 120), ozet: S(d.ozet, 400), bloklar: bl, gizle: !!d.gizle });
  }
  return out.sort((a, b) => b.t - a.t);
}
let MEM = null;
export async function duyuruRoute(env, json) {
  if (MEM && Date.now() - MEM.at < 60000) return json({ ok: true, list: MEM.list });
  let list = [];
  try { const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'duyuru'").first(); if (m && m.v) list = duyClean(JSON.parse(m.v)); } catch (e) { list = []; }
  MEM = { at: Date.now(), list };
  return json({ ok: true, list });
}
