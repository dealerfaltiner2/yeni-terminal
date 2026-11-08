// 09.11: TradingView alarmları — (1) webhook alıcısı /<ACCESS_KEY>/tvalert, (2) alarm servisine deneme çağrısı (probe 'tva_call').
// Alarm kurma TradingView'un resmî API'si değil; sitenin kendi kullandığı pricealerts servisi, kullanıcının oturum çereziyle.

export async function tvAlertHook(request, env, json) {
  if (request.method !== 'POST') return json({ ok: true, bilgi: 'TradingView webhook alıcısı' });
  let b = ''; try { b = (await request.text()).slice(0, 2000); } catch (e) {}
  if (env.BT) try {
    const q = await env.BT.prepare("SELECT v FROM meta WHERE k = 'tvalert_log'").first();
    let L = []; try { L = q ? JSON.parse(q.v) : []; } catch (e) {}
    L.push({ t: Date.now(), b }); L = L.slice(-60);
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tvalert_log', ?)").bind(JSON.stringify(L)).run();
  } catch (e) {}
  return json({ ok: true });
}

// meta 'tva_req' = {m: 'GET'|'POST', p: '/list_alerts', b: {...}} → https://pricealerts.tradingview.com + p (yalnız bu sunucu)
export async function tvAlertCall(env, UA) {
  const q = await env.BT.prepare("SELECT v FROM meta WHERE k = 'tva_req'").first();
  if (!q) return 'tva_req yok';
  const R = JSON.parse(q.v), p = String(R.p || '/list_alerts');
  if (!/^\/[a-z_]+(\?[\w=&.%-]*)?$/.test(p)) return 'geçersiz yol';
  let c = env.TV_SESSION ? 'sessionid=' + env.TV_SESSION : ''; if (env.TV_SESSION_SIGN) c += '; sessionid_sign=' + env.TV_SESSION_SIGN;
  const body = R.b ? JSON.stringify(R.b).replace(/__HOOK__/g, 'https://api.altinerpano.com/' + env.ACCESS_KEY + '/tvalert') : undefined;
  const r = await fetch('https://pricealerts.tradingview.com' + p, { method: R.m === 'POST' ? 'POST' : 'GET', body,
    headers: { Cookie: c, Origin: 'https://www.tradingview.com', Referer: 'https://www.tradingview.com/', 'User-Agent': UA, 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  const t = await r.text();
  return r.status + ' ' + t.slice(0, 8000).split(env.ACCESS_KEY || '§§').join('KEY');
}
