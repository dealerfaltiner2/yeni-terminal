// BIST TV Köprüsü v5.3 — Cloudflare Worker (bist-tv)
// Yayın: GitHub → Cloudflare Workers Builds (otomatik). Kodu burada değiştir, Cloudflare editöründe değil.
// Secrets: TV_SESSION, TV_SESSION_SIGN, ACCESS_KEY
// Terminal ayarı: wss://bist-tv.c8jmvhdm8c.workers.dev/ACCESS_KEY
// v3: WebSocket bağlantısı anında kabul edilir, TradingView'e arkada bağlanılır.
// v4: /bars — TradingView'den gerçek zamanlı mum verisi (tek bağlantıda 8 hisseye kadar, kısa önbellekli).
// v5: 7/24 sunucu — dakikada bir (Cron) alarm, radar, KAP/haber ve bağlantı sağlığı kontrolü, Telegram bildirimi.
//     Gerekenler: KV bağlaması "DB" + Cron tetikleyici "* * * * *". Ayarlar terminalden /sync ile gelir.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const SCAN_COLS = ['name', 'close', 'change', 'change_abs', 'volume', 'high', 'low', 'open'];
const TFS = ['1', '3', '5', '15', '30', '45', '60', '120', '180', '240', '1D', '1W', '1M'];
let authCache = { token: null, t: 0, err: null };
const barCache = new Map();

const frame = s => `~m~${s.length}~m~${s}`;
const msg = (m, p) => frame(JSON.stringify({ m, p }));
const txt = d => typeof d === 'string' ? d : new TextDecoder().decode(d);
const rnd = () => Math.random().toString(36).slice(2, 12);
const json = (o, status = 200) => new Response(JSON.stringify(o, null, 2), {
  status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
});

function parse(raw) {
  const out = [];
  let i = 0;
  while (i < raw.length) {
    if (raw.startsWith('~m~', i) === false) break;
    const e = raw.indexOf('~m~', i + 3);
    if (e < 0) break;
    const len = +raw.slice(i + 3, e);
    if (!(len >= 0)) break;
    const start = e + 3;
    out.push(raw.slice(start, start + len));
    i = start + len;
  }
  return out;
}

function cookieStr(env) {
  if (!env.TV_SESSION) return '';
  let c = `sessionid=${env.TV_SESSION}`;
  if (env.TV_SESSION_SIGN) c += `; sessionid_sign=${env.TV_SESSION_SIGN}`;
  return c;
}

async function getAuth(env, force = false) {
  if (!force && authCache.token && Date.now() - authCache.t < 20 * 60e3) return authCache.token;
  const cookie = cookieStr(env);
  if (!cookie) { authCache.err = 'TV_SESSION secret tanımlı değil'; return 'unauthorized_user_token'; }
  try {
    const r = await fetch('https://www.tradingview.com/', {
      headers: { Cookie: cookie, 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' }
    });
    const html = await r.text();
    const m = html.match(/"auth_token":"([^"]+)"/);
    if (!m) {
      authCache.err = `auth_token bulunamadı (HTTP ${r.status}) — çerez geçersiz veya süresi dolmuş olabilir`;
      return 'unauthorized_user_token';
    }
    authCache = { token: m[1], t: Date.now(), err: null };
    return m[1];
  } catch (e) {
    authCache.err = 'tradingview.com erişilemedi: ' + e.message;
    return 'unauthorized_user_token';
  }
}

async function openTV(env) {
  let last = '';
  for (const h of ['prodata', 'data']) {
    try {
      const r = await fetch(`https://${h}.tradingview.com/socket.io/websocket?from=chart%2F&type=chart`, {
        headers: {
          Upgrade: 'websocket',
          Origin: 'https://www.tradingview.com',
          'User-Agent': UA,
          Cookie: cookieStr(env)
        }
      });
      if (r.webSocket) { r.webSocket.accept(); return { ws: r.webSocket, host: h }; }
      last += `${h}: HTTP ${r.status}; `;
    } catch (e) { last += `${h}: ${e.message}; `; }
  }
  throw new Error('TV WebSocket açılmadı → ' + last);
}

