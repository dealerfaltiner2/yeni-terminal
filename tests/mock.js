// Sahte piyasa/sunucu verisi: TradingView tarayıcı yanıtı, /kap, /sigstats, /errlog, /hello
const SY = ['THYAO','ASELS','KONTR','SASA','EREGL','TUPRS','BIMAS','KCHOL','GARAN','PGSUS','AKBNK','YKBNK','SISE','FROTO','TOASO','HEKTS','ALARK','ENKAI','PETKM','TCELL','ASTOR','MGROS','ULKER','DOAS','OYAKC','CIMSA','EKGYO','ISCTR','KOZAL','SAHOL','VESTL','ARCLK','TAVHL','GUBRF','ODAS','SMRTG','CANTE','KRDMD','TTKOM','AEFES'];
const SEC = ['Ulaştırma','Elektronik Teknoloji','Enerji','Kimya','Metal','Finans','Perakende','Holding'];
let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
function val(c, sym, i) {
  const L = c.toLowerCase(); const px = 20 + ((i * 37) % 300);
  if (L === 'name') return sym; if (L === 'description') return sym + ' A.Ş.'; if (L === 'type') return 'stock'; if (L === 'subtype') return 'common';
  if (L.includes('sector')) return SEC[i % SEC.length]; if (L.includes('industry')) return 'Sanayi'; if (L === 'logoid') return null; if (L.includes('currency')) return 'TRY'; if (L === 'exchange') return 'BIST';
  if (L.startsWith('close') || L.startsWith('open') || L.startsWith('vwap') || L.startsWith('ema') || L.startsWith('sma') || L.startsWith('bb.') || L.startsWith('high') || L.startsWith('low') || L.startsWith('price_52') || L.includes('pivot') || L === 'ask' || L === 'bid' || L.includes('limit')) {
    let m = 1; if (L.startsWith('high')) m = 1.02; if (L.startsWith('low')) m = .98; if (L.includes('upper')) m = L.includes('upperlimit') ? 1.1 : 1.015; if (L.includes('lower')) m = L.includes('lowerlimit') ? .9 : .985;
    if (L.includes('ema200')) m = .9; if (L.includes('ema50')) m = .96; if (L.includes('ema20')) m = .985; if (L.includes('high_52')) m = 1.05; if (L.includes('low_52')) m = .6; if (L === 'ask') m = 1.001; if (L === 'bid') m = .999;
    return +(px * m * (1 + (rnd() - .5) * .01)).toFixed(2);
  }
  if (L.startsWith('change')) return +((rnd() - .4) * 7).toFixed(2); if (L.startsWith('volume')) return Math.round(1e6 + rnd() * 6e7); if (L.includes('relative_volume')) return +(0.5 + rnd() * 3).toFixed(2);
  if (L.startsWith('rsi')) return 35 + rnd() * 40; if (L.startsWith('adx')) return 12 + rnd() * 30; if (L.startsWith('atr')) return px * (.01 + rnd() * .03); if (L.startsWith('macd')) return (rnd() - .4) * 2; if (L.startsWith('stoch')) return rnd() * 100; if (L.startsWith('perf')) return (rnd() - .4) * 12;
  if (L.includes('market_cap')) return Math.round((50 - i) * 5e9); if (L.includes('earnings')) return null; return +(rnd() * 10).toFixed(2);
}
const now = Date.now();
const KAP = { ok: true, list: [
  { idx: 1670001, t: now - 36e5, syms: 'ASELS', title: 'ASELSAN', subj: 'Yeni İş İlişkisi', summ: 'Yurt dışı müşteri ile sözleşme', tip: 'is', ad: 'Yeni iş/sözleşme', yon: 1, onem: 3, olcum: { pre: .4, r15: 1.2, r60: 2.1, rc: 2.8, mfe: 3.4, o10: 1 } },
  { idx: 1670002, t: now - 72e5, syms: 'SASA', title: 'SASA', subj: 'Pay Geri Alım', summ: 'Geri alım', tip: 'geri', ad: 'Geri alım', yon: 1, onem: 2, olcum: null },
  { idx: 1670003, t: now - 6e5, syms: 'KONTR', title: 'KONTR', subj: 'Test <img src=x onerror="window.__XSS=1">', summ: '<b>kalın</b>', tip: 'is', ad: 'Yeni iş', yon: 1, onem: 3, olcum: null }] };
