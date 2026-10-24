// v14.10 (24.10, Fatih: 'bütün Algı sinyalleri herkeste aynı olsun') ALGI RADARI TEK KAYNAK:
// Ana sunucu (motor) 20 sn'de bir kendi radar satırlarını (en çok 30) POST /algirows-set (sahip) ile yollar → D1 meta 'algi_rows' {at, rows}.
// Telefonlar GET /algirows (DATA, cihaz onayı) ile aynı listeyi okur; çalışma örneği belleğinde 10 sn önbellek. Dakikalık işe sorgu YOK.
let cache = { at: 0, v: null };
const MAXB = 60000;
export function algiRowsClean(rows) {
  if (!Array.isArray(rows)) return [];
  const n = v => (v == null || !isFinite(+v) ? null : +(+v).toFixed(3));
  return rows.slice(0, 30).filter(r => r && /^[A-Z0-9.]{2,12}$/.test(String(r.s || ''))).map(r => {
    const f = r.f || {}, o = r.o || {};
    return { s: String(r.s), sc: n(r.sc) || 0, stage: ['ates', 'hazir', 'uyanis'].includes(r.stage) ? r.stage : '', g: n(r.g) || 0,
      f: { fa: n(f.fa), rv: n(f.rv), fc: n(f.fc), mv5: n(f.mv5), ch: n(f.ch), upD: n(f.upD), fd: !!f.fd, fe: !!f.fe, brk: !!f.brk, late: !!f.late },
      o: { voltl: n(o.voltl) } };
  });
}
export async function algiRowsSet(request, env, json) {
  if (!env.BT) return json({ ok: false, error: 'D1 yok' }, 500);
  const txt = await request.text();
  if (txt.length > MAXB) return json({ ok: false, error: 'çok büyük' }, 413);
  let b = null; try { b = JSON.parse(txt); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
  const v = { at: Date.now(), rows: algiRowsClean(b && b.rows) };
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('algi_rows', ?)").bind(JSON.stringify(v)).run();
  cache = { at: Date.now(), v };
  return json({ ok: true, n: v.rows.length });
}
export async function algiRowsGet(env, json, anon) {
  if (anon) return json({ ok: true, at: 0, rows: [], uye: 1 });
  if (cache.v && Date.now() - cache.at < 10e3) return json({ ok: true, ...cache.v });
  let v = { at: 0, rows: [] };
  if (env.BT) { try { const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'algi_rows'").first(); if (r) v = JSON.parse(r.v); } catch (e) {} }
  cache = { at: Date.now(), v };
  return json({ ok: true, ...v });
}
