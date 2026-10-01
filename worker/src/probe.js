// Tek seferlik deneme: D1 meta 'probe_req' varsa çalışır, sonucu 'probe_res'e yazar, isteği siler.
// (Yeni TradingView kaynaklarını sunucudan denemek için; normal çalışmada hiçbir şey yapmaz.)
export async function probe(env, scanRaw, UA) {
  const q = await env.BT.prepare("SELECT v FROM meta WHERE k = 'probe_req'").first();
  if (!q) return null;
  await env.BT.prepare("DELETE FROM meta WHERE k = 'probe_req'").run();
  const out = {};
  const T = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = 'HATA ' + String(e && e.message || e).slice(0, 150); } };
  const from = new Date(Date.now() - 864e5).toISOString(), to = new Date(Date.now() + 3 * 864e5).toISOString();
  await T('ecal', async () => {
    const r = await fetch('https://economic-calendar.tradingview.com/events?from=' + from + '&to=' + to + '&countries=TR,US&minImportance=0',
      { headers: { Origin: 'https://www.tradingview.com', Referer: 'https://www.tradingview.com/', 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    const t = await r.text(); return r.status + ' ' + t.slice(0, 900);
  });
  const sc = async (market, tickers, cols) => { const r = await scanRaw(env, JSON.stringify({ symbols: { tickers, query: { types: [] } }, columns: cols }), market); return r.status + ' ' + (await r.text()).slice(0, 400); };
  await T('viop_tr', () => sc('turkey', ['BIST:XU030D1!', 'BIST:XU030D2!'], ['name', 'close', 'change', 'update_mode', 'description']));
  await T('viop_fut', () => sc('futures', ['BIST:XU030D1!'], ['name', 'close', 'change', 'update_mode']));
  await T('glob', () => sc('global', ['CME_MINI:ES1!', 'TVC:DXY', 'TVC:UKOIL', 'TVC:US10Y'], ['name', 'close', 'change']));
  for (const c of ['earnings_release_next_date', 'earnings_release_date', 'ex_dividend_date_upcoming', 'dividend_ex_date_upcoming', 'dividends_yield_current', 'price_earnings_ttm', 'Recommend.All'])
    await T('col_' + c, () => sc('turkey', ['BIST:THYAO', 'BIST:ASELS', 'BIST:EREGL'], ['name', c]));
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('probe_res', ?)").bind(new Date().toISOString() + ' ' + JSON.stringify(out)).run();
  return out;
}
