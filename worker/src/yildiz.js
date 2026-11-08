// v14.39 (08.11, Fatih: 'yıldızlı sinyalin ayarlarını elle değiştirebilelim — ±%0,5 yerine ±%1 ya da ±%0,7 gibi')
// ⭐ Yıldız ayarları D1 meta 'yildiz_cfg': band (Algı fiyatına ± %), min (ERKEN AL en az şart / 21), wait (Algı'dan sonra kaç dk izlenir), max (günde en çok yıldızlı mesaj).
// GET /yildiz (DATA) → ayarlar; POST /yildiz-set (yalnız sahip) → kaydeder. Terminal ve ana sunucu (motor) 5 dk'da bir okur.
export const STAR_DEF = { band: 0.5, min: 16, wait: 60, max: 10 };
const lim = (v, a, b, d) => { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
export function starCfg(o) {
  o = o || {};
  return { band: Math.round(lim(o.band, 0.1, 3, STAR_DEF.band) * 100) / 100, min: Math.round(lim(o.min, 10, 21, STAR_DEF.min)), wait: Math.round(lim(o.wait, 5, 240, STAR_DEF.wait)), max: Math.round(lim(o.max, 1, 30, STAR_DEF.max)) };
}
async function starGet(env) {
  try { const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'yildiz_cfg'").first(); return starCfg(m ? JSON.parse(m.v) : null); } catch (e) { return starCfg(null); }
}
export async function yildizRoute(route, request, env, json) {
  if (route === 'yildiz-set') {
    if (request.method !== 'POST') return json({ ok: false, error: 'POST' }, 400);
    let b; try { b = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
    const c = starCfg({ ...(await starGet(env)), ...b });
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('yildiz_cfg', ?)").bind(JSON.stringify({ ...c, at: Date.now() })).run();
    return json({ ok: true, cfg: c });
  }
  return json({ ok: true, cfg: await starGet(env) });
}