async function test(env, url) {
  const syms = (url.searchParams.get('s') || 'EREGL').toUpperCase()
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  const token = await getAuth(env, true);
  const rapor = {
    surum: 'v5.3',
    kv: !!env.DB,
    cerezVar: !!env.TV_SESSION,
    yetkiliToken: token !== 'unauthorized_user_token',
    authHata: authCache.err
  };
  let tv;
  try { tv = await openTV(env); rapor.sunucu = tv.host; }
  catch (e) { rapor.tvHata = e.message; return json(rapor, 502); }

  const data = await new Promise(res => {
    const out = {};
    const qs = 'qs_' + rnd();
    const bitir = () => { try { tv.ws.close(); } catch {} res(out); };
    const timer = setTimeout(bitir, 6000);
    tv.ws.addEventListener('message', e => {
      for (const p of parse(txt(e.data))) {
        if (p.startsWith('~h~')) { try { tv.ws.send(frame(p)); } catch {} continue; }
        let j; try { j = JSON.parse(p); } catch { continue; }
        if (j.m === 'critical_error' || j.m === 'protocol_error') out._tvHata = j.p;
        if (j.m === 'qsd') {
          const d = j.p[1];
          const k = d.n.replace(/^BIST:/, '');
          out[k] = { ...(out[k] || {}), ...(d.v || {}), durum: d.s };
          if (syms.every(s => out[s] && out[s].lp != null && out[s].update_mode)) {
            clearTimeout(timer); bitir();
          }
        }
      }
    });
    tv.ws.send(msg('set_auth_token', [token]));
    tv.ws.send(msg('quote_create_session', [qs]));
    tv.ws.send(msg('quote_set_fields', [qs, 'lp', 'ch', 'chp', 'volume', 'update_mode', 'lp_time', 'short_name']));
    tv.ws.send(msg('quote_add_symbols', [qs, ...syms.map(s => 'BIST:' + s)]));
  });

  if (data._tvHata) rapor.tvMesaj = data._tvHata;
  rapor.semboller = {};
  for (const s of syms) {
    const d = data[s] || {};
    rapor.semboller[s] = {
      fiyat: d.lp ?? null,
      degisimYuzde: d.chp ?? null,
      mod: d.update_mode ?? null,
      sonIslem: d.lp_time ? new Date(d.lp_time * 1000).toISOString() : null,
      durum: d.durum ?? 'veri gelmedi'
    };
  }
  const modlar = Object.values(rapor.semboller).map(x => String(x.mod));
  rapor.SONUC = modlar.every(m => m === 'streaming') ? 'GERÇEK ZAMANLI ✅'
    : modlar.some(m => m.includes('delayed')) ? 'GECİKMELİ ❌'
    : 'belirsiz — seans içinde tekrar dene';
  return json(rapor);
}

/* ---------- /bars: mum verisi ---------- */
function normSym(s) {
  s = String(s || '').trim().toUpperCase();
  if (!s) return null;
  if (!s.includes(':')) s = 'BIST:' + s;
  return /^[A-Z_]{2,12}:[A-Z0-9._!]{1,20}$/.test(s) ? s : null;
}

function fetchBarsTV(env, list, tf, n, ms) {
  return new Promise(async resolve => {
    const out = {};
    list.forEach(s => { out[s] = { m: new Map(), done: false, err: null, more: 0, last: 0 }; });
    let tv, finished = false;
    const bitir = () => {
      if (finished) return; finished = true;
      clearTimeout(timer);
      try { tv && tv.ws.close(); } catch {}
      resolve(out);
    };
    const timer = setTimeout(bitir, ms);
    try {
      const [conn, token] = await Promise.all([openTV(env), getAuth(env)]);
      tv = conn;
      if (finished) { try { tv.ws.close(); } catch {} return; }
      const cs = {};
      list.forEach((s, i) => { cs['cs_' + rnd() + i] = s; });
      const check = () => { if (list.every(s => out[s].done)) bitir(); };
      tv.ws.addEventListener('message', e => {
        for (const p of parse(txt(e.data))) {
          if (p.startsWith('~h~')) { try { tv.ws.send(frame(p)); } catch {} continue; }
          let j; try { j = JSON.parse(p); } catch { continue; }
          const id = j.p && j.p[0], s = cs[id];
          if (j.m === 'critical_error' || j.m === 'protocol_error') {
            list.forEach(x => { if (!out[x].done) { out[x].err = 'TV: ' + JSON.stringify(j.p).slice(0, 120); out[x].done = true; } });
            check(); continue;
          }
          if (!s) continue;
          const st = out[s];
          if (j.m === 'symbol_error' || j.m === 'series_error') {
            st.err = j.m + ': ' + JSON.stringify(j.p.slice(1)).slice(0, 120); st.done = true; check(); continue;
          }
          if (j.m === 'timescale_update' || j.m === 'du') {
            const ser = j.p[1] && j.p[1]['$prices'];
            if (ser && Array.isArray(ser.s)) ser.s.forEach(b => { if (b && Array.isArray(b.v)) st.m.set(b.v[0], b.v); });
          }
          if (j.m === 'series_completed') {
            const size = st.m.size;
            if (size >= n || st.more >= 6 || (st.more > 0 && size <= st.last)) { st.done = true; check(); continue; }
            st.more++; st.last = size;
            tv.ws.send(msg('request_more_data', [id, '$prices', Math.min(n - size, 5000)]));
          }
        }
      });
      tv.ws.send(msg('set_auth_token', [token]));
      for (const id of Object.keys(cs)) {
        tv.ws.send(msg('chart_create_session', [id, '']));
        tv.ws.send(msg('resolve_symbol', [id, 'sds_sym_1', '=' + JSON.stringify({ symbol: cs[id], adjustment: 'splits', session: 'regular' })]));
        tv.ws.send(msg('create_series', [id, '$prices', 's1', 'sds_sym_1', tf, Math.min(n, 5000), '']));
      }
    } catch (e) {
      list.forEach(x => { if (!out[x].done) { out[x].err = e.message; out[x].done = true; } });
      bitir();
    }
  });
}

