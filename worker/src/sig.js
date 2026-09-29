// v5.7 SİNYAL KARNESİ — her sinyal kaydedilir, seans bitince 1 dk mumlarla sonucu ölçülür, 18:20'de Telegram özeti.
// Sonuç kodları (o10 = ±%1, o15 = ±%1,5): 1 = hedef önce, 2 = stop önce (aynı mumda ikisi → stop, temkinli), 0 = ikisi de yok.
const TRMS = 3 * 3600e3;
export const trDay = ms => new Date(ms + TRMS).toISOString().slice(0, 10);
const trMin = ms => { const d = new Date(ms + TRMS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
let ready = false;
export async function sigEnsure(env) {
  if (ready) return;
  await env.BT.batch([
    env.BT.prepare('CREATE TABLE IF NOT EXISTS sig (id INTEGER PRIMARY KEY AUTOINCREMENT, d TEXT, t INTEGER, src TEXT, sym TEXT, dir TEXT, px REAL, sc REAL, dev TEXT, meta TEXT, done INTEGER DEFAULT 0, o10 INTEGER, o15 INTEGER, r15 REAL, r60 REAL, rc REAL, mfe REAL, mae REAL, idx REAL, err TEXT)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS sig_done ON sig(done, t)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS sig_d ON sig(d)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS sig_t ON sig(t)')
  ]);
  try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN pre REAL').run(); } catch (e) {} // giriş fiyatı ↔ önceki kapanış (haber etkisi girişten önce mi?)
  ready = true;
}
export async function sigAdd(env, s) {
  try {
    if (!env.BT) return false;
    await sigEnsure(env);
    const t = +s.t || Date.now();
    await env.BT.prepare('INSERT INTO sig (d,t,src,sym,dir,px,sc,dev,meta) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(trDay(t), t, s.src, s.sym, s.dir === 'SAT' ? 'SAT' : 'AL', s.px, s.sc == null || !isFinite(s.sc) ? null : +s.sc, s.dev || '', JSON.stringify(s.meta || {}).slice(0, 600)).run();
    return true;
  } catch (e) { return false; }
}
// Terminalden gelen sinyal (yalnız ana cihaz — router OWN_ROUTES ile korur)
export async function sigLog(request, env, url, json) {
  if (!env.BT) return json({ ok: false, error: 'D1 yok' }, 500);
  const raw = await request.text();
  if (raw.length > 4000) return json({ ok: false, error: 'çok büyük' }, 413);
  let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: 'geçersiz JSON' }, 400); }
  const src = String(b.src || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 16);
  const sym = String(b.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const px = +b.px, t = +b.t || Date.now(), dir = b.dir === 'SAT' ? 'SAT' : 'AL';
  if (!src || !sym || !(px > 0) || Math.abs(Date.now() - t) > 3600e3) return json({ ok: false, error: 'eksik ya da eski sinyal' }, 400);
  const m = trMin(t), wd = new Date(t + TRMS).getUTCDay();
  if (wd < 1 || wd > 5 || m < 600 || m >= 1080) return json({ ok: true, skip: 'seans dışı' });
  await sigEnsure(env);
  const dup = await env.BT.prepare('SELECT id FROM sig WHERE d = ? AND src = ? AND sym = ? AND dir = ? AND t > ?').bind(trDay(t), src, sym, dir, t - 20 * 60e3).first();
  if (dup) return json({ ok: true, dup: true });
  await sigAdd(env, { src, sym, dir, px, sc: b.sc, t, dev: String(url.searchParams.get('dev') || '').slice(0, 32), meta: b.meta });
  return json({ ok: true });
}
// Bir sinyalin sonucu: bars = 1 dk mumlar [t(sn), o, h, l, c, v]; ib = XU100 1 dk mumları
export function sigOutcome(bars, r, ib) {
  const s0 = Math.floor(r.t / 60000) * 60;                     // sinyal dakikası (sn)
  const B = bars.filter(b => b[0] >= s0 + 60 && trDay(b[0] * 1000) === r.d); // sinyalden SONRAKİ tam mumlar, aynı gün
  if (!B.length) return { err: 'mum yok' };
  const up = r.dir !== 'SAT', sg = up ? 1 : -1;
  const px = r.px > 0 ? r.px : B[0][1];                          // fiyatsız sinyal (KAP) → sinyalden sonraki ilk mumun açılışı
  let pc = null; for (const b of bars) { if (trDay(b[0] * 1000) < r.d) pc = b[4]; else break; }
  const race = K => {
    const tg = px * (1 + sg * K / 100), sl = px * (1 - sg * K / 100);
    for (const b of B) {
      if (up ? b[3] <= sl : b[2] >= sl) return 2;
      if (up ? b[2] >= tg : b[3] <= tg) return 1;
    }
    return 0;
  };
  const at = min => { let c = null; for (const b of B) { if (b[0] <= s0 + (min - 1) * 60) c = b[4]; else break; } return c == null ? null : sg * (c / px - 1) * 100; };
  let hi = -Infinity, lo = Infinity;
  for (const b of B) { hi = Math.max(hi, b[2]); lo = Math.min(lo, b[3]); }
  const mfe = up ? (hi / px - 1) * 100 : (1 - lo / px) * 100, mae = up ? (lo / px - 1) * 100 : (1 - hi / px) * 100;
  let idx = null;
  if (ib && ib.length) {
    let cur = null, prev = null;
    for (const b of ib) { const d = trDay(b[0] * 1000); if (d < r.d) prev = b[4]; else if (d === r.d && b[0] <= s0) cur = b[4]; }
    if (cur != null && prev) idx = (cur / prev - 1) * 100;
  }
  const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;
  return { px: r2(px), pre: pc ? r2((px / pc - 1) * 100) : null, o10: race(1), o15: race(1.5), r15: r2(at(15)), r60: r2(at(60)), rc: r2(sg * (B[B.length - 1][4] / px - 1) * 100), mfe: r2(mfe), mae: r2(mae), idx: r2(idx) };
}
// Seans dışında her dakika: bekleyen sinyallerden 5 hisseyi ölç; hepsi bitince özeti gönder
export async function sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf) {
  if (!env.BT) return null;
  await sigEnsure(env);
  const now = Date.now(), today = trDay(now), m = trMin(now);
  const rows = (await env.BT.prepare('SELECT id,d,t,sym,dir,px FROM sig WHERE done = 0 AND t < ? ORDER BY t LIMIT 80').bind(now).all()).results || [];
  const ready = rows.filter(r => r.d < today || m >= 1095);       // bugünün sinyalleri 18:15'ten sonra
  if (!ready.length) return sigSummary(env, tgSend, kvGet, esc, nf);
  const old = ready.filter(r => now - r.t > 4 * 86400e3);
  for (const r of old) await env.BT.prepare("UPDATE sig SET done = 1, err = 'çok eski' WHERE id = ?").bind(r.id).run();
  const todo = ready.filter(r => now - r.t <= 4 * 86400e3);
  const syms = [...new Set(todo.map(r => r.sym))].slice(0, 5);
  if (!syms.length) return { eski: old.length };
  const got = await fetchBarsTV(env, [...syms.map(s => 'BIST:' + s), 'BIST:XU100'], '1', 2500, 25000);
  const toBars = st => st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
  const ib = toBars(got['BIST:XU100']);
  let n = 0;
  for (const r of todo.filter(x => syms.includes(x.sym))) {
    const st = got['BIST:' + r.sym], bars = toBars(st);
    // bağlantı sorunu → işaretleme, sonraki dakikada yeniden dene (4 gün sonra 'çok eski' olarak kapanır)
    if (!bars.length && !(st && /^(symbol_error|series_error)/.test(st.err || ''))) continue;
    const o = bars.length ? sigOutcome(bars, r, ib) : { err: st.err };
    await env.BT.prepare('UPDATE sig SET done = 1, px = coalesce(px, ?), pre = ?, o10 = ?, o15 = ?, r15 = ?, r60 = ?, rc = ?, mfe = ?, mae = ?, idx = ?, err = ? WHERE id = ?')
      .bind(o.px ?? null, o.pre ?? null, o.o10 ?? null, o.o15 ?? null, o.r15 ?? null, o.r60 ?? null, o.rc ?? null, o.mfe ?? null, o.mae ?? null, o.idx ?? null, o.err || null, r.id).run();
    n++;
  }
  return { olculen: n, hisse: syms };
}
const SRC_AD = { radar: '📡 Sunucu radarı', algi: '⚡ Algı', 'firsat-A': '🅰️ Fırsat A', 'firsat-B': '🅱️ Fırsat B' };
const KAP_TR = { is: 'Yeni iş/sözleşme', ihale: 'İhale', geri: 'Geri alım', bedelsiz: 'Bedelsiz', bedelli: 'Bedelli', tahsisli: 'Sermaye artırımı', teklif: 'Pay alım teklifi', birlesme: 'Birleşme/devir', tesvik: 'Teşvik', temettu: 'Temettü', bilanco: 'Bilanço', not: 'Kredi notu', icerden: 'İçeriden alım-satım', yatirim: 'Yatırım', varlik: 'Varlık alım/satım', ozel: 'Özel durum', risk: 'Risk (konkordato vb.)', kisit: 'İşlem kısıtı', ceza: 'Ceza/dava' };
export async function sigSummary(env, tgSend, kvGet, esc, nf, force = false) {
  const now = Date.now(), today = trDay(now), m = trMin(now), wd = new Date(now + TRMS).getUTCDay();
  if (!force && !(wd >= 1 && wd <= 5 && m >= 1100)) return null;   // 18:20 sonrası
  if (!force) {
    const f = await env.BT.prepare("SELECT v FROM meta WHERE k = 'sigsum'").first();
    if (f && f.v === today) return null;
    const p = await env.BT.prepare('SELECT count(*) n FROM sig WHERE d = ? AND done = 0').bind(today).first();
    if (p && p.n) return null;
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sigsum', ?)").bind(today).run();
  }
  const R = (await env.BT.prepare("SELECT src, count(*) n, sum(o10 = 1) h, sum(o10 = 2) s FROM sig WHERE d = ? AND err IS NULL AND done = 1 AND src <> 'kap-devre' GROUP BY src ORDER BY n DESC").bind(today).all()).results || [];
  if (!R.length) return { mesaj: 'bugün sinyal yok' };
  const A = (await env.BT.prepare("SELECT src, count(*) n, sum(o10 = 1) h, sum(o10 = 2) s, count(DISTINCT d) g FROM sig WHERE err IS NULL AND done = 1 AND src <> 'kap-devre' GROUP BY src").bind().all()).results || [];
  const best = (await env.BT.prepare("SELECT sym, max(mfe) mfe FROM sig WHERE d = ? AND err IS NULL AND done = 1 AND src <> 'kap-devre' GROUP BY sym ORDER BY mfe DESC LIMIT 3").bind(today).all()).results || [];
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const line = (h, s) => (h + s ? (h ? '✅ ' + h + ' kazandı' : '') + (h && s ? ' · ' : '') + (s ? '❌ ' + s + ' kaybetti' : '') + ' → <b>%' + pc(h, h + s) + '</b>' : 'sonuçlanan yok');
  const d = today.split('-');
  let msg = '📊 <b>SİNYAL KARNESİ · ' + d[2] + '.' + d[1] + '</b>\n<i>Her sinyalde önce +%1 mi geldi, −%1 mi?</i>';
  const ORD = ['firsat-A', 'firsat-B', 'algi', 'radar'], rk = x => { const i = ORD.indexOf(x); return i < 0 ? 99 : i; };
  for (const r of R.filter(r => !String(r.src).startsWith('kap-')).sort((a, b) => rk(a.src) - rk(b.src))) {
    msg += '\n\n<b>' + esc(SRC_AD[r.src] || r.src) + '</b> — ' + r.n + ' sinyal\n   ' + line(r.h, r.s);
    const a = A.find(x => x.src === r.src);
    if (a && a.g > 1) msg += '\n   <i>tüm günler: ' + a.n + ' sinyal → %' + pc(a.h, a.h + a.s) + '</i>';
  }
  const K = R.filter(r => String(r.src).startsWith('kap-'));
  if (K.length) {
    const kn = K.reduce((x, r) => x + r.n, 0), kh = K.reduce((x, r) => x + r.h, 0), ks = K.reduce((x, r) => x + r.s, 0);
    msg += '\n\n<b>📰 KAP haberleri</b> — ' + kn + ' haber · ' + (kh + ks ? '%' + pc(kh, kh + ks) : '-');
    K.filter(r => r.h + r.s > 0).slice(0, 5).forEach(r => { msg += '\n   ' + esc(KAP_TR[r.src.slice(4)] || r.src.slice(4)) + ': ' + r.n + ' → %' + pc(r.h, r.h + r.s); });
  }
  if (best.length) msg += '\n\n🏆 <b>Günün en iyileri</b>: ' + best.map(b => esc(b.sym) + ' +%' + Math.round(b.mfe)).join(' · ');
  const cfg = await kvGet(env, 'cfg', null);
  const t = await tgSend(cfg, msg);
  return { gonderildi: !!(t && t.ok), msg };
}
