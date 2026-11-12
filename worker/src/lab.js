// v15.4 (13.11, Fatih: 'Self-Improving AI Trader' rehberi → 'Araştırma laboratuvarı' önizlemesi → 'beğendim') ARAŞTIRMA LABORATUVARI — yalnız ölçüm/görünüm, sinyal kuralı DEĞİŞMEZ.
// GET /lab (DATA, üyeye boş): sağlamlık tablosu = son 5 haftanın (Pazartesi başlar) karnesi, kaynak × hafta + borsa artı/eksi, işlem başı ort. % (+%3 hedef / −%1 stop, o31 0 ise gün sonu rc; maliyet hariç)
//   + meta 'lab_rapor' (haftalık rapor; zamanlanmış görev 'Pusula araştırma döngüsü' Cumartesi yazar) + meta 'lab_defter' (sürüm defteri, görev yazar).
//   Hesap sig_d indeksiyle ~16k satır → meta 'lab_v' ORTAK önbellek 60 dk (dakikalık işe sorgu YOK).
// POST /lab-karar (sahip) {id, karar: onay|bekle|ret} → lab_rapor.oneri.karar. Onaylanan öneriyi sonraki Cumartesi görevi (GELİŞTİRİCİ kurallarıyla) uygular.
export const LAB_ROWS = [
  ['algi', 'Algı', s => s === 'algi'],
  ['algitg', 'Algı · Telegram', (s, tg) => s === 'algi' && tg],
  ['yildiz', '⭐ Yıldızlı', s => s === 'yildiz'],
  ['firsat-A', 'Fırsat A', s => s === 'firsat-A'],
  ['firsat-B', 'Fırsat B', s => s === 'firsat-B'],
  ['aisec', 'AI Seçtikleri', s => s === 'aisec'],
  ['katman', 'EMA Katman', s => s === 'katman'],
  ['vdpm', 'Delta destek', s => s === 'vdpm'],
  ['momentum', 'Momentum', s => s === 'momentum'],
  ['kap-geri', 'Geri alım', s => s === 'kap-geri'],
  ['kap', 'Diğer KAP', s => /^kap-/.test(s) && s !== 'kap-geri' && s !== 'kap-devre'],
  ['tavan6', 'Tavan açılış', s => s === 'tavan6'],
  ['gece', 'Gece Kuşu', s => s === 'gece']
];
export const LAB_MIN = 10;   // bir hücre için en az sinyal (altı 'az')
const DAY = 86400e3;
const ist = t => new Date(t + 3 * 3600e3);
export const trDay = t => ist(t).toISOString().slice(0, 10);
// İstanbul'a göre bu haftanın Pazartesi'si, n hafta geriye
export function weekStarts(now, n) {
  const d = ist(now), wd = (d.getUTCDay() + 6) % 7, mon = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - wd * DAY, out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(mon - i * 7 * DAY).toISOString().slice(0, 10));
  return out;
}
const r2 = v => Math.round(v * 100) / 100;
// R: [{src, d, up (1/0/null), tg (1/0), n, s (toplam %)}] — saf
export function labCalc(R, weeks) {
  const W = weeks.length, rows = LAB_ROWS.map(([k, ad]) => ({ k, ad, w: Array.from({ length: W }, () => ({ n: 0, s: 0 })), up: { n: 0, s: 0 }, dn: { n: 0, s: 0 } }));
  for (const x of R) {
    let wi = -1; for (let i = W - 1; i >= 0; i--) if (x.d >= weeks[i]) { wi = i; break; }
    if (wi < 0) continue;
    LAB_ROWS.forEach(([, , f], i) => {
      if (!f(x.src, !!x.tg)) return; const o = rows[i];
      o.w[wi].n += x.n; o.w[wi].s += x.s;
      if (x.up === 1) { o.up.n += x.n; o.up.s += x.s; } else if (x.up === 0) { o.dn.n += x.n; o.dn.s += x.s; }
    });
  }
  const fin = c => (c.n ? { n: c.n, r: r2(c.s / c.n) } : null);
  return rows.map(o => ({ k: o.k, ad: o.ad, w: o.w.map(fin), up: fin(o.up), dn: fin(o.dn) })).filter(o => o.w.some(Boolean));
}
// Pusula'nın okuması — kurala dayalı, en çok 3 madde (görev raporunda 'okuma' varsa o kullanılır)
export function labRead(rows) {
  const out = [], ok = c => c && c.n >= LAB_MIN;
  const full = rows.map(o => ({ o, v: o.w.filter(ok) })).filter(x => x.v.length >= 3);
  const allPos = full.filter(x => x.v.every(c => c.r > 0)), allNeg = full.filter(x => x.v.every(c => c.r < 0));
  if (allPos.length) out.push('**' + allPos.map(x => x.o.ad).join(', ') + '** ölçülen her haftada artı (' + allPos[0].v.length + ' hafta).');
  else if (full.length) out.push('Hiçbir kaynak ölçülen her haftada artı değil. **Tek iyi hafta** karar için yetmez.');
  for (const x of allNeg.slice(0, 2)) out.push('**' + x.o.ad + '** ölçülen ' + x.v.length + ' haftanın hepsinde eksi.');
  const turn = full.filter(x => { const v = x.v, n = v.length; return n >= 4 && v[n - 1].r > 0 && v[n - 2].r > 0 && v.slice(0, n - 2).every(c => c.r < 0); });
  if (turn.length && out.length < 3) out.push('**' + turn.map(x => x.o.ad).join('** ve **') + '** son 2 hafta artıya döndü, önceki haftalar eksiydi; birkaç hafta daha izlenmeli.');
  return out.slice(0, 3);
}
async function metaGet(env, k) { try { const m = await env.BT.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first(); return m ? JSON.parse(m.v) : null; } catch (e) { return null; } }
async function metaSet(env, k, v) { await env.BT.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind(k, JSON.stringify(v)).run(); }
let mem = { at: 0, v: null };
export async function labData(env, now = Date.now(), force = false) {
  if (!force && mem.v && now - mem.at < 60e3) return mem.v;
  const weeks = weekStarts(now, 5);
  let tab = force ? null : await metaGet(env, 'lab_v');
  if (!tab || now - (tab.at || 0) > 60 * 60e3 || tab.w0 !== weeks[0]) {
    const R = (await env.BT.prepare("SELECT src, d, CASE WHEN idx IS NULL THEN NULL WHEN idx > 0 THEN 1 ELSE 0 END up, CASE WHEN json_extract(meta, '$.tg') = 1 THEN 1 ELSE 0 END tg, count(*) n, sum(CASE o31 WHEN 1 THEN 3 WHEN 2 THEN -1 ELSE coalesce(rc, 0) END) s FROM sig INDEXED BY sig_d WHERE d >= ? AND o31 IS NOT NULL AND err IS NULL AND (dir IS NULL OR dir != 'SAT') GROUP BY src, d, up, tg").bind(weeks[0]).all()).results || [];
    const rows = labCalc(R, weeks);
    tab = { at: now, w0: weeks[0], weeks, rows, okuma: labRead(rows) };
    try { await metaSet(env, 'lab_v', tab); } catch (e) {}
  }
  const v = { ...tab, rapor: await metaGet(env, 'lab_rapor'), defter: (await metaGet(env, 'lab_defter')) || [] };
  mem = { at: now, v };
  return v;
}
export const KARAR = { onay: 'Onaylandı', bekle: 'Bekletiliyor', ret: 'Reddedildi' };
export async function labRoute(route, request, env, json, anon) {
  if (route === 'lab-karar') {
    if (request.method !== 'POST') return json({ ok: false, error: 'POST' }, 400);
    let b; try { b = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
    if (!KARAR[b.karar]) return json({ ok: false, error: 'karar onay | bekle | ret olmalı' }, 400);
    const r = await metaGet(env, 'lab_rapor');
    if (!r || !r.oneri || (b.id && r.oneri.id && b.id !== r.oneri.id)) return json({ ok: false, error: 'öneri bulunamadı' }, 404);
    r.oneri.karar = b.karar; r.oneri.karar_t = Date.now();
    await metaSet(env, 'lab_rapor', r); mem = { at: 0, v: null };
    return json({ ok: true, karar: b.karar });
  }
  if (anon) return json({ ok: true, uye: 1, rows: [] });
  try { return json({ ok: true, ...(await labData(env)) }); } catch (e) { return json({ ok: false, error: String(e.message || e).slice(0, 120) }); }
}