async function bars(env, url) {
  const tf = (url.searchParams.get('tf') || '15').toUpperCase().replace(/^D$/, '1D').replace(/^W$/, '1W');
  if (!TFS.includes(tf)) return json({ ok: false, error: 'geçersiz tf', izinli: TFS }, 400);
  const n = Math.max(10, Math.min(10000, parseInt(url.searchParams.get('n') || '300', 10) || 300));
  const syms = [...new Set((url.searchParams.get('s') || '').split(',').map(normSym).filter(Boolean))].slice(0, 8);
  if (!syms.length) return json({ ok: false, error: 'sembol yok (?s=THYAO veya ?s=THYAO,EREGL)' }, 400);
  const ttl = /^\d+$/.test(tf) ? 20000 : 120000;
  const now = Date.now(), data = {}, need = [];
  for (const s of syms) {
    const c = barCache.get(s + '|' + tf + '|' + n);
    if (c && now - c.t < ttl) data[s] = { bars: c.bars, cache: true }; else need.push(s);
  }
  if (need.length) {
    const got = await fetchBarsTV(env, need, tf, n, 12000);
    for (const s of need) {
      const st = got[s];
      const arr = [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]).slice(-n)
        .map(v => [v[0], v[1], v[2], v[3], v[4], v[5] || 0]);
      if (arr.length) {
        barCache.set(s + '|' + tf + '|' + n, { t: Date.now(), bars: arr });
        data[s] = { bars: arr };
      } else data[s] = { bars: [], err: st.err || 'veri gelmedi (zaman aşımı)' };
    }
    if (barCache.size > 400) { const k = [...barCache.keys()].slice(0, barCache.size - 300); k.forEach(x => barCache.delete(x)); }
  }
  return json({ ok: true, tf, n, data });
}


/* =====================================================================
   v5 · SUNUCU (Cron) — telefon kapalıyken de çalışır
   ===================================================================== */
const TR = 3 * 3600e3;
function trNow() {
  const d = new Date(Date.now() + TR);
  return { wd: d.getUTCDay(), m: d.getUTCHours() * 60 + d.getUTCMinutes(), hm: d.toISOString().slice(11, 16), day: d.toISOString().slice(0, 10) };
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nf = (x, d = 2) => (x == null || !isFinite(x)) ? '-' : Number(x).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sp = x => (x >= 0 ? '+' : '−') + '%' + nf(Math.abs(x), 2);
const DEF_OPT = { al: 1, rd: 1, kap: 1, hl: 1, rdMin: 60 };

async function kvGet(env, k, d) { if (!env.DB) return d; try { const v = await env.DB.get(k, 'json'); return v == null ? d : v; } catch { return d; } }
async function kvPut(env, k, v) { if (!env.DB) return false; try { await env.DB.put(k, JSON.stringify(v)); return true; } catch { return false; } }

async function tgSend(cfg, text) {
  if (!cfg || !cfg.tgTok || !cfg.chat) return { ok: false, error: 'Telegram ayarı yok' };
  try {
    const r = await fetch('https://api.telegram.org/bot' + cfg.tgTok + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chat, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    const j = await r.json();
    return j.ok ? { ok: true } : { ok: false, error: j.description || 'hata' };
  } catch (e) { return { ok: false, error: e.message }; }
}

// /sync — terminal ayarlarını, alarmları ve izleme listesini sunucuya yazar
async function sync(request, env) {
  if (!env.DB) return json({ ok: false, error: 'KV bağlaması (DB) yok — Cloudflare ayarlarından ekle' }, 500);
  const raw = await request.text();
  if (raw.length > 60000) return json({ ok: false, error: 'çok büyük' }, 413);
  let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: 'geçersiz JSON' }, 400); }
  const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9._]/g, '').slice(0, 15);
  const cfg = {
    tgTok: /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(b.tgTok || '') ? b.tgTok : '',
    chat: /^-?\d{3,20}$/.test(String(b.chat || '')) ? String(b.chat) : '',
    alarms: (Array.isArray(b.alarms) ? b.alarms : []).slice(0, 100).map(a => ({
      id: String(a.id || '').slice(0, 60), s: clean(a.s), l: +a.l, dir: a.dir === 'down' ? 'down' : 'up'
    })).filter(a => a.id && a.s && a.l > 0),
    watch: (Array.isArray(b.watch) ? b.watch : []).map(clean).filter(Boolean).slice(0, 8),
    opt: Object.assign({}, DEF_OPT, typeof b.opt === 'object' && b.opt ? b.opt : {}),
    at: Date.now()
  };
  await kvPut(env, 'cfg', cfg);
  const st = await kvGet(env, 'st', {});
  return json({ ok: true, alarms: cfg.alarms.length, watch: cfg.watch.length, telegram: !!(cfg.tgTok && cfg.chat), hit: st.hit || [] });
}

