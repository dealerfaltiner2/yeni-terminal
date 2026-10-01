// v7.7 EKONOMİK TAKVİM: TradingView ekonomik takvimi (Türkiye: önemli+orta, ABD: yalnız önemli).
// 30 dakikada bir çekilir, D1 meta 'ecal' (sade liste) ; terminal /ecal ile okur. Sinyal mantığına dokunmaz.
const H = UA => ({ Origin: 'https://www.tradingview.com', Referer: 'https://www.tradingview.com/', 'User-Agent': UA });
export async function ecalPoll(env, UA, force) {
  const at = await env.BT.prepare("SELECT v FROM meta WHERE k = 'ecal_at'").first();
  if (!force && at && Date.now() - +at.v < 30 * 60e3) return null;
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('ecal_at', ?)").bind(String(Date.now())).run();
  const from = new Date(Date.now() - 864e5).toISOString(), to = new Date(Date.now() + 6 * 864e5).toISOString();
  const out = [];
  for (const [c, mi] of [['TR', 0], ['US', 1]]) {
    const r = await fetch('https://economic-calendar.tradingview.com/events?from=' + from + '&to=' + to + '&countries=' + c + '&minImportance=' + mi, { headers: H(UA), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('takvim HTTP ' + r.status);
    const j = await r.json();
    for (const e of (j && j.result) || []) {
      const t = Date.parse(e.date); if (!t || (e.importance ?? 0) < mi) continue;
      out.push({ t, c: e.country, ti: String(e.title || '').slice(0, 80), im: e.importance ?? 0, a: e.actual ?? null, f: e.forecast ?? null, p: e.previous ?? null, u: e.unit || '', sc: e.scale || '' });
    }
  }
  out.sort((a, b) => a.t - b.t);
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('ecal', ?)").bind(JSON.stringify(out.slice(0, 120))).run();
  return { n: out.length };
}
export async function ecalRoute(env, json) {
  const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'ecal'").first();
  let list = []; try { list = r ? JSON.parse(r.v) : []; } catch (e) {}
  return json({ ok: true, list });
}
