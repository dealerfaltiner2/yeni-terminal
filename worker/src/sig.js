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
  try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN adr REAL').run(); } catch (e) {} // v6.6: hissenin son 20 gün ortalama günlük aralığı % (oynaklık)
  ready = true;
}
// v6.6: son 20 tamamlanmış günün ortalama günlük aralığı (%), feat tablosundaki 'adr' ile aynı formül: ort((yüksek−düşük)/kapanış)
export function adrOf(daily, d) {
  if (!daily || !daily.length) return null;
  const prev = daily.filter(b => trDay(b[0] * 1000) < d && b[4] > 0).slice(-20);
  if (prev.length < 10) return null;
  const v = prev.reduce((a, b) => a + (b[2] - b[3]) / b[4], 0) / prev.length * 100;
  return isFinite(v) ? Math.round(v * 100) / 100 : null;
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
  // 01.10: gün sınırı sayıyla (her mumda tarih metni üretmek işlemciyi yoruyordu; ücretsiz planda 10 ms sınırı)
  const ds = (Date.parse(r.d + 'T00:00:00Z') - TRMS) / 1000, de = ds + 86400;
  const B = bars.filter(b => b[0] >= s0 + 60 && b[0] >= ds && b[0] < de); // sinyalden SONRAKİ tam mumlar, aynı gün
  if (!B.length) return { err: 'mum yok' };
  const up = r.dir !== 'SAT', sg = up ? 1 : -1;
  const px = r.px > 0 ? r.px : B[0][1];                          // fiyatsız sinyal (KAP) → sinyalden sonraki ilk mumun açılışı
  let pc = null; for (const b of bars) { if (b[0] < ds) pc = b[4]; else break; }
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
    for (const b of ib) { if (b[0] < ds) prev = b[4]; else if (b[0] < de && b[0] <= s0) cur = b[4]; }
    if (cur != null && prev) idx = (cur / prev - 1) * 100;
  }
  const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;
  return { px: r2(px), pre: pc ? r2((px / pc - 1) * 100) : null, o10: race(1), o15: race(1.5), r15: r2(at(15)), r60: r2(at(60)), rc: r2(sg * (B[B.length - 1][4] / px - 1) * 100), mfe: r2(mfe), mae: r2(mae), idx: r2(idx) };
}
// Seans dışında her dakika: bekleyen sinyallerden 5 hisseyi ölç; hepsi bitince özeti gönder
import { errAdd } from './err.js';
const FAIL = new Map();   // hisse → art arda veri gelmeme sayısı (bu çalışma örneğinde)
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
  // Art arda 3 kez veri gelmeyen hisse sıranın sonuna atılır (diğerlerini kilitlemesin)
  const all = [...new Set(todo.map(r => r.sym))];
  // 01.10: ÇALIŞMA YARIDA KESİLİRSE (Cloudflare süre/işlemci sınırı) hiçbir iz kalmıyordu → aynı 5 hisse her dakika yeniden
  // deneniyor, karne ölçümü ve arkasındaki KAP haberleri duruyordu. Artık ölçülen hisseler önce meta 'sig_run'a yazılır;
  // bir sonraki çalışma bu kaydı bitmemiş bulursa o hisselerin 'kesilme' sayısını artırır (meta 'sig_kill'). Kesilen hisseler
  // tek tek denenir (suçsuzlar ölçülür), 3 kez kesilen hisse 'ölçülemedi' diye kapatılır.
  const mg = async k => { try { const x = await env.BT.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first(); return x ? JSON.parse(x.v) : null; } catch (e) { return null; } };
  const ms = (k, v) => env.BT.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind(k, JSON.stringify(v)).run();
  const KILL = (await mg('sig_kill')) || {};
  const run = await mg('sig_run');
  if (run && Array.isArray(run.syms)) {
    if (now - run.at < 50e3 && now >= run.at) return { bekle: 'önceki ölçüm sürüyor' };
    for (const x of run.syms) KILL[x] = (KILL[x] || 0) + 1;
    await errAdd(env, 'sunucu', 'toparlama', 'karne ölçümü yarıda kesildi: ' + run.syms.join(','), 'karne ölçümü');
    await env.BT.prepare("DELETE FROM meta WHERE k = 'sig_run'").run();
  }
  for (const x of Object.keys(KILL)) {
    if (KILL[x] >= 3) {
      await env.BT.prepare("UPDATE sig SET done = 1, err = 'ölçülemedi (ölçüm 3 kez yarıda kesildi)' WHERE done = 0 AND sym = ?").bind(x).run();
      await errAdd(env, 'sunucu', 'toparlama', 'karne: ölçülemeyen hisse kapatıldı: ' + x, 'karne ölçümü');
      delete KILL[x];
    } else if (!all.includes(x)) delete KILL[x];
  }
  if (Object.keys(KILL).length || run) await ms('sig_kill', KILL);
  const sus = all.filter(x => KILL[x] && !(KILL[x] >= 3));
  const syms = sus.length ? [sus[0]]   // şüpheli hisse tek başına denenir
    : [...all.filter(x => (FAIL.get(x) || 0) < 3), ...all.filter(x => (FAIL.get(x) || 0) >= 3)].filter(x => !(KILL[x] >= 3)).slice(0, 5);
  if (!syms.length) return { eski: old.length };
  await ms('sig_run', { syms, at: now });
  let n = 0, bos = 0;
  try {
  const got = await fetchBarsTV(env, [...syms.map(s => 'BIST:' + s), 'BIST:XU100'], '1', 2500, 25000);
  const toBars = st => st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
  const ib = toBars(got['BIST:XU100']);
  // v6.6: günlük mumlar → oynaklık (adr). Ayrı bağlantı, sırayla; gelmezse adr boş kalır, ölçüm yine yapılır.
  let gd = {};
  try { gd = await fetchBarsTV(env, syms.map(s => 'BIST:' + s), '1D', 30, 10000); } catch (e) { gd = {}; }
  if (FAIL.size > 300) FAIL.clear();
  for (const r of todo.filter(x => syms.includes(x.sym))) {
    const st = got['BIST:' + r.sym], bars = toBars(st);
    // bağlantı sorunu → işaretleme, sonraki dakikada yeniden dene (4 gün sonra 'çok eski' olarak kapanır)
    if (!bars.length && !(st && /^(symbol_error|series_error)/.test(st.err || ''))) { FAIL.set(r.sym, (FAIL.get(r.sym) || 0) + 1); bos++; if (FAIL.get(r.sym) === 3) await errAdd(env, 'sunucu', 'toparlama', 'veri gelmeyen hisse sıranın sonuna alındı: ' + r.sym, 'karne ölçümü'); continue; }
    FAIL.delete(r.sym);
    const o = bars.length ? sigOutcome(bars, r, ib) : { err: st.err };
    const adr = adrOf(toBars(gd['BIST:' + r.sym]), r.d);
    await env.BT.prepare('UPDATE sig SET done = 1, px = coalesce(px, ?), pre = ?, o10 = ?, o15 = ?, r15 = ?, r60 = ?, rc = ?, mfe = ?, mae = ?, idx = ?, adr = ?, err = ? WHERE id = ?')
      .bind(o.px ?? null, o.pre ?? null, o.o10 ?? null, o.o15 ?? null, o.r15 ?? null, o.r60 ?? null, o.rc ?? null, o.mfe ?? null, o.mae ?? null, o.idx ?? null, adr, o.err || null, r.id).run();
    n++;
  }
  if (syms.some(x => KILL[x])) { for (const x of syms) delete KILL[x]; await ms('sig_kill', KILL); }
  } finally { try { await env.BT.prepare("DELETE FROM meta WHERE k = 'sig_run'").run(); } catch (e) {} }
  // 21:00'den sonra ölçülemeyen sinyal kalsa da rapor çıksın (sigSummary kendisi 'bugün gönderildi mi' bakar)
  let rapor = null;
  if (m >= 1260) { try { rapor = await sigSummary(env, tgSend, kvGet, esc, nf); } catch (e) {} }
  return { olculen: n, verisiz: bos, kalan: ready.length - n, hisse: syms, rapor: rapor ? !!rapor.gonderildi : null };
}
const SRC_AD = { radar: '📡 Sunucu radarı', algi: '⚡ Algı', 'firsat-A': '🅰️ Fırsat A', 'firsat-B': '🅱️ Fırsat B' };
const KAP_TR = { is: 'Yeni iş/sözleşme', ihale: 'İhale', geri: 'Geri alım', bedelsiz: 'Bedelsiz', bedelli: 'Bedelli', tahsisli: 'Sermaye artırımı', teklif: 'Pay alım teklifi', birlesme: 'Birleşme/devir', tesvik: 'Teşvik', temettu: 'Temettü', bilanco: 'Bilanço', not: 'Kredi notu', icerden: 'İçeriden alım-satım', yatirim: 'Yatırım', varlik: 'Varlık alım/satım', ozel: 'Özel durum', risk: 'Risk (konkordato vb.)', kisit: 'İşlem kısıtı', ceza: 'Ceza/dava' };
// v6.6 FİLTRE KONTROLÜ — araştırmada bulunan iki filtre kendi sinyallerimizde de tutuyor mu? (tüm günler, yalnız AL, KAP hariç)
// Endeks: sinyal anında XU100 önceki kapanışa göre artıda mı (idx ≥ 0). Oynaklık: son 20 gün ortalama günlük aralık %5 ve üstü mü (adr).
export async function filterBlock(env, pc) {
  try {
    await sigEnsure(env);
    const f = await env.BT.prepare("SELECT sum(idx >= 0 AND o10 = 1) eah, sum(idx >= 0 AND o10 = 2) eas, sum(idx < 0 AND o10 = 1) eeh, sum(idx < 0 AND o10 = 2) ees, sum(adr >= 5 AND o10 = 1) oyh, sum(adr >= 5 AND o10 = 2) oys, sum(adr < 5 AND o10 = 1) sah, sum(adr < 5 AND o10 = 2) sas FROM sig WHERE done = 1 AND err IS NULL AND dir = 'AL' AND src NOT LIKE 'kap-%'").first();
    if (!f) return '';
    const v = k => +f[k] || 0;
    const ln = (ad, h, s) => '\n   ' + ad + ': ' + (h + s ? (h + s) + ' sinyal → <b>%' + pc(h, h + s) + '</b>' : 'henüz yok');
    if (!(v('eah') + v('eas') + v('eeh') + v('ees'))) return '';
    return '\n\n🔎 <b>Filtre kontrolü</b> <i>(tüm günler, Fırsat/Algı/Radar)</i>' +
      ln('Endeks artıdayken', v('eah'), v('eas')) + ln('Endeks ekside iken', v('eeh'), v('ees')) +
      ln('Oynak hisselerde (günde %5 ve üstü)', v('oyh'), v('oys')) + ln('Sakin hisselerde (günde %5 altı)', v('sah'), v('sas'));
  } catch (e) { return ''; }
}
export async function sigSummary(env, tgSend, kvGet, esc, nf, force = false) {
  let pend = 0, tryN = 0;
  const now = Date.now(), today = trDay(now), m = trMin(now), wd = new Date(now + TRMS).getUTCDay();
  if (!force && !(wd >= 1 && wd <= 5 && m >= 1100)) return null;   // 18:20 sonrası
  if (!force) {
    const f = await env.BT.prepare("SELECT v FROM meta WHERE k = 'sigsum'").first();
    if (f && f.v === today) return null;
    // Tüm sinyaller ölçülene kadar bekle; ama en geç 21:00'de ölçülenlerle gönder (veri gelmeyen sinyal raporu kilitlemesin)
    const p = await env.BT.prepare('SELECT count(*) n FROM sig WHERE d = ? AND done = 0').bind(today).first();
    pend = p ? +p.n || 0 : 0;
    if (pend && m < 1260) return null;
    // Gönderim başarısızsa (Telegram reddi vb.) 10 dk'da bir yeniden dene, en çok 12 kez
    const tr = await env.BT.prepare("SELECT v FROM meta WHERE k = 'sigsum_try'").first();
    const tt = tr ? JSON.parse(tr.v) : null;
    if (tt && tt.d === today && (tt.n >= 12 || now - tt.at < 10 * 60e3)) return null;
    tryN = tt && tt.d === today ? tt.n + 1 : 1;
    // kilit: aynı anda çalışan ikinci bir cron ikinci kez göndermesin
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sigsum_try', ?)").bind(JSON.stringify({ d: today, n: tryN, at: now })).run();
  }
  const R = (await env.BT.prepare("SELECT src, count(*) n, sum(o10 = 1) h, sum(o10 = 2) s FROM sig WHERE d = ? AND err IS NULL AND done = 1 AND src <> 'kap-devre' GROUP BY src ORDER BY n DESC").bind(today).all()).results || [];
  if (!R.length) { if (!force) await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sigsum', ?)").bind(today).run(); return { mesaj: 'bugün sinyal yok' }; }
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
  msg += await filterBlock(env, pc);
  if (pend) msg += '\n\n⏳ ' + pend + ' sinyal için veri gelmedi; ölçülünce genel toplamlara eklenecek.';
  const cfg = await kvGet(env, 'cfg', null);
  const t = await tgSend(cfg, msg);
  if (!force) {
    if (t && t.ok) await env.BT.batch([
      env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sigsum', ?)").bind(today),
      env.BT.prepare("DELETE FROM meta WHERE k = 'sigsum_try'")]);
    else { await errAdd(env, 'sunucu', 'hata', 'karne raporu gönderilemedi: ' + String(t && t.error || '?').slice(0, 120), 'sigSummary'); await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sigsum_try', ?)").bind(JSON.stringify({ d: today, n: tryN, at: now, err: String(t && t.error || '').slice(0, 120) })).run(); }
  }
  return { gonderildi: !!(t && t.ok), msg };
}
// v6.9 KARNE EKRANI — terminalin Karne sekmesi için son ~2 haftanın özeti (5 dk önbellek; okuma sınırı için sig_d indeksi kullanılır)
let statCache = { at: 0, v: null };
export async function sigStats(env) {
  if (!env.BT) return { ok: false, error: 'D1 yok' };
  if (statCache.v && Date.now() - statCache.at < 5 * 60e3) return statCache.v;
  await sigEnsure(env);
  const from = trDay(Date.now() - 16 * 86400e3);
  const rows = (await env.BT.prepare("SELECT d, src, count(*) n, sum(o10 = 1) h, sum(o10 = 2) s FROM sig WHERE d >= ? AND done = 1 AND err IS NULL AND src <> 'kap-devre' GROUP BY d, src").bind(from).all()).results || [];
  const days = [...new Set(rows.map(r => r.d))].sort().reverse().slice(0, 10);
  const src = {};
  for (const r of rows) if (days.includes(r.d)) { const x = src[r.src] || (src[r.src] = { n: 0, h: 0, s: 0 }); x.n += r.n; x.h += r.h || 0; x.s += r.s || 0; }
  const byDay = days.map(d => ({ d, src: Object.fromEntries(rows.filter(r => r.d === d).map(r => [r.src, { n: r.n, h: r.h || 0, s: r.s || 0 }])) }));
  const last = days[0] || null;
  const list = last ? ((await env.BT.prepare("SELECT t, src, sym, o10, mfe, rc FROM sig WHERE d = ? AND done = 1 AND err IS NULL AND src NOT LIKE 'kap-%' ORDER BY t DESC LIMIT 40").bind(last).all()).results || []) : [];
  const pend = await env.BT.prepare('SELECT count(*) n FROM sig WHERE done = 0 AND t < ?').bind(Date.now()).first();
  const v = { ok: true, at: Date.now(), gun: days.length, days: byDay, src, last, list, bekleyen: pend ? pend.n : 0 };
  statCache = { at: Date.now(), v };
  return v;
}