async function status(env) {
  const cfg = await kvGet(env, 'cfg', null), st = await kvGet(env, 'st', {});
  return json({
    ok: true, surum: 'v5.3', kv: !!env.DB, synced: cfg ? cfg.at : null,
    telegram: !!(cfg && cfg.tgTok && cfg.chat), alarms: cfg ? cfg.alarms.length : 0, watch: cfg ? cfg.watch : [],
    lastRun: st.lastRun || null, health: st.health || null, hit: st.hit || [],
    today: st.cnt && st.cnt.d === trNow().day ? st.cnt : null, err: st.err || null
  });
}

/* ---------- haberler (TradingView haber akışı; KAP bildirimleri dahil) ---------- */
function normNews(j) {
  const arr = Array.isArray(j) ? j : (j && (j.items || j.data || j.news)) || [];
  return arr.map(x => {
    const prov = x.provider && typeof x.provider === 'object' ? (x.provider.name || x.provider.id) : (x.provider || x.source || '');
    const t = +x.published || +x.published_at || (x.published && Date.parse(x.published) / 1000) || 0;
    const link = x.link || x.url || (x.storyPath ? 'https://tr.tradingview.com' + x.storyPath : x.urlPath ? 'https://tr.tradingview.com' + x.urlPath : '');
    return { id: String(x.id || x.storyPath || x.urlPath || x.title || '').slice(0, 200), title: String(x.title || '').slice(0, 300), prov: String(prov || '').slice(0, 40), t, link };
  }).filter(x => x.id && x.title);
}
const isKap = n => /kap/i.test(n.prov) || /^kap\b|\bkap\b/i.test(n.title);
const newsCache = new Map();
async function fetchNews(sym) {
  const c = newsCache.get(sym);
  if (c && Date.now() - c.t < 60000) return c.v;
  const r = await fetch('https://news-headlines.tradingview.com/v2/headlines?client=web&lang=tr&symbol=' + encodeURIComponent(sym), {
    headers: { 'User-Agent': UA, Origin: 'https://www.tradingview.com', Referer: 'https://www.tradingview.com/' }
  });
  if (!r.ok) throw new Error('haber HTTP ' + r.status);
  const j = await r.json();
  const v = { items: normNews(j), raw: j };
  newsCache.set(sym, { t: Date.now(), v });
  if (newsCache.size > 100) newsCache.delete(newsCache.keys().next().value);
  return v;
}
async function news(url) {
  const syms = [...new Set((url.searchParams.get('s') || '').split(',').map(normSym).filter(Boolean))].slice(0, 5);
  if (!syms.length) return json({ ok: false, error: 'sembol yok' }, 400);
  const out = {};
  for (const s of syms) {
    try {
      const v = await fetchNews(s);
      out[s] = { items: v.items.slice(0, 15).map(n => ({ ...n, kap: isKap(n) })) };
      if (url.searchParams.get('raw') === '1') out[s].ornek = JSON.stringify(Array.isArray(v.raw) ? v.raw[0] : (v.raw && (v.raw.items || [])[0]) || v.raw).slice(0, 1500);
    } catch (e) { out[s] = { items: [], err: e.message }; }
  }
  return json({ ok: true, data: out });
}

