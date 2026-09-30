// v7.2 HATA DEFTERİ — terminal (/errlog) ve sunucu hataları + kendini toparlama kayıtları. Akşam bakımı buradan okur.
// Aynı gün + kaynak + tür + mesaj + yer tek satırdır; tekrarında sayaç (n) artar. 'fixed' = bakımın düzelttiği işaret.
const TRMS = 3 * 3600e3;
const trDay = ms => new Date(ms + TRMS).toISOString().slice(0, 10);
let ready = false;
async function errEnsure(env) {
  if (ready) return;
  await env.BT.batch([
    env.BT.prepare('CREATE TABLE IF NOT EXISTS err (id INTEGER PRIMARY KEY AUTOINCREMENT, d TEXT, t INTEGER, src TEXT, kind TEXT, msg TEXT, loc TEXT, tab TEXT, ver TEXT, dev TEXT, n INTEGER DEFAULT 1, fixed TEXT, UNIQUE(d, src, kind, msg, loc))'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS err_d ON err(d)')
  ]);
  ready = true;
}
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
export async function errAdd(env, src, kind, msg, loc, extra) {
  try {
    if (!env.BT || !msg) return;
    await errEnsure(env);
    const now = Date.now(), x = extra || {};
    await env.BT.prepare('INSERT INTO err (d,t,src,kind,msg,loc,tab,ver,dev) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(d, src, kind, msg, loc) DO UPDATE SET n = err.n + 1, t = excluded.t')
      .bind(trDay(now), now, clip(src, 12), clip(kind, 12), clip(msg, 300), clip(loc, 120), clip(x.tab, 16), clip(x.ver, 10), clip(x.dev, 32)).run();
  } catch (e) {}
}
// POST /errlog  {items:[{k,m,w,tab,v}]} — çalışma başına en çok 20 kayıt
export async function errLogRoute(request, env, url, json) {
  let b = {};
  try { const t = await request.text(); if (t.length > 20000) return json({ ok: false }, 413); b = JSON.parse(t || '{}'); } catch (e) { return json({ ok: false }, 400); }
  const items = Array.isArray(b.items) ? b.items.slice(0, 20) : [];
  const dev = String(url.searchParams.get('dev') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
  for (const it of items) {
    const kind = it && it.k === 'toparlama' ? 'toparlama' : 'hata';
    await errAdd(env, 'terminal', kind, it && it.m, it && it.w, { tab: it && it.tab, ver: it && it.v, dev });
  }
  return json({ ok: true, n: items.length });
}
