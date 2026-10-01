// Tek seferlik deneme: D1 meta 'probe_req' varsa her dakika BİR deneme yapar, sonucu 'probe:<ad>' satırına yazar.
// (Yeni TradingView kaynaklarını sunucudan denemek için; istek yokken hiçbir şey yapmaz.)
export async function probe(env, scanRaw, UA) {
  const q = await env.BT.prepare("SELECT v FROM meta WHERE k = 'probe_req'").first();
  if (!q) return null;
  const from = new Date(Date.now() - 864e5).toISOString(), to = new Date(Date.now() + 3 * 864e5).toISOString();
  const sc = async (market, tickers, cols) => { const r = await scanRaw(env, JSON.stringify({ symbols: { tickers, query: { types: [] } }, columns: cols }), market); return r.status + ' ' + (await r.text()).slice(0, 400); };
  const L = [
    ['ecal', async () => { const r = await fetch('https://economic-calendar.tradingview.com/events?from=' + from + '&to=' + to + '&countries=TR,US&minImportance=0', { headers: { Origin: 'https://www.tradingview.com', Referer: 'https://www.tradingview.com/', 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }); return r.status + ' ' + (await r.text()).slice(0, 900); }],
    ['viop_tr', () => sc('turkey', ['BIST:XU030D1!', 'BIST:XU030D2!'], ['name', 'close', 'change', 'update_mode', 'description'])],
    ['viop_fut', () => sc('futures', ['BIST:XU030D1!'], ['name', 'close', 'change', 'update_mode'])],
    ['glob', () => sc('global', ['CME_MINI:ES1!', 'TVC:DXY', 'TVC:UKOIL', 'TVC:US10Y'], ['name', 'close', 'change'])],
    ...['earnings_release_next_date', 'earnings_release_date', 'ex_dividend_date_upcoming', 'dividends_yield_current', 'Recommend.All'].map(c => ['col_' + c, () => sc('turkey', ['BIST:THYAO', 'BIST:ASELS', 'BIST:EREGL'], ['name', c])])
  ];
  const i = parseInt(q.v, 10) || 0;
  if (i >= L.length) { await env.BT.prepare("DELETE FROM meta WHERE k = 'probe_req'").run(); return null; }
  await env.BT.prepare("UPDATE meta SET v = ? WHERE k = 'probe_req'").bind(String(i + 1)).run();
  let res; try { res = await L[i][1](); } catch (e) { res = 'HATA ' + String(e && e.message || e).slice(0, 150); }
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)").bind('probe:' + L[i][0], res).run();
  return res;
}