/* ---------- sağlık: oturum + gerçek zamanlı mı? ---------- */
async function healthCheck(env) {
  const token = await getAuth(env, true);
  if (token === 'unauthorized_user_token') return { ok: false, why: 'TradingView oturumu geçersiz (' + (authCache.err || 'token yok') + ')' };
  let tv;
  try { tv = await openTV(env); } catch (e) { return { ok: false, why: 'TradingView bağlantısı açılamadı' }; }
  const mode = await new Promise(res => {
    const qs = 'qs_' + rnd(); let done = false;
    const fin = v => { if (done) return; done = true; clearTimeout(t); try { tv.ws.close(); } catch {} res(v); };
    const t = setTimeout(() => fin(null), 6000);
    tv.ws.addEventListener('message', e => {
      for (const p of parse(txt(e.data))) {
        if (p.startsWith('~h~')) continue;
        let j; try { j = JSON.parse(p); } catch { continue; }
        if (j.m === 'qsd' && j.p[1] && j.p[1].v && j.p[1].v.update_mode) fin(j.p[1].v.update_mode);
      }
    });
    tv.ws.send(msg('set_auth_token', [token]));
    tv.ws.send(msg('quote_create_session', [qs]));
    tv.ws.send(msg('quote_set_fields', [qs, 'lp', 'update_mode']));
    tv.ws.send(msg('quote_add_symbols', [qs, 'BIST:THYAO']));
  });
  if (!mode) return { ok: false, why: 'TradingView veri göndermedi' };
  if (/delay/i.test(mode)) return { ok: false, why: 'TradingView GECİKMELİ veri gönderiyor (' + mode + ')' };
  return { ok: true, mode };
}

/* ---------- dakikalık tarama ---------- */
const CRON_COLS = ['name', 'close', 'change', 'volume', 'high', 'relative_volume_intraday|5', 'VWAP|15', 'EMA20|15', 'sector'];
async function scanAll(env) {
  const body = JSON.stringify({
    filter: [{ left: 'type', operation: 'equal', right: 'stock' }, { left: 'subtype', operation: 'in_range', right: ['common', 'foreign-issuer'] }],
    options: { lang: 'tr' }, markets: ['turkey'], symbols: { query: { types: [] }, tickers: [] },
    columns: CRON_COLS, sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' }, range: [0, 900]
  });
  const r = await scanRaw(env, body);
  if (!r.ok) throw new Error('tarama HTTP ' + r.status);
  const j = await r.json();
  const map = {};
  (j.data || []).forEach(row => { const o = {}; CRON_COLS.forEach((c, i) => o[c] = row.d[i]); if (o.name) map[o.name] = o; });
  return map;
}

