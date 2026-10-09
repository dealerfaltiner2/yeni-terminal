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
    ['tavan', async () => { const r = await scanRaw(env, JSON.stringify({ filter: [{ left: 'change', operation: 'egreater', right: 9.4 }, { left: 'type', operation: 'equal', right: 'stock' }], columns: ['name', 'close', 'change', 'high', 'volume'], sort: { sortBy: 'change', sortOrder: 'desc' }, range: [0, 40] }), 'turkey'); return r.status + ' ' + (await r.text()).slice(0, 600); }],
    ['glob', () => sc('global', ['CME_MINI:ES1!', 'TVC:DXY', 'TVC:UKOIL', 'TVC:US10Y'], ['name', 'close', 'change'])],
    // 10.10: KAP bildirim detayı (tutar / alış-satış ayrımı) ve geçmiş gün listesi alınabiliyor mu?
    ...[['kapd_att', 'https://www.kap.org.tr/tr/api/notification/attachment-detail/1672532'], ['kapd_html', 'https://www.kap.org.tr/tr/Bildirim/1672532'],
      ['kapd_ins', 'https://www.kap.org.tr/tr/api/notification/attachment-detail/1678661'], ['kapd_ins_html', 'https://www.kap.org.tr/tr/Bildirim/1678661']].map(([k, u]) => [k, async () => {
      const r = await fetch(u, { headers: { Accept: 'application/json, text/html', Referer: 'https://www.kap.org.tr/tr/bildirim-sorgu', 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
      const t = await r.text(), i = Math.max(0, t.search(/[Tt]utar|TUTAR|[Ss]atış|[Aa]lış/));
      return r.status + ' ' + (r.headers.get('content-type') || '') + ' len=' + t.length + ' | BAŞ: ' + t.slice(0, 700) + ' | ORTA: ' + t.slice(i, i + 1500); }]),
    ['kap_hist', async () => {
      const r = await fetch('https://www.kap.org.tr/tr/api/disclosure/members/byCriteria', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: 'https://www.kap.org.tr/tr/bildirim-sorgu', Origin: 'https://www.kap.org.tr', 'User-Agent': UA },
        body: JSON.stringify({ fromDate: '2025-10-15', toDate: '2025-10-15', mkkMemberOidList: [], subjectList: [] }), signal: AbortSignal.timeout(10000) });
      const t = await r.text(); return r.status + ' len=' + t.length + ' yeniİş=' + (t.match(/Yeni İş İlişkisi/g) || []).length + ' | ' + t.slice(0, 900); }],
    ...['earnings_release_next_date', 'earnings_release_date', 'ex_dividend_date_upcoming', 'dividends_yield_current', 'Recommend.All'].map(c => ['col_' + c, () => sc('turkey', ['BIST:THYAO', 'BIST:ASELS', 'BIST:EREGL'], ['name', c])])
  ];
  const i = parseInt(q.v, 10) || 0;
  if (i >= L.length) { await env.BT.prepare("DELETE FROM meta WHERE k = 'probe_req'").run(); return null; }
  await env.BT.prepare("UPDATE meta SET v = ? WHERE k = 'probe_req'").bind(String(i + 1)).run();
  let res; try { res = await L[i][1](); } catch (e) { res = 'HATA ' + String(e && e.message || e).slice(0, 150); }
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)").bind('probe:' + L[i][0], res).run();
  return res;
}