const day = k => new Date(now - k * 864e5).toISOString().slice(0, 10);
const SIG = { ok: true, at: now, gun: 3, bekleyen: 0, last: day(0),
  src: { 'firsat-A': { n: 5, h: 2, s: 3 }, 'firsat-B': { n: 8, h: 5, s: 2 }, algi: { n: 4, h: 3, s: 1 }, radar: { n: 9, h: 4, s: 5 }, 'kap-geri': { n: 20, h: 9, s: 8 } },
  days: [0, 1, 2].map(k => ({ d: day(k), src: { 'firsat-B': { n: 3, h: 2, s: 1 }, radar: { n: 3, h: 1, s: 2 } } })),
  list: [{ t: now - 3e6, src: 'algi', sym: 'KCHOL', o10: 1, mfe: 1.4, rc: .8 }] };
function install(page, opt = {}) {
  const hits = { errlog: [], all: 0, urls: [] };
  return page.route(/^https?:\/\//, async r => {
    const u = r.request().url(); hits.all++; hits.urls.push(u);
    if (opt.nolib && /unpkg|cdnjs|jsdelivr/.test(u)) return r.abort();
    if (/unpkg\.com\/lightweight-charts/.test(u)) return r.fulfill({ path: require('path').join(__dirname,'node_modules','lightweight-charts','dist','lightweight-charts.standalone.production.js'), contentType: 'application/javascript' });
    if (/cdnjs\.cloudflare\.com\/ajax\/libs\/d3/.test(u)) return r.fulfill({ path: require('path').join(__dirname,'node_modules','d3','dist','d3.min.js'), contentType: 'application/javascript' });
    if (!/x\.test|scanner\.tradingview\.com/.test(u)) return r.abort();
    if (opt.fail) return r.fulfill({ status: 500, body: 'err' });
    if (u.includes('/errlog')) { try { hits.errlog.push(...(JSON.parse(r.request().postData() || '{}').items || [])); } catch (e) {} return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
    if (u.includes('/owner-check')) { const own = /[?&]own=sahipkodu/.test(u); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, claimed: true, owner: own }) }); }
    if (u.includes('/hello')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, blocked: false, wait: false, bot: !!opt.bot }) });
    if (u.includes('/pair-create')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, code: 'ABCDE-FGH23', exp: Date.now() + 9e5 }) });
    if (u.includes('/paper')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, cfg: { amt: 20000, cap: 100000, max: 5, srcs: ['algi', 'momentum'], algiG: false, slip: 0.1, start: '2026-09-29' }, tot: { n: 3, w: 2, l: 1, z: 0, kar: 2, pl: 140, pct: 0.14, dd: -220, gun: 2, iyi: 1 }, days: [{ d: '2026-10-02', n: 2, w: 2, l: 0, z: 0, pl: 360 }, { d: '2026-10-01', n: 1, w: 0, l: 1, z: 0, pl: -220 }], trades: [{ d: '2026-10-02', t: 1790928401388, src: 'algi', sym: 'THYAO', px: 287.75, lot: 69, res: 'hedef', pct: 0.9, pl: 179 }], open: [{ t: Date.now(), src: 'momentum', sym: 'ASELS', px: 100, lot: 200, K: 1.5 }], pend: 0, bySrc: { algi: { n: 2, w: 2, l: 0, z: 0, pl: 360 }, radar: { n: 4, w: 1, l: 3, z: 0, pl: -500 } } }) });
    if (u.includes('/sigstats')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(SIG) });
    if (u.includes('/kap')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(KAP) });
    if (u.includes('scan')) {
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      const cols = body.columns || []; const tk = body.symbols && body.symbols.tickers; const tick = tk && tk.length ? tk : SY.map(s => 'BIST:' + s);
      const data = tick.map((t, i) => { const s = t.split(':')[1]; const ix = SY.indexOf(s); return { s: t, d: cols.map(c => val(c, s, ix < 0 ? i : ix)) }; });
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ totalCount: data.length, data }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
  }).then(() => hits);
}
module.exports = { install };