async function cron(env, force = false) {
  const now = Date.now(), T = trNow();
  const weekday = T.wd >= 1 && T.wd <= 5;
  const session = force || (weekday && T.m >= 600 && T.m < 1090);           // 10:00–18:10
  const newsWin = force || (weekday && T.m >= 480 && T.m < 1320);           // 08:00–22:00 (KAP akşam da yayımlar)
  if (!session && !newsWin) return { skip: true };
  const cfg = await kvGet(env, 'cfg', null);
  if (!cfg) return { skip: true, why: 'ayar yok (terminalden Sunucuya gönder)' };
  const opt = Object.assign({}, DEF_OPT, cfg.opt || {});
  const st = await kvGet(env, 'st', {});
  st.hit = st.hit || []; st.sent = st.sent || {}; st.seen = st.seen || {};
  if (!st.cnt || st.cnt.d !== T.day) st.cnt = { d: T.day, alarm: 0, radar: 0, kap: 0, runs: 0 };
  let dirty = false; const msgs = []; const errs = [];

  // 1) sağlık (seansta her 10 dakikada bir)
  if (session && opt.hl && (force || T.m % 10 === 0 || !st.health)) {
    let h; try { h = await healthCheck(env); } catch (e) { h = { ok: false, why: e.message }; }
    const prev = st.health;
    if (!prev || prev.ok !== h.ok) {
      if (!h.ok) msgs.push('⚠️ <b>BAĞLANTI SORUNU</b>\n' + esc(h.why) + '\nTerminal anlık veri alamıyor olabilir. Gerekirse TradingView çerezini yenile.');
      else if (prev && !prev.ok) msgs.push('✅ <b>Bağlantı düzeldi</b> — TradingView yeniden gerçek zamanlı (' + esc(h.mode) + ')');
      st.health = { ok: h.ok, why: h.why || '', mode: h.mode || '', since: now };
      dirty = true;
    }
  }

  // 2) tarama: alarm + radar
  let U = null;
  if (session && ((opt.al && cfg.alarms.length) || opt.rd)) {
    try { U = await scanAll(env); } catch (e) { errs.push(e.message); }
  }
  if (U && opt.al) {
    for (const a of cfg.alarms) {
      if (st.hit.includes(a.id)) continue;
      const o = U[a.s]; if (!o || !(o.close > 0)) continue;
      if ((a.dir === 'up' && o.close >= a.l) || (a.dir === 'down' && o.close <= a.l)) {
        st.hit.push(a.id); st.cnt.alarm++; dirty = true;
        msgs.push('🔔 <b>ALARM · ' + esc(a.s) + '</b>\nFiyat ' + nf(o.close) + (a.dir === 'up' ? ' ≥ ' : ' ≤ ') + nf(a.l) + ' · Gün ' + sp(o.change || 0));
      }
    }
    if (st.hit.length > 200) st.hit = st.hit.slice(-200);
  }
  if (U && opt.rd && weekday && T.m >= 610 && T.m < 1075) {   // radar yalnızca gerçek seansta (test modunda da)
    const cands = [];
    for (const s in U) {
      const o = U[s], rv = o['relative_volume_intraday|5'], vw = o['VWAP|15'], e20 = o['EMA20|15'];
      if (!(o.close > 0) || !(o.volume * o.close >= 2e7)) continue;
      if (!(rv >= 3) || !(o.change >= 0.5 && o.change < 5)) continue;
      if (!(vw > 0 && o.close > vw) || !(e20 > 0 && o.close > e20)) continue;
      if (!(o.high > 0 && o.close >= o.high * 0.997)) continue;
      const last = st.sent[s] || 0; if (now - last < 90 * 60e3) continue;
      const sc = Math.round(Math.min(100, 50 + Math.min(30, (rv - 3) * 6) + Math.min(10, (o.close / vw - 1) * 400) + (o.change < 3 ? 10 : 0)));
      if (sc < (opt.rdMin || 60)) continue;
      cands.push({ s, o, rv, vw, sc });
    }
    cands.sort((a, b) => b.sc - a.sc).slice(0, 4).forEach(c => {
      st.sent[c.s] = now; st.cnt.radar++; dirty = true;
      msgs.push('📡 <b>SUNUCU RADAR · ' + esc(c.s) + '</b> · skor ' + c.sc + '\nFiyat ' + nf(c.o.close) + ' · Gün ' + sp(c.o.change) + ' · 5dk RVOL ' + nf(c.rv, 1) + 'x\nVWAP üstü ' + sp((c.o.close / c.vw - 1) * 100) + ' · gün zirvesinde' + (c.o.sector ? '\n' + esc(String(c.o.sector).slice(0, 30)) : ''));
    });
    for (const k in st.sent) if (now - st.sent[k] > 6 * 3600e3) { delete st.sent[k]; dirty = true; }
  }

  // 3) KAP / haber (izleme listesi, 5 dakikada bir)
  if (newsWin && opt.kap && cfg.watch.length && (force || T.m % 5 === 0)) {
    for (const w of cfg.watch.slice(0, 8)) {
      const sym = 'BIST:' + w;
      try {
        const v = await fetchNews(sym);
        const seen = st.seen[w] || null;
        const items = v.items.filter(n => isKap(n)).slice(0, 10);
        if (seen === null) { st.seen[w] = items.map(n => n.id).slice(0, 30); dirty = true; continue; } // ilk tur: sadece işaretle
        const fresh = items.filter(n => !seen.includes(n.id) && (!n.t || now / 1000 - n.t < 6 * 3600));
        fresh.slice(0, 3).forEach(n => {
          st.cnt.kap++;
          msgs.push('📰 <b>KAP · ' + esc(w) + '</b>' + (n.t ? ' · ' + new Date(n.t * 1000 + TR).toISOString().slice(11, 16) : '') + '\n' + esc(n.title) + (n.link ? '\n' + esc(n.link) : ''));
        });
        if (fresh.length) { st.seen[w] = [...fresh.map(n => n.id), ...seen].slice(0, 30); dirty = true; }
      } catch (e) { errs.push(w + ': ' + e.message); }
    }
  }

  // 4) gönder + durum yaz
  let tgErr = '';
  for (const m of msgs.slice(0, 10)) { const r = await tgSend(cfg, m); if (!r.ok) tgErr = r.error; }
  st.cnt.runs++;
  const errStr = [...errs, tgErr ? 'Telegram: ' + tgErr : ''].filter(Boolean).join(' | ').slice(0, 300);
  if (errStr !== (st.err || '')) { st.err = errStr; dirty = true; }
  if (dirty || !st.lastRun || now - st.lastRun > 10 * 60e3) { st.lastRun = now; await kvPut(env, 'st', st); }
  return { ok: true, sent: msgs.length, err: errStr, health: st.health || null, alarms: cfg.alarms.length, watch: cfg.watch, scanned: U ? Object.keys(U).length : 0 };
}

function scanRaw(env, body, market = 'turkey') {
  return fetch(`https://scanner.tradingview.com/${market}/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://www.tradingview.com',
      Referer: 'https://www.tradingview.com/',
      'User-Agent': UA,
      Cookie: cookieStr(env)
    },
    body
  });
}

async function scan(request, env, url) {
  const market = (url.searchParams.get('market') || 'turkey').toLowerCase();
  if (!/^[a-z]+$/.test(market)) return json({ error: 'geçersiz market' }, 400);
  const body = await request.text();
  try { JSON.parse(body); }
  catch { return json({ error: 'gövde geçerli JSON değil', gelen: body.slice(0, 150) }, 400); }
  const r = await scanRaw(env, body, market);
  return new Response(await r.text(), {
    status: r.status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

async function tvScan(request, env) {
  let inp = {};
  try { inp = JSON.parse((await request.text()) || '{}'); } catch {}
  const syms = (Array.isArray(inp.symbols) ? inp.symbols : [])
    .filter(s => typeof s === 'string' && /^[A-Z]+:[A-Z0-9._]{1,15}$/.test(s))
    .slice(0, 900);
  if (!syms.length) return json({ ok: false, http: 0, error: 'sembol yok' });
  const body = JSON.stringify({ symbols: { tickers: syms, query: { types: [] } }, columns: SCAN_COLS });
  try {
    const r = await scanRaw(env, body);
    const t = await r.text();
    if (!r.ok) return json({ ok: false, http: r.status, body: t.slice(0, 200) });
    const d = JSON.parse(t);
    return json({ ok: true, data: d.data || [], n: (d.data || []).length });
  } catch (e) {
    return json({ ok: false, http: 0, error: e.message });
  }
}

async function tvTest(env) {
  try {
    const t = await openTV(env);
    try { t.ws.close(); } catch {}
    return json({ opened: true, sunucu: t.host });
  } catch (e) {
    return json({ opened: false, error: e.message });
  }
}

function echoWS() {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.addEventListener('message', e => { try { server.send('echo:' + txt(e.data)); } catch {} });
  return new Response(null, { status: 101, webSocket: client });
}

// v5.2: DOĞRUDAN BORU — TradingView WebSocket'i telefona olduğu gibi bağlanır.
// Mesajlar Worker kodundan hiç geçmez (Cloudflare altyapısı taşır) → ücretsiz plandaki
// 10 ms işlemci limiti dolmaz, bağlantı kopmaz. Yetki anahtarını terminal /tv-token ile alır.
async function pipeTV(env) {
  let last = '';
  for (const h of ['prodata', 'data']) {
    try {
      const r = await fetch(`https://${h}.tradingview.com/socket.io/websocket?from=chart%2F&type=chart`, {
        headers: { Upgrade: 'websocket', Origin: 'https://www.tradingview.com', 'User-Agent': UA, Cookie: cookieStr(env) }
      });
      if (r.webSocket) return new Response(null, { status: 101, webSocket: r.webSocket });
      last += `${h}: HTTP ${r.status}; `;
    } catch (e) { last += `${h}: ${e.message}; `; }
  }
  return json({ error: 'TV WebSocket açılmadı → ' + last }, 502);
}
// v5.3: /prefs — terminal ayar yedeği (Safari ↔ ana ekran uygulaması ↔ diğer telefon arasında tek dokunuşla taşıma)
async function prefs(request, env) {
  if (!env.DB) return json({ ok: false, error: 'KV bağlaması (DB) yok' }, 500);
  if (request.method === 'POST') {
    const t = await request.text();
    if (!/^BISTT:[A-Za-z0-9+/=]+$/.test(t)) return json({ ok: false, error: 'geçersiz yedek' }, 400);
    if (t.length > 3000000) return json({ ok: false, error: 'yedek çok büyük' }, 413);
    await env.DB.put('prefs', t);
    await env.DB.put('prefs_at', String(Date.now()));
    return json({ ok: true, kb: Math.round(t.length / 1024) });
  }
  const t = await env.DB.get('prefs');
  if (!t) return json({ ok: false, error: 'sunucuda kayıtlı ayar yok' }, 404);
  const at = +(await env.DB.get('prefs_at')) || null;
  return json({ ok: true, data: t, at });
}
async function tvToken(env) {
  const token = await getAuth(env);
  const ok = token !== 'unauthorized_user_token';
  return json({ ok, token: ok ? token : '', err: ok ? null : authCache.err });
}

// (eski yol, geriye uyumluluk) Telefonun bağlantısı hemen kabul edilir; TradingView bağlantısı arkada kurulur.
// v5.1: veri ayrıştırılmadan olduğu gibi aktarılır (işlemci limiti aşılmasın diye).
// Kalp atışlarını (heartbeat) terminal kendisi yanıtlar.
function stripAuth(raw) {
  if (!raw.includes('set_auth_token')) return raw;
  return parse(raw).filter(p => !p.includes('"set_auth_token"')).map(frame).join('');
}
function relay(env, ctx) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  let tv = null;
  let closed = false;
  const queue = [];

  const kapat = () => {
    if (closed) return;
    closed = true;
    try { if (tv) tv.close(); } catch {}
    try { server.close(); } catch {}
  };

  server.addEventListener('message', e => {
    const raw = stripAuth(txt(e.data));
    if (!raw) return;
    if (tv) { try { tv.send(raw); } catch {} }
    else if (queue.length < 300) queue.push(raw);
  });
  server.addEventListener('close', kapat);
  server.addEventListener('error', kapat);

  const baglan = (async () => {
    try {
      const [conn, token] = await Promise.all([openTV(env), getAuth(env)]);
      if (closed) { try { conn.ws.close(); } catch {} return; }
      const ws = conn.ws;
      ws.addEventListener('message', e => { try { server.send(e.data); } catch {} });
      ws.addEventListener('close', kapat);
      ws.addEventListener('error', kapat);
      ws.send(msg('set_auth_token', [token]));
      for (const raw of queue.splice(0)) ws.send(raw);
      tv = ws;
    } catch (e) {
      try { server.send(msg('proxy_error', [String((e && e.message) || e)])); } catch {}
      kapat();
    }
  })();
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(baglan);

  return new Response(null, { status: 101, webSocket: client });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const parts = url.pathname.split('/').filter(Boolean);
    const isWS = (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket';

    if (parts[0] === 'echo' && !isWS) return new Response('OK', { headers: CORS });

    let route;
    if (env.ACCESS_KEY && parts[0] === env.ACCESS_KEY) route = parts.slice(1).join('/');
    else if (env.ACCESS_KEY && url.searchParams.get('k') === env.ACCESS_KEY) route = parts.join('/');
    else return json({ error: 'yetkisiz — anahtar eksik veya yanlış' }, 401);

    if (isWS) {
      if (route === 'ws-echo') return echoWS();
      if (url.searchParams.get('direct') === '1') return pipeTV(env);
      return relay(env, ctx);
    }

    switch (route) {
      case '': return new Response('OK', { headers: CORS });
      case 'test': return test(env, url);
      case 'bars': return bars(env, url);
      case 'news': return news(url);
      case 'status': return status(env);
      case 'sync': if (request.method === 'POST') return sync(request, env); break;
      case 'cron-test': {
        const r = await cron(env, url.searchParams.get('force') === '1');
        if (url.searchParams.get('tg') === '1') { const cfg = await kvGet(env, 'cfg', null); r.telegramTest = await tgSend(cfg, '🛰 <b>Sunucu testi</b> — bist-tv v5.2 çalışıyor · ' + trNow().hm); }
        return json(r);
      }
      case 'tv-test': return tvTest(env);
      case 'tv-login': return json({ ok: true, session: 'worker' });
      case 'tv-token': return tvToken(env);
      case 'prefs': return prefs(request, env);
      case 'tv-scan': return tvScan(request, env);
      case 'set-syms': return json({ ok: true });
      case 'pull': return json({});
      case 'scan': if (request.method === 'POST') return scan(request, env, url); break;
    }
    return json({ error: 'bilinmeyen yol: /' + route }, 404);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cron(env).catch(async e => {
      try { const st = await kvGet(env, 'st', {}); st.err = 'cron: ' + (e && e.message || e); st.lastRun = Date.now(); await kvPut(env, 'st', st); } catch {}
    }));
  }
};
