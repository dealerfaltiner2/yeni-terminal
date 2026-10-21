import { tgQuote, mktBlock } from './tgfmt.js';
// v5.7 SİNYAL KARNESİ — her sinyal kaydedilir, seans bitince 1 dk mumlarla sonucu ölçülür, 18:20'de Telegram özeti.
// Sonuç kodları (o10 = ±%1, o15 = ±%1,5): 1 = hedef önce, 2 = stop önce (aynı mumda ikisi → stop, temkinli), 0 = ikisi de yok.
// v9.0 (09.10, Fatih): BAŞARI = sinyalden sonra +%3 gelmesi, stop −%1, gün kapanışı baz alınmaz → o31 (aynı gün; 0 = ikisi de gelmedi = sonuçsuz).
// Karne, haftalık rapor, Karne ekranı ve röntgen artık o31'e bakar. Eski sinyallerde sıra bilinmiyorsa (mfe≥3 ve mae≤−1) o31 boş kalır.
const TRMS = 3 * 3600e3;
export const trDay = ms => new Date(ms + TRMS).toISOString().slice(0, 10);
const trMin = ms => { const d = new Date(ms + TRMS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
let ready = false;
// 13.10 bakım: şema sürümü meta 'sig_schema'da. Eşitse tablo/indeks/ALTER adımları ATLANIR (her soğuk başlangıçta 14 başarısız ALTER
// + 3 sorgu işlemci payını yiyordu → 13.10 akşamı karne ölçümü ve KAP adımı her dakika yarıda kesildi). Yeni sütun eklerken SÜRÜMÜ ARTIR.
const SIG_SCHEMA = '13.5';
export async function sigEnsure(env) {
  if (ready) return;
  try { const s = await env.BT.prepare("SELECT v FROM meta WHERE k = 'sig_schema'").first(); if (s && s.v === SIG_SCHEMA) { ready = true; return; } } catch (e) {}
  await env.BT.batch([
    env.BT.prepare('CREATE TABLE IF NOT EXISTS sig (id INTEGER PRIMARY KEY AUTOINCREMENT, d TEXT, t INTEGER, src TEXT, sym TEXT, dir TEXT, px REAL, sc REAL, dev TEXT, meta TEXT, done INTEGER DEFAULT 0, o10 INTEGER, o15 INTEGER, r15 REAL, r60 REAL, rc REAL, mfe REAL, mae REAL, idx REAL, err TEXT)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS sig_done ON sig(done, t)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS sig_d ON sig(d)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS sig_t ON sig(t)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS sig_sym ON sig(sym, d)')
  ]);
  try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN pre REAL').run(); } catch (e) {} // giriş fiyatı ↔ önceki kapanış (haber etkisi girişten önce mi?)
  try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN adr REAL').run(); } catch (e) {} // v6.6: hissenin son 20 gün ortalama günlük aralığı % (oynaklık)
  // v8.4 bot yarışı ölçümleri: tx = çabuk çıkış (±K en çok 60 dk, gelmezse 60. dk kapanışı) sonucu %;
  // pbn = geri çekilme girişi oldu mu (1 evet, 0 hayır, -1 ölçülemedi), pb = o girişin sonucu % (±K yarışı, gelmezse gün sonu)
  for (const c of ['tx REAL', 'pb REAL', 'pbn INTEGER', 'o31 INTEGER', 'o41 INTEGER', 'h1 REAL']) { try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN ' + c).run(); } catch (e) {} }
  // v10.2 ERTESİ GÜN: ng = ertesi gün açılış farkı (sinyal günü kapanışına göre %), nh/nl/nc = ertesi gün tepe/dip/kapanış (sinyal fiyatına göre %),
  // nt = 1 ertesi gün tavan (kapanış ≥ +%9,5), -1 taban, 0 değil; nx = 1 ölçüldü, negatif = deneme sayısı (en çok 3).
  for (const c of ['ng REAL', 'nh REAL', 'nl REAL', 'nc REAL', 'nt INTEGER', 'nx INTEGER']) { try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN ' + c).run(); } catch (e) {} }
  // v9.0: o31 eklenmeden önce ölçülmüş sinyaller — sırası kesin olanlar mfe/mae'den bir kez doldurulur (meta 'o31fill').
  // +%3 ve −%1 ikisi birden olduysa sıra bilinmez → boş kalır (son 6 gün sigBackfill dakikalık mumlarla tamamlar).
  try {
    const f = await env.BT.prepare("SELECT v FROM meta WHERE k = 'o31fill'").first();
    if (!f) {
      await env.BT.prepare("UPDATE sig SET o31 = CASE WHEN mfe >= 3 AND mae > -1 THEN 1 WHEN mae <= -1 AND mfe < 3 THEN 2 WHEN mfe < 3 AND mae > -1 THEN 0 END WHERE o31 IS NULL AND done = 1 AND mfe IS NOT NULL AND mae IS NOT NULL").run();
      await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('o31fill', ?)").bind(String(Date.now())).run();
    }
  } catch (e) {}
  // v10.6 (14.10, Fatih onayıyla): o315 = Momentum +%3 hedef / −%1,5 stop yarışı (1 hedef, 2 stop, 0 ikisi de yok → rc). Yalnız ölçüm (bot 'mom315').
  try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN o315 INTEGER').run(); } catch (e) {}
  // v11.5 (16.10, Fatih onayıyla) HABER ÖLÇÜMÜ: p30 = sinyalden önceki 30 dk'da hisse ne kadar hareket etmişti (% ; 10:30'dan önceyse günün açılışından),
  // hb = sinyalden önceki son KAP haberine kaç dakika (önem ≥1, devre kesici hariç, önceki iş günü 18:00'den bu yana; −1 = haber yok). Yalnız ölçüm.
  for (const c of ['p30 REAL', 'hb INTEGER']) { try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN ' + c).run(); } catch (e) {} }
  // v13.5 (20.10, Fatih onayıyla, 3 Kasım Algı kararı için): o21 = +%2 hedef / −%1 stop yarışı (1 hedef, 2 stop, 0 ikisi de yok, −1 denendi/ölçülemedi);
  // b2 = '+%2 görülünce stopu girişe çek': önce −%1 gelirse −1; +%2 sonra fiyat girişe dönerse 0; dönmezse gün sonu % (hiç +%2 görmezse −1 ya da gün sonu). Yalnız ölçüm.
  for (const c of ['o21 INTEGER', 'b2 REAL']) { try { await env.BT.prepare('ALTER TABLE sig ADD COLUMN ' + c).run(); } catch (e) {} }
  try { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sig_schema', ?)").bind(SIG_SCHEMA).run(); } catch (e) {}
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
  let s0 = Math.floor(r.t / 60000) * 60;                     // sinyal dakikası (sn)
  // 01.10: gün sınırı sayıyla (her mumda tarih metni üretmek işlemciyi yoruyordu; ücretsiz planda 10 ms sınırı)
  let ds = (Date.parse(r.d + 'T00:00:00Z') - TRMS) / 1000, de = ds + 86400;
  let B = bars.filter(b => b[0] >= s0 + 60 && b[0] >= ds && b[0] < de); // sinyalden SONRAKİ tam mumlar, aynı gün
  // 01.10: fiyatsız (KAP) sinyalin günü tatil/yarım gün çıkarsa, sinyalden sonraki ilk işlem gününe kaydır
  if (!B.length && !(r.px > 0)) {
    const f = bars.find(b => b[0] >= s0 + 60);
    if (f) { ds = Math.floor((f[0] + TRMS / 1000) / 86400) * 86400 - TRMS / 1000; de = ds + 86400; B = bars.filter(b => b[0] >= f[0] && b[0] < de); s0 = f[0] - 60; }
  }
  if (!B.length) return { err: 'mum yok' };
  const up = r.dir !== 'SAT', sg = up ? 1 : -1;
  const px = r.px > 0 ? r.px : B[0][1];                          // fiyatsız sinyal (KAP) → sinyalden sonraki ilk mumun açılışı
  let pc = null; for (const b of bars) { if (b[0] < ds) pc = b[4]; else break; }
  const race = (K, S = K) => {
    const tg = px * (1 + sg * K / 100), sl = px * (1 - sg * S / 100);
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
  // v8.4 bot yarışı (yalnız AL): K = Momentum %1,5, diğerleri %1. Aynı mumda hedef ve stop → stop (temkinli).
  let tx = null, pb = null, pbn = null, h1 = null, b2 = null;
  if (up) {
    // v13.5 '+%2'de stopu girişe çek' (aynı mumda +%2 ve −%1 → stop; +%2'nin geldiği mumdan SONRAKİ mumlarda giriş fiyatı aranır)
    { const t2 = px * 1.02, sl = px * 0.99; let hit = -1;
      for (let i = 0; i < B.length; i++) { const b = B[i]; if (b[3] <= sl) { b2 = -1; break; } if (b[2] >= t2) { hit = i; break; } }
      if (b2 == null) {
        if (hit < 0) b2 = (B[B.length - 1][4] / px - 1) * 100;
        else { for (let i = hit + 1; i < B.length; i++) { if (B[i][3] <= px) { b2 = 0; break; } } if (b2 == null) b2 = (B[B.length - 1][4] / px - 1) * 100; }
      } }
    // v9.3 (09.10, Fatih: 'stop %1'i geçmesin'): hedefsiz çıkış — −%1 stop, gelmezse gün sonu kapanışı (bot yarışı 'momh')
    { const sl = px * 0.99; h1 = null; for (const b of B) { if (b[3] <= sl) { h1 = -1; break; } } if (h1 == null) h1 = (B[B.length - 1][4] / px - 1) * 100; }
    const K = (r.src === 'momentum' || r.src === 'sessiz' || r.src === 'dunguclu') ? 1.5 : 1;
    // çabuk çıkış: sinyalden sonraki 60 mum içinde ±K; gelmezse 60. mumun kapanışında sat
    { const tg = px * (1 + K / 100), sl = px * (1 - K / 100); let res = null, lc = null;
      for (const b of B) { if (b[0] > s0 + 3600) break; if (b[3] <= sl) { res = -K; break; } if (b[2] >= tg) { res = K; break; } lc = b[4]; }
      tx = res != null ? res : lc != null ? (lc / px - 1) * 100 : 0; }
    // geri çekilme girişi: 30 dk içinde fiyat %0,5 aşağı gelirse oradan al (limit emir); gelmezse işlem yok
    { const pe = px * 0.995; let i0 = -1;
      for (let i = 0; i < B.length; i++) { if (B[i][0] > s0 + 1800) break; if (B[i][3] <= pe) { i0 = i; break; } }
      if (i0 < 0) pbn = 0;
      else {
        pbn = 1; const t2 = pe * (1 + K / 100), s2 = pe * (1 - K / 100); let rr = null;
        if (B[i0][3] <= s2) rr = -K;
        else for (let i = i0 + 1; i < B.length; i++) { const b = B[i]; if (b[3] <= s2) { rr = -K; break; } if (b[2] >= t2) { rr = K; break; } }
        pb = rr != null ? rr : (B[B.length - 1][4] / pe - 1) * 100;
      } }
  }
  // v11.5: p30 — sinyalden 30 dk önceki kapanış (aynı gün; yoksa günün ilk açılışı) → giriş fiyatına göre %
  let b30 = null, o0 = null; for (const b of bars) { if (b[0] < ds) continue; if (b[0] >= de || b[0] > s0) break; if (o0 == null) o0 = b[1]; if (b[0] <= s0 - 1800) b30 = b[4]; }
  const base30 = b30 != null ? b30 : o0, p30 = base30 > 0 ? (px / base30 - 1) * 100 : null;
  return { p30: r2(p30), px: r2(px), pre: pc ? r2((px / pc - 1) * 100) : null, o10: race(1), o15: race(1.5), o31: race(3, 1), o41: race(4, 1), o315: race(3, 1.5), o21: up ? race(2, 1) : null, b2: r2(b2), h1: r2(h1), r15: r2(at(15)), r60: r2(at(60)), rc: r2(sg * (B[B.length - 1][4] / px - 1) * 100), mfe: r2(mfe), mae: r2(mae), idx: r2(idx), tx: r2(tx), pb: r2(pb), pbn };
}
// Seans dışında her dakika: bekleyen sinyallerden 5 hisseyi ölç; hepsi bitince özeti gönder
import { errAdd } from './err.js';
import { paperLine, paperCalc, QUIET_BOTS } from './paper.js';
const FAIL = new Map();
// v12.1 (16.10, Fatih onayı): TradingView'da 'resolve error' veren kodlar (KAP'ta geçen ama borsada işlem görmeyen: OMD, BNPPI, IYM…)
// meta 'sym_bad' {KOD: 'YYYY-AA-GG'} — 30 gün tutulur; kap.js bu kodları haberin hisse listesinden çıkarır (karne/Telegram'a gitmez).
export async function symBadAdd(env, list) {
  const row = await env.BT.prepare("SELECT v FROM meta WHERE k = 'sym_bad'").first();
  let B = {}; try { B = row ? JSON.parse(row.v) || {} : {}; } catch (e) {}
  const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10), lim = new Date(Date.now() + 3 * 3600e3 - 30 * 86400e3).toISOString().slice(0, 10);
  for (const s of list) B[s] = day;
  for (const k of Object.keys(B)) if (!(B[k] >= lim)) delete B[k];
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sym_bad', ?)").bind(JSON.stringify(B)).run();
  return B;
}
const IDXC = { at: 0, n: 0, bars: null };   // BIST 100 dakikalık mum önbelleği (bu çalışma örneğinde, 10 dk)   // hisse → art arda veri gelmeme sayısı (bu çalışma örneğinde)
export async function sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf) {
  if (!env.BT) return null;
  await sigEnsure(env);
  const now = Date.now(), today = trDay(now), m = trMin(now);
  const rows = (await env.BT.prepare('SELECT id,d,t,sym,dir,px,src FROM sig WHERE done = 0 AND t < ? ORDER BY t LIMIT 80').bind(now).all()).results || [];
  const ready = rows.filter(r => r.d < today || m >= 1095);       // bugünün sinyalleri 18:15'ten sonra
  if (!ready.length) {
    const sm = await sigSummary(env, tgSend, kvGet, esc, nf);
    if (sm) return sm;
    try { const bf = await sigBackfill(env, fetchBarsTV); if (bf) return bf; } catch (e) { return { tamamlama_hata: String(e && e.message || e).slice(0, 120) }; }
    try { const nd = await sigNextDay(env, fetchBarsTV); if (nd) return nd; } catch (e) { return { ertesi_hata: String(e && e.message || e).slice(0, 120) }; }
    try { return await sigNews(env); } catch (e) { return { haber_hata: String(e && e.message || e).slice(0, 120) }; }
  }
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
  // 01.10 akşam: İŞLEMCİ YÜKÜ (ücretsiz plan 10 ms/çalışma) — yalnız gereken kadar mum çekilir (eski: her hisseye 2500),
  // BIST 100 mumları 10 dk önbellekte, günlük mumlar yalnız KAP dışı sinyal varsa (adr yalnız onlarda kullanılıyor).
  const batch = todo.filter(x => syms.includes(x.sym));
  const oldest = batch.reduce((a, r) => (r.d < a ? r.d : a), today);
  const cd = Math.max(0, Math.round((Date.parse(today) - Date.parse(oldest)) / 86400e3));
  const need = Math.min(2500, 650 + 520 * cd);
  const useIdx = IDXC.bars && IDXC.n >= need && now - IDXC.at < 10 * 60e3;
  const got = await fetchBarsTV(env, [...syms.map(s => 'BIST:' + s), ...(useIdx ? [] : ['BIST:XU100'])], '1', need, 15000);
  const toBars = st => st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
  if (!useIdx) { const b = toBars(got['BIST:XU100']); if (b.length) { IDXC.bars = b; IDXC.n = need; IDXC.at = now; } }
  const ib = IDXC.bars || [];
  // v6.6: günlük mumlar → oynaklık (adr). Gelmezse adr boş kalır, ölçüm yine yapılır.
  let gd = {};
  const dsyms = [...new Set(batch.filter(r => !String(r.src || '').startsWith('kap-')).map(r => r.sym))];
  if (dsyms.length) { try { gd = await fetchBarsTV(env, dsyms.map(s => 'BIST:' + s), '1D', 30, 6000); } catch (e) { gd = {}; } }
  if (FAIL.size > 300) FAIL.clear();
  const failed = new Set(), badSym = new Set();
  for (const r of batch) {
    const st = got['BIST:' + r.sym], bars = toBars(st);
    // bağlantı sorunu → işaretleme, sonraki dakikada yeniden dene (4 gün sonra 'çok eski' olarak kapanır). Sayaç hisse başına çalışmada bir kez artar.
    if (!bars.length && !(st && /^(symbol_error|series_error)/.test(st.err || ''))) { if (!failed.has(r.sym)) { failed.add(r.sym); FAIL.set(r.sym, (FAIL.get(r.sym) || 0) + 1); if (FAIL.get(r.sym) === 3) await errAdd(env, 'sunucu', 'toparlama', 'veri gelmeyen hisse sıranın sonuna alındı: ' + r.sym, 'karne ölçümü'); } bos++; continue; }
    FAIL.delete(r.sym);
    if (!bars.length && /resolve error/.test(st.err || '')) badSym.add(r.sym);   // v12.1: işlem görmeyen kod (fon, aracı kurum, banka) → KAP karneye yazmasın
    const o = bars.length ? sigOutcome(bars, r, ib) : { err: st.err };
    const adr = adrOf(toBars(gd['BIST:' + r.sym]), r.d);
    await env.BT.prepare('UPDATE sig SET done = 1, p30 = ?, px = coalesce(px, ?), pre = ?, o10 = ?, o15 = ?, o31 = ?, o41 = ?, o315 = ?, o21 = ?, b2 = ?, h1 = ?, r15 = ?, r60 = ?, rc = ?, mfe = ?, mae = ?, idx = ?, adr = ?, tx = ?, pb = ?, pbn = ?, err = ? WHERE id = ?')
      .bind(o.p30 ?? null, o.px ?? null, o.pre ?? null, o.o10 ?? null, o.o15 ?? null, o.o31 ?? null, o.o41 ?? null, o.o315 ?? null, o.o21 ?? null, o.b2 ?? null, o.h1 ?? null, o.r15 ?? null, o.r60 ?? null, o.rc ?? null, o.mfe ?? null, o.mae ?? null, o.idx ?? null, adr, o.tx ?? null, o.pb ?? null, o.pbn ?? null, o.err || null, r.id).run();
    n++;
  }
  if (badSym.size) { try { await symBadAdd(env, [...badSym]); } catch (e) {} }
  if (syms.some(x => KILL[x])) { for (const x of syms) delete KILL[x]; await ms('sig_kill', KILL); }
  } finally { try { await env.BT.prepare("DELETE FROM meta WHERE k = 'sig_run'").run(); } catch (e) {} }
  // 21:00'den sonra ölçülemeyen sinyal kalsa da rapor çıksın (sigSummary kendisi 'bugün gönderildi mi' bakar)
  let rapor = null;
  if (m >= 1260) { try { rapor = await sigSummary(env, tgSend, kvGet, esc, nf); } catch (e) {} }
  return { olculen: n, verisiz: bos, kalan: ready.length - n, hisse: syms, rapor: rapor ? !!rapor.gonderildi : null };
}
// v8.5 HİSSE RÖNTGENİ — bir hissenin son 60 gündeki sinyal karnesi (kaynak kaynak). 5 dk önbellek, sig_sym indeksi.
const symCache = new Map();
export async function sigSym(env, sym) {
  sym = String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!sym) return { ok: false, error: 'hisse yok' };
  const c = symCache.get(sym); if (c && Date.now() - c.at < 5 * 60e3) return c.v;
  await sigEnsure(env);
  const from = trDay(Date.now() - 60 * 86400e3);
  const HS = 'o31';   // v9.0: −%1'e düşmeden +%3 geldi mi
  const rows = (await env.BT.prepare("SELECT src, count(*) n, sum(" + HS + " = 1) h, sum(" + HS + " = 2) s, max(d) son FROM sig INDEXED BY sig_sym WHERE sym = ? AND d >= ? AND done = 1 AND err IS NULL AND src <> 'kap-devre' GROUP BY src").bind(sym, from).all()).results || [];
  const last = (await env.BT.prepare("SELECT d, t, src, o31, o10, o15, rc FROM sig INDEXED BY sig_sym WHERE sym = ? AND d >= ? AND done = 1 AND err IS NULL AND src <> 'kap-devre' ORDER BY d DESC, t DESC LIMIT 6").bind(sym, from).all()).results || [];
  const v = { ok: true, sym, src: rows, last };
  if (symCache.size > 200) symCache.clear();
  symCache.set(sym, { at: Date.now(), v });
  return v;
}
// v8.4: bot yarışı ölçümleri (tx, pb, pbn) eklenmeden önce ölçülmüş sinyalleri geriye dönük tamamla.
// Yalnız ölçülecek sinyal yokken çalışır; her çalışmada en çok 3 hisse. Önce pbn = -1 yazılır (yarıda kesilirse sonsuza dek denenmesin).
export async function sigBackfill(env, fetchBarsTV) {
  const now = Date.now();
  // v11.0 (15.10, Fatih onayıyla) OKUMA TASARRUFU: bu seçim ~1.200 satır okuyor ve seans dışında her dakika çalışıyordu (günde ~1M).
  // Son bakışta iş YOKSA 15 dk atla (meta 'bf_idle' = boş bulunan zaman; 1 satır okuma). İş varken eskisi gibi her çalışmada.
  const bi = await env.BT.prepare("SELECT v FROM meta WHERE k = 'bf_idle'").first();
  if (bi && now - (+bi.v || 0) < 15 * 60e3) return null;
  const rows = (await env.BT.prepare("SELECT id, d, t, sym, dir, px, src FROM sig INDEXED BY sig_t WHERE t > ? AND done = 1 AND err IS NULL AND ((pbn IS NULL AND dir = 'AL' AND src IN ('firsat-A','firsat-B','algi','momentum','radar','sessiz','dunguclu')) OR (o31 IS NULL AND mfe >= 3 AND mae <= -1) OR (o41 IS NULL AND dir = 'AL' AND src = 'momentum') OR (o315 IS NULL AND dir = 'AL' AND src = 'momentum')) AND px > 0 LIMIT 80").bind(now - 6 * 86400e3).all()).results || [];
  if (!rows.length) {
    // v13.5 (20.10, Fatih: 'ilk günden bu yana hesaplasın'): Algı'da +%2 çıkışları (o21/b2) — 29.09'dan bu yana; 4 günden eskiler 5 dakikalık mumla (1 dk geçmişi yetmez)
    const ar = (await env.BT.prepare("SELECT id, d, t, sym, dir, px, src FROM sig INDEXED BY sig_t WHERE t > ? AND done = 1 AND err IS NULL AND src = 'algi' AND dir = 'AL' AND o21 IS NULL AND px > 0 ORDER BY t DESC LIMIT 60").bind(Date.parse('2026-09-29T00:00:00+03:00')).all()).results || [];
    if (ar.length) return await algiB2Fill(env, fetchBarsTV, ar, now);
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('bf_idle', ?)").bind(String(now)).run(); return null;
  }
  const syms = [...new Set(rows.map(r => r.sym))].slice(0, 3), batch = rows.filter(r => syms.includes(r.sym));
  await env.BT.prepare('UPDATE sig SET pbn = coalesce(pbn, -1), o31 = coalesce(o31, -1), o41 = coalesce(o41, -1), o315 = coalesce(o315, -1) WHERE id IN (' + batch.map(() => '?').join(',') + ')').bind(...batch.map(r => r.id)).run();
  const today = trDay(now), oldest = batch.reduce((a, r) => (r.d < a ? r.d : a), today);
  const cd = Math.max(0, Math.round((Date.parse(today) - Date.parse(oldest)) / 86400e3));
  const got = await fetchBarsTV(env, syms.map(s => 'BIST:' + s), '1', Math.min(2500, 650 + 520 * cd), 15000);
  let n = 0;
  for (const r of batch) {
    const st = got['BIST:' + r.sym], bars = st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
    if (!bars.length) continue;
    const o = sigOutcome(bars, r, null);
    if (o.err) continue;
    await env.BT.prepare('UPDATE sig SET tx = ?, pb = ?, pbn = ?, o31 = ?, o41 = ?, o315 = ?, h1 = ? WHERE id = ?').bind(o.tx ?? null, o.pb ?? null, o.pbn ?? null, o.o31 ?? null, o.o41 ?? null, o.o315 ?? null, o.h1 ?? null, r.id).run();
    n++;
  }
  return { tamamlama: n, hisse: syms, kalan: rows.length - batch.length };
}
async function algiB2Fill(env, fetchBarsTV, ar, now) {
  const syms = [...new Set(ar.map(r => r.sym))].slice(0, 3), batch = ar.filter(r => syms.includes(r.sym));
  await env.BT.prepare('UPDATE sig SET o21 = coalesce(o21, -1) WHERE id IN (' + batch.map(() => '?').join(',') + ')').bind(...batch.map(r => r.id)).run();
  const today = trDay(now), oldest = batch.reduce((a, r) => (r.d < a ? r.d : a), today);
  const cd = Math.max(0, Math.round((Date.parse(today) - Date.parse(oldest)) / 86400e3));
  const tf = cd <= 4 ? '1' : '5', cnt = tf === '1' ? Math.min(2500, 650 + 520 * cd) : Math.min(2500, 130 + 110 * cd);
  const got = await fetchBarsTV(env, syms.map(s => 'BIST:' + s), tf, cnt, 15000);
  let n = 0;
  for (const r of batch) {
    const st = got['BIST:' + r.sym], bars = st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
    if (!bars.length) continue;
    const o = sigOutcome(bars, r, null); if (o.err || o.o21 == null) continue;
    await env.BT.prepare('UPDATE sig SET o21 = ?, b2 = ? WHERE id = ?').bind(o.o21, o.b2 ?? null, r.id).run(); n++;
  }
  return { algi_b2: n, hisse: syms, mum: tf + ' dk' };
}
// v10.2 (13.10, Fatih onayıyla) ERTESİ GÜN ÖLÇÜMÜ — "bugün çıkan sinyal yarın ne yaptı?" (araştırma ajanı ve 3 Kasım değerlendirmesi için; sinyal kuralı değişmez).
// Yalnız ölçülecek sinyal ve tamamlama yokken, en çok 10 dakikada bir (meta 'nx_at'); bir çalışmada en çok 6 hisse, günlük mum (15 adet). Okuma: sig_d indeksiyle son 6 iş günü.
const wdNext = d => { let x = Date.parse(d + 'T00:00:00Z') + 864e5; while ([0, 6].includes(new Date(x).getUTCDay())) x += 864e5; return new Date(x).toISOString().slice(0, 10); };
export function nextDayOf(daily, r) {
  const bars = (daily || []).filter(b => b && b[4] > 0).map(b => ({ d: trDay(b[0] * 1000), o: b[1], h: b[2], l: b[3], c: b[4] }));
  const i = bars.findIndex(b => b.d === r.d), n = bars.find(b => b.d > r.d);
  if (i < 0 || !n || !(r.px > 0)) return null;
  const c0 = bars[i].c, pct = (a, b) => Math.round((a / b - 1) * 10000) / 100;
  const ch = pct(n.c, c0);
  return { ng: pct(n.o, c0), nh: pct(n.h, r.px), nl: pct(n.l, r.px), nc: pct(n.c, r.px), nt: ch >= 9.5 ? 1 : ch <= -9.5 ? -1 : 0, nd: n.d };
}
export async function sigNextDay(env, fetchBarsTV, now = Date.now()) {
  const at = await env.BT.prepare("SELECT v FROM meta WHERE k = 'nx_at'").first();
  if (at && now - +at.v < 10 * 60e3 && now >= +at.v) return null;
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('nx_at', ?)").bind(String(now)).run();
  const today = trDay(now), m = trMin(now), wd = new Date(today + 'T00:00:00Z').getUTCDay();
  // kapanmış son gün: bugün iş günüyse ve 18:15 geçtiyse bugün, değilse önceki gün
  const closed = (wd >= 1 && wd <= 5 && m >= 1095) ? today : trDay(now - 864e5);
  const days = []; let d = trDay(now - 12 * 864e5);
  while (d < today) { if (wdNext(d) <= closed && ![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay())) days.push(d); d = new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10); }
  const want = days.slice(-6);
  if (!want.length) return null;
  const rows = (await env.BT.prepare('SELECT id, d, sym, px FROM sig INDEXED BY sig_d WHERE d IN (' + want.map(() => '?').join(',') + ") AND done = 1 AND err IS NULL AND px > 0 AND src NOT LIKE 'kap-%' AND (nx IS NULL OR (nx < 1 AND nx > -3)) LIMIT 300").bind(...want).all()).results || [];
  if (!rows.length) return null;
  const syms = [...new Set(rows.map(r => r.sym))].slice(0, 6), batch = rows.filter(r => syms.includes(r.sym));
  const ids = batch.map(r => r.id);
  await env.BT.prepare('UPDATE sig SET nx = coalesce(nx, 0) - 1 WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).run();
  const got = await fetchBarsTV(env, syms.map(s => 'BIST:' + s), '1D', 15, 8000);
  let n = 0, bekle = 0;
  for (const r of batch) {
    const st = got['BIST:' + r.sym], daily = st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
    if (!daily.length) continue;   // veri gelmedi → deneme sayısı arttı, sonra yeniden
    const o = nextDayOf(daily, r);
    if (!o) { bekle++; await env.BT.prepare('UPDATE sig SET nx = coalesce(nx, 0) + 1 WHERE id = ?').bind(r.id).run(); continue; }   // ertesi gün mumu yok (tatil) → denemeyi geri al
    await env.BT.prepare('UPDATE sig SET ng = ?, nh = ?, nl = ?, nc = ?, nt = ?, nx = 1 WHERE id = ?').bind(o.ng, o.nh, o.nl, o.nc, o.nt, r.id).run();
    n++;
  }
  return { ertesi: n, bekleyen: bekle, hisse: syms, kalan: rows.length - batch.length };
}
const SRC_AD = { radar: '📡 Sunucu radarı (mesajı kapalı)', algi: '⚡ Algı', 'firsat-A': '🅰️ Fırsat A', 'firsat-B': '🅱️ Fırsat B', momentum: '🧪 Momentum (deneme)', tavan6: '🚀 Tavan · sakin açılış (deneme)' };
const KAP_TR = { is: 'Yeni iş/sözleşme', ihale: 'İhale', geri: 'Geri alım', bedelsiz: 'Bedelsiz', bedelli: 'Bedelli', tahsisli: 'Sermaye artırımı', teklif: 'Pay alım teklifi', birlesme: 'Birleşme/devir', tesvik: 'Teşvik', temettu: 'Temettü', bilanco: 'Bilanço', not: 'Kredi notu', icerden: 'İçeriden alım-satım', yatirim: 'Yatırım', varlik: 'Varlık alım/satım', ozel: 'Özel durum', risk: 'Risk (konkordato vb.)', kisit: 'İşlem kısıtı', ceza: 'Ceza/dava' };
// v6.6 FİLTRE KONTROLÜ — araştırmada bulunan iki filtre kendi sinyallerimizde de tutuyor mu? (tüm günler, yalnız AL, KAP hariç)
// Endeks: sinyal anında XU100 önceki kapanışa göre artıda mı (idx ≥ 0). Oynaklık: son 20 gün ortalama günlük aralık %5 ve üstü mü (adr).
export async function filterBlock(env, pc) {
  try {
    await sigEnsure(env);
    const f = await env.BT.prepare("SELECT sum(idx >= 0 AND o31 = 1) eah, sum(idx >= 0 AND o31 = 2) eas, sum(idx < 0 AND o31 = 1) eeh, sum(idx < 0 AND o31 = 2) ees, sum(adr >= 5 AND o31 = 1) oyh, sum(adr >= 5 AND o31 = 2) oys, sum(adr < 5 AND o31 = 1) sah, sum(adr < 5 AND o31 = 2) sas FROM sig WHERE done = 1 AND err IS NULL AND dir = 'AL' AND src NOT LIKE 'kap-%'").first();
    if (!f) return '';
    const v = k => +f[k] || 0;
    const ln = (ad, h, s) => '\n   ' + ad + ': ' + (h + s ? (h + s) + ' sinyal → <b>%' + pc(h, h + s) + '</b>' : 'henüz yok');
    if (!(v('eah') + v('eas') + v('eeh') + v('ees'))) return '';
    return '\n\n🔎 <b>Filtre kontrolü</b> <i>(tüm günler, Fırsat/Algı/Radar)</i>' +
      ln('Endeks artıdayken', v('eah'), v('eas')) + ln('Endeks ekside iken', v('eeh'), v('ees')) +
      ln('Oynak hisselerde (günde %5 ve üstü)', v('oyh'), v('oys')) + ln('Sakin hisselerde (günde %5 altı)', v('sah'), v('sas'));
  } catch (e) { return ''; }
}
// v12.1 (16.10, Fatih onayı, DEVIR 6o): Momentum'da TEKRAR EDEN hisse (son 6 takvim gününde de Momentum vermiş) ayrı satır.
// Canlı 05–16.10: tekrar 12 işlem 1 kazandı, tekrarsız 35 işlem +3,2 puan. Kural değil, ölçüm (sig_d indeksi, ~5 satır/gün).
export function momRep(rows) {
  const by = {}; for (const r of rows) (by[r.sym] = by[r.sym] || []).push(r.d);
  return rows.map(r => Object.assign({}, r, { rep: by[r.sym].some(d => d < r.d && Date.parse(d) >= Date.parse(r.d) - 6 * 86400e3) }));
}
async function momRepLine(env, today, pc) {
  const R = (await env.BT.prepare("SELECT sym, d, o31 FROM sig INDEXED BY sig_d WHERE d >= ? AND src = 'momentum' AND dir = 'AL' AND err IS NULL").bind(trDay(Date.now() - 70 * 86400e3)).all()).results || [];
  const X = momRep(R).filter(r => Date.parse(r.d) >= Date.parse(today) - 60 * 86400e3), T = X.filter(r => r.d === today && r.rep);
  const st = a => { const h = a.filter(r => r.o31 === 1).length, s = a.filter(r => r.o31 === 2).length; return a.length + ' → ' + (h + s ? '%' + pc(h, h + s) : '-'); };
  const rp = X.filter(r => r.rep), nr = X.filter(r => !r.rep);
  if (!rp.length) return '';
  return '\n   ⚠️ tekrar eden hisse' + (T.length ? ' (bugün ' + T.map(r => r.sym).join(', ') + ')' : '') + ': ' + st(rp) + ' · tekrarsız: ' + st(nr);
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
  // momentum ±%1,5 ile ölçülür (araştırması öyle) → h/s o15'ten
  const HS = 'o31';   // v9.0: −%1'e düşmeden +%3 geldi mi
  const R = (await env.BT.prepare("SELECT src, count(*) n, sum(" + HS + " = 1) h, sum(" + HS + " = 2) s FROM sig WHERE d = ? AND err IS NULL AND done = 1 AND src <> 'kap-devre' GROUP BY src ORDER BY n DESC").bind(today).all()).results || [];
  if (!R.length) { if (!force) await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sigsum', ?)").bind(today).run(); return { mesaj: 'bugün sinyal yok' }; }
  const A = (await env.BT.prepare("SELECT src, count(*) n, sum(" + HS + " = 1) h, sum(" + HS + " = 2) s, count(DISTINCT d) g FROM sig WHERE err IS NULL AND done = 1 AND src <> 'kap-devre' GROUP BY src").bind().all()).results || [];
  // 03.10: Algı 'güçlü' (alıcı oranı ≥%80) ayrı ölçülür — bir hafta sonra yalnız güçlüler gönderilsin mi kararı için
  const AG = (await env.BT.prepare("SELECT (json_extract(meta, '$.fc') >= 0.8) g, sum(d = ?) n, sum(d = ? AND o31 = 1) h, sum(d = ? AND o31 = 2) s, count(*) tn, sum(o31 = 1) th, sum(o31 = 2) ts FROM sig WHERE src = 'algi' AND err IS NULL AND done = 1 GROUP BY 1").bind(today, today, today).all()).results || [];
  const best = (await env.BT.prepare("SELECT sym, max(mfe) mfe FROM sig WHERE d = ? AND err IS NULL AND done = 1 AND src <> 'kap-devre' GROUP BY sym ORDER BY mfe DESC LIMIT 3").bind(today).all()).results || [];
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const line = (h, s) => (h + s ? (h ? '✅ ' + h + ' kazandı' : '') + (h && s ? ' · ' : '') + (s ? '❌ ' + s + ' kaybetti' : '') + ' → <b>%' + pc(h, h + s) + '</b>' : 'sonuçlanan yok');
  const d = today.split('-');
  let msg = '📊 <b>Sinyal karnesi</b>   <i>' + d[2] + '.' + d[1] + '</i>\n<i>Başarı: sinyalden sonra −%1\'e düşmeden +%3 geldi mi? (gün içinde ikisi de gelmeyen sayılmaz)</i>';
  // v10.8: en üstte kısa piyasa özeti (18:12'de tavan.js mktClose → meta 'mkt_close'; yoksa bölüm çıkmaz)
  try { const mk = await env.BT.prepare("SELECT v FROM meta WHERE k = 'mkt_close'").first(); const mv = mk ? JSON.parse(mk.v) : null; if (mv && mv.d === today) msg += mktBlock(mv, esc); } catch (e) {}
  const ORD = ['firsat-A', 'firsat-B', 'algi', 'momentum', 'radar'], rk = x => { const i = ORD.indexOf(x); return i < 0 ? 99 : i; };
  for (const r of R.filter(r => !String(r.src).startsWith('kap-') && r.src !== 'tavan' && r.src !== 'sessiz' && r.src !== 'dunguclu' && r.src !== 'oglen').sort((a, b) => rk(a.src) - rk(b.src))) {
    msg += '\n\n<b>' + esc(SRC_AD[r.src] || r.src) + '</b> — ' + r.n + ' sinyal\n   ' + line(r.h, r.s);
    const a = A.find(x => x.src === r.src);
    if (a && a.g > 1) msg += '\n   <i>tüm günler: ' + a.n + ' sinyal → %' + pc(a.h, a.h + a.s) + '</i>';
    if (r.src === 'momentum') { try { msg += await momRepLine(env, today, pc); } catch (e) {} }
    if (r.src === 'algi') for (const g of AG) if (g.n) msg += '\n   ' + (g.g ? '💪 güçlü (alıcı %80+)' : '· diğerleri') + ': ' + g.n + ' → ' + (g.h + g.s ? '%' + pc(g.h, g.h + g.s) : '-') + (g.tn > g.n ? ' <i>(tüm günler ' + g.tn + ' → %' + pc(g.th, g.th + g.ts) + ')</i>' : '');
  }
  const K = R.filter(r => String(r.src).startsWith('kap-'));
  if (K.length) {
    const kn = K.reduce((x, r) => x + r.n, 0), kh = K.reduce((x, r) => x + r.h, 0), ks = K.reduce((x, r) => x + r.s, 0);
    msg += '\n\n<b>📰 KAP haberleri</b> — ' + kn + ' haber · ' + (kh + ks ? '%' + pc(kh, kh + ks) : '-');
    K.filter(r => r.h + r.s > 0).slice(0, 5).forEach(r => { msg += '\n   ' + esc(KAP_TR[r.src.slice(4)] || r.src.slice(4)) + ': ' + r.n + ' → %' + pc(r.h, r.h + r.s); });
  }
  // v8.2 tavan takibi: en son ölçülen tavan grubu (dün tavan kapananların bugünkü açılışı)
  try {
    const tv = await env.BT.prepare("SELECT d, count(*) n, avg(pre) g, sum(pre > 0) up FROM sig WHERE src = 'tavan' AND done = 1 AND err IS NULL AND pre IS NOT NULL GROUP BY d ORDER BY d DESC LIMIT 1").first();
    const ta = await env.BT.prepare("SELECT count(*) n, avg(pre) g, sum(pre > 0) up FROM sig WHERE src = 'tavan' AND done = 1 AND err IS NULL AND pre IS NOT NULL").first();
    if (tv && tv.n) msg += '\n\n🚀 <b>Tavan takibi (deneme)</b> — önceki gün tavan kapanan ' + tv.n + ' hisse, ' + tv.d.slice(8) + '.' + tv.d.slice(5, 7) + ' açılışı\n   açılış ortalaması ' + (tv.g >= 0 ? '+' : '') + '%' + (+tv.g).toFixed(1) + ' · ' + tv.up + '/' + tv.n + ' yukarı açıldı' + (ta && ta.n > tv.n ? '\n   <i>tüm günler: ' + ta.n + ' hisse → ort. ' + (ta.g >= 0 ? '+' : '') + '%' + (+ta.g).toFixed(1) + ', %' + pc(ta.up, ta.n) + ' yukarı</i>' : '');
  } catch (e) {}
  if (best.length) msg += '\n\n🏆 <b>Günün en iyileri</b>: ' + best.map(b => esc(b.sym) + ' +%' + Math.round(b.mfe)).join(' · ');
  msg += await filterBlock(env, pc);
  msg += await paperLine(env, today);
  if (pend) msg += '\n\n⏳ ' + pend + ' sinyal için veri gelmedi; ölçülünce genel toplamlara eklenecek.';
  const cfg = await kvGet(env, 'cfg', null);
  msg = tgQuote(msg);   // v10.6: alt satırlar alıntı kutusunda
  const t = await tgSend(cfg, msg);
  if (!force) {
    if (t && t.ok) await env.BT.batch([
      env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sigsum', ?)").bind(today),
      env.BT.prepare("DELETE FROM meta WHERE k = 'sigsum_try'")]);
    else { await errAdd(env, 'sunucu', 'hata', 'karne raporu gönderilemedi: ' + String(t && t.error || '?').slice(0, 120), 'sigSummary'); await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('sigsum_try', ?)").bind(JSON.stringify({ d: today, n: tryN, at: now, err: String(t && t.error || '').slice(0, 120) })).run(); }
  }
  return { gonderildi: !!(t && t.ok), msg };
}
// v7.9 ŞİMDİ · CANLI TAKİP — bugünün sinyalleri (KAP hariç); motorun gönderdikleri telefonda da görünsün. 30 sn önbellek.
let todayCache = { at: 0, v: null };
// v14.1 (21.10, Fatih: 'Algı bana gelmemiş, arkadaşlara farklı gelmiş'): src='algi' → yalnız bugünün Algı ateşlemeleri (ana sunucunun karnesi = tek kaynak; her telefon bunu gösterir)
let algiCache = { at: 0, v: null };
export async function sigToday(env, src) {
  if (!env.BT) return { ok: false, error: 'D1 yok' };
  if (src === 'algi') {
    if (algiCache.v && Date.now() - algiCache.at < 20e3) return algiCache.v;
    await sigEnsure(env);
    const a0 = Date.parse(trDay(Date.now()) + 'T00:00:00Z') - TRMS;
    const rs = (await env.BT.prepare("SELECT t, sym, px, sc, meta, done, o31, mfe, mae, rc FROM sig INDEXED BY sig_t WHERE t >= ? AND src = 'algi' ORDER BY t DESC LIMIT 120").bind(a0).all()).results || [];
    const v = { ok: true, at: Date.now(), list: rs.map(r => { let m = null; try { m = r.meta ? JSON.parse(r.meta) : null; } catch (e) {} return { ...r, meta: m }; }) };
    algiCache = { at: Date.now(), v };
    return v;
  }
  if (todayCache.v && Date.now() - todayCache.at < 30e3) return todayCache.v;
  await sigEnsure(env);
  const d0 = Date.parse(trDay(Date.now()) + 'T00:00:00Z') - TRMS;
  const rows = (await env.BT.prepare("SELECT t, src, sym, dir, px, sc, meta, done, o10, o15, o31, mfe, mae, rc FROM sig INDEXED BY sig_t WHERE t >= ? AND src NOT LIKE 'kap-%' AND src NOT IN ('sessiz','dunguclu','oglen') ORDER BY t DESC LIMIT 60").bind(d0).all()).results || [];
  const v = { ok: true, at: Date.now(), list: rows.map(r => { let m = null; try { m = r.meta ? JSON.parse(r.meta) : null; } catch (e) {} return { ...r, meta: m }; }) };
  todayCache = { at: Date.now(), v };
  return v;
}
// v6.9 KARNE EKRANI — terminalin Karne sekmesi için son ~2 haftanın özeti (5 dk önbellek; okuma sınırı için sig_d indeksi kullanılır)
let statCache = { at: 0, v: null };
// v11.4: (d, src, u) satırlarını (d, src) toplamına indir
export function statFold(raw) {
  const M = new Map();
  for (const r of raw) { const k = r.d + '|' + r.src, x = M.get(k) || { d: r.d, src: r.src, n: 0, h: 0, s: 0, r0: 0 }; x.n += r.n; x.h += r.h || 0; x.s += r.s || 0; x.r0 += r.r0 || 0; M.set(k, x); }
  return [...M.values()];
}
export async function sigStats(env) {
  if (!env.BT) return { ok: false, error: 'D1 yok' };
  if (statCache.v && Date.now() - statCache.at < 5 * 60e3) return statCache.v;
  // v11.0 (15.10, Fatih onayıyla) OKUMA TASARRUFU: sonuç D1 meta 'stat_v' içinde 10 dk ortak önbellek (her çalışma örneği ayrı okumasın)
  try {
    const p = await env.BT.prepare("SELECT v FROM meta WHERE k = 'stat_v'").first();
    const pv = p ? JSON.parse(p.v) : null;
    if (pv && pv.ok && Date.now() - pv.at < 10 * 60e3) { statCache = { at: pv.at, v: pv }; return pv; }
  } catch (e) {}
  await sigEnsure(env);
  const from = trDay(Date.now() - 16 * 86400e3);
  // v11.4: piyasa yönüne göre ayrım (u = sinyal anında XU100 artıda 1 / ekside 0 / bilinmiyor null) ve işlem başı ortalama sonuç
  // (r0 = ne hedef ne stop olanların gün sonu toplamı → ort. = (3·h − s + r0) / n). Pusula ana sayfası 'Bugünkü gibi günlerde' için kullanır.
  const raw = (await env.BT.prepare("SELECT d, src, CASE WHEN idx IS NULL THEN NULL WHEN idx >= 0 THEN 1 ELSE 0 END u, count(*) n, sum(o31 = 1) h, sum(o31 = 2) s, sum(CASE WHEN o31 = 0 THEN rc END) r0 FROM sig WHERE d >= ? AND done = 1 AND err IS NULL AND src <> 'kap-devre' GROUP BY d, src, u").bind(from).all()).results || [];
  const rows = statFold(raw);
  const days = [...new Set(rows.map(r => r.d))].sort().reverse().slice(0, 10);
  const src = {}, up = {}, dn = {};
  const add = (M, k, r) => { const x = M[k] || (M[k] = { n: 0, h: 0, s: 0, r0: 0 }); x.n += r.n; x.h += r.h || 0; x.s += r.s || 0; x.r0 += r.r0 || 0; };
  for (const r of rows) if (days.includes(r.d)) add(src, r.src, r);
  for (const r of raw) if (days.includes(r.d) && r.u != null) add(r.u ? up : dn, r.src, r);
  for (const M of [src, up, dn]) for (const k in M) M[k].r0 = Math.round(M[k].r0 * 100) / 100;
  const byDay = days.map(d => ({ d, src: Object.fromEntries(rows.filter(r => r.d === d).map(r => [r.src, { n: r.n, h: r.h || 0, s: r.s || 0 }])) }));
  const last = days[0] || null;
  const list = last ? ((await env.BT.prepare("SELECT t, src, sym, o31 o10, mfe, rc FROM sig WHERE d = ? AND done = 1 AND err IS NULL AND src NOT LIKE 'kap-%' ORDER BY t DESC LIMIT 40").bind(last).all()).results || []) : [];
  const pend = await env.BT.prepare('SELECT count(*) n FROM sig WHERE done = 0 AND t < ?').bind(Date.now()).first();
  const v = { ok: true, at: Date.now(), gun: days.length, days: byDay, src, up, dn, last, list, bekleyen: pend ? pend.n : 0 };
  statCache = { at: Date.now(), v };
  try { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('stat_v', ?)").bind(JSON.stringify(v)).run(); } catch (e) {}
  return v;
}

// v8.2 HAFTALIK RAPOR — Cuma, günlük karne gittikten sonra bir kez. Son 7 günün özeti + sade öneriler.
// v10.6 (14.10, Fatih onayıyla): Momentum'u farklı çıkışlarla yan yana — her sinyale 100.000 TL girilseydi (kayma hariç).
// Yarış sonucu: 1 hedef, 2 stop, 0 ikisi de yok → gün sonu (rc). Ölçülmemiş (null / negatif) satır o çıkışta sayılmaz.
export const MOM_EXITS = [
  { k: 'o31', ad: '+%3 hedef / −%1 stop (şu anki mesaj)', tg: 3, sl: 1 },
  { k: 'o315', ad: '+%3 hedef / −%1,5 stop', tg: 3, sl: 1.5 },
  { k: 'o15', ad: '±%1,5', tg: 1.5, sl: 1.5 },
  { k: 'h1', ad: 'Hedefsiz, −%1 stop, gün sonu sat', h: true }
];
export function momExits(rows, amt = 100000) {
  return MOM_EXITS.map(e => {
    let n = 0, w = 0, l = 0, pct = 0;
    for (const r of rows) {
      let p;
      if (e.h) { if (r.h1 == null) continue; p = +r.h1; if (p <= -1 + 1e-9) l++; else if (p > 0) w++; }
      else { const o = r[e.k]; if (o == null || o < 0 || (o === 0 && r.rc == null)) continue; p = o === 1 ? e.tg : o === 2 ? -e.sl : +r.rc; if (o === 1) w++; else if (o === 2) l++; }
      n++; pct += p;
    }
    return { k: e.k, ad: e.ad, n, w, l, tl: Math.round(pct * amt / 100) };
  });
}
export async function weeklySummary(env, tgSend, kvGet, esc, pushSend) {
  const d = new Date(Date.now() + TRMS), wd = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes(), today = d.toISOString().slice(0, 10);
  if (wd !== 5 || m < 1110) return null;
  const ss = await env.BT.prepare("SELECT v FROM meta WHERE k = 'sigsum'").first(); if (!ss || ss.v !== today) return null;
  const ws = await env.BT.prepare("SELECT v FROM meta WHERE k = 'weeksum'").first(); if (ws && ws.v === today) return null;
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('weeksum', ?)").bind(today).run();
  const from = new Date(Date.now() + TRMS - 6 * 864e5).toISOString().slice(0, 10);
  const HS = 'o31';   // v9.0: −%1'e düşmeden +%3 geldi mi
  const R = (await env.BT.prepare("SELECT src, count(*) n, sum(" + HS + " = 1) h, sum(" + HS + " = 2) s, avg(rc) rc FROM sig WHERE d >= ? AND done = 1 AND err IS NULL AND src NOT LIKE 'kap-%' AND src <> 'tavan' GROUP BY src").bind(from).all()).results || [];
  const AG = (await env.BT.prepare("SELECT (json_extract(meta, '$.fc') >= 0.8) g, sum(o31 = 1) h, sum(o31 = 2) s FROM sig WHERE src = 'algi' AND d >= ? AND done = 1 AND err IS NULL GROUP BY 1").bind(from).all()).results || [];
  const K = (await env.BT.prepare("SELECT src, count(*) n, sum(o31 = 1) h, sum(o31 = 2) s FROM sig WHERE d >= ? AND done = 1 AND err IS NULL AND src LIKE 'kap-%' AND src <> 'kap-devre' GROUP BY src HAVING n >= 8").bind(from).all()).results || [];
  const T = await env.BT.prepare("SELECT count(*) n, avg(pre) g, sum(pre > 0) up FROM sig WHERE src = 'tavan' AND d >= ? AND done = 1 AND err IS NULL AND pre IS NOT NULL").bind(from).first();
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const AD = { 'firsat-A': '🅰️ Fırsat A', 'firsat-B': '🅱️ Fırsat B', algi: '⚡ Algı', momentum: '🧪 Momentum (deneme)', radar: '📡 Radar (mesajı kapalı)', tavan6: '🚀 Tavan · sakin açılış' };
  const ORD = ['firsat-A', 'firsat-B', 'algi', 'momentum', 'radar'];
  let msg = '🗓 <b>Haftalık karne</b> · ' + from.slice(8) + '.' + from.slice(5, 7) + ' – ' + today.slice(8) + '.' + today.slice(5, 7) + '\n<i>Başarı: −%1\'e düşmeden +%3 geldi mi?</i>';
  const oner = [];
  for (const k of ORD) {
    const r = R.find(x => x.src === k); if (!r) continue; const t = r.h + r.s, p = pc(r.h, t);
    msg += '\n\n<b>' + AD[k] + '</b> — ' + r.n + ' sinyal · ' + (t ? r.h + ' kazandı, ' + r.s + ' kaybetti → <b>%' + p + '</b>' : 'sonuçlanan yok');
    if (k === 'algi') for (const g of AG) { const tt = g.h + g.s; if (tt) msg += '\n   ' + (g.g ? '💪 güçlü' : '· diğerleri') + ': %' + pc(g.h, tt) + ' (' + tt + ')'; }
    if (t >= 15 && k !== 'radar') { if (p < 45) oner.push(AD[k] + ' zayıf (%' + p + ') — sıkılaştırmayı ya da kapatmayı konuşalım.'); else if (p >= 58) oner.push(AD[k] + ' iyi gidiyor (%' + p + ').'); }
    if (k === 'momentum') oner.push(t < 10 ? 'Momentum denemesinde henüz az veri var (' + t + ' sonuç); izlemeye devam.' : p >= 58 ? 'Momentum canlıda da tutuyor (%' + p + ') — gerçek sinyale çevirmeyi önerebilirim.' : 'Momentum canlıda beklentinin altında (%' + p + '); bir hafta daha izleyelim.');
  }
  const gs = AG.find(g => g.g), go = AG.find(g => !g.g);
  if (gs && go && gs.h + gs.s >= 8 && go.h + go.s >= 8) { const a = pc(gs.h, gs.h + gs.s), b = pc(go.h, go.h + go.s); if (a - b >= 10) oner.push('Algı\'da güçlüler (%' + a + ') diğerlerinden (%' + b + ') belirgin iyi — yalnız güçlüleri göndermeyi önerebilirim.'); }
  try {
    const MR = (await env.BT.prepare("SELECT o31, o315, o15, h1, rc FROM sig INDEXED BY sig_d WHERE d >= ? AND src = 'momentum' AND dir = 'AL' AND done = 1 AND err IS NULL").bind(from).all()).results || [];
    const ME = momExits(MR).filter(x => x.n);
    if (ME.length) {
      const tl = v => (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('tr-TR') + ' TL';
      msg += '\n\n🧪 <b>Momentum — hangi çıkış kazandırdı?</b>\n<i>Her sinyale 100.000 TL girilseydi (kayma hariç)</i>';
      [...ME].sort((a, b) => b.tl - a.tl).forEach((x, i) => { msg += '\n   ' + (i + 1) + '. ' + esc(x.ad) + ': <b>' + tl(x.tl) + '</b> (' + x.n + ' işlem, ' + x.w + ' kazandı, ' + x.l + ' stop)'; });
    }
  } catch (e) {}
  if (T && T.n) msg += '\n\n🚀 <b>Tavan takibi</b> — ' + T.n + ' hisse · açılış ort. ' + (T.g >= 0 ? '+' : '') + '%' + (+T.g).toFixed(1) + ' · %' + pc(T.up, T.n) + ' yukarı açıldı';
  if (K.length) { msg += '\n\n📰 <b>KAP (en iyi ve en kötü)</b>'; const ks = K.map(r => ({ k: r.src.slice(4), n: r.n, p: pc(r.h, r.h + r.s) })).sort((a, b) => b.p - a.p); [...ks.slice(0, 2), ...ks.slice(-2)].filter((x, i, a) => a.indexOf(x) === i).forEach(x => { msg += '\n   ' + esc(KAP_TR[x.k] || x.k) + ': %' + x.p + ' (' + x.n + ')'; }); }
  try { const P = await paperCalc(env, true), W = P.days.filter(x => x.d >= from); if (W.length) { const pl = W.reduce((a, x) => a + x.pl, 0), n = W.reduce((a, x) => a + x.n, 0); msg += '\n\n🤖 <b>Kâğıt üzerinde bot</b> — bu hafta ' + n + ' işlem → <b>' + (pl >= 0 ? '+' : '−') + Math.abs(pl).toLocaleString('tr-TR') + ' TL</b> · ' + W.filter(x => x.pl > 0).length + '/' + W.length + ' gün kârda'; }
    const BR = (P.bots || []).filter(b => b.n && !QUIET_BOTS.has(b.k)); if (BR.length) { msg += '\n🏁 <b>Bot yarışı</b> (bu hafta)'; [...BR].sort((a, b) => b.hafta - a.hafta).forEach((b, i) => { msg += '\n   ' + (i + 1) + '. ' + esc(b.ad) + ': ' + (b.hafta >= 0 ? '+' : '−') + Math.abs(b.hafta).toLocaleString('tr-TR') + ' TL'; }); } } catch (e) {}
  if (oner.length) msg += '\n\n💡 <b>Öneriler</b>\n' + oner.map(x => '• ' + esc(x)).join('\n');
  msg += '\n\n<i>Hiçbir değişiklik onayın olmadan yapılmaz.</i>';
  const cfg = await kvGet(env, 'cfg', null);
  const t = await tgSend(cfg, tgQuote(msg));   // v10.6
  try { await pushSend(env, { cat: 'rapor', title: '🗓 Haftalık karne hazır', body: R.map(r => (AD[r.src] || r.src).replace(/^\S+ /, '') + ' %' + pc(r.h, r.h + r.s)).join(' · ').slice(0, 220), url: './', tag: 'hafta' + today }, 3); } catch (e) {}
  return { gonderildi: !!(t && t.ok) };
}

// v11.5 HABER ÖLÇÜMÜ (hb): sinyal anında hissenin önceki iş günü 18:00'den beri KAP haberi var mıydı? Seans dışında, karne/ertesi gün işi yokken
// en çok 10 dk'da bir, her seferinde BİR gün (meta 'hb_day' = bitmiş son gün, 'hb_at' = son deneme). Okuma: o günün sinyalleri (sig_d) + pencere KAP'ları (kap_t).
export function newsGap(sigs, kaps, from) {
  const M = new Map();
  for (const k of kaps) { if (!(k.onem >= 1) || k.tip === 'devre' || k.t < from) continue; for (const s of String(k.syms || '').split(',')) { if (!s) continue; const a = M.get(s) || []; a.push(k.t); M.set(s, a); } }
  return sigs.map(r => { let best = null; for (const t of M.get(r.sym) || []) if (t <= r.t && (best == null || t > best)) best = t; return { id: r.id, hb: best == null ? -1 : Math.round((r.t - best) / 60000) }; });
}
const prevBD = d => { let x = Date.parse(d + 'T00:00:00Z'); do { x -= 864e5; } while ([0, 6].includes(new Date(x).getUTCDay())); return new Date(x).toISOString().slice(0, 10); };
export async function sigNews(env, now = Date.now()) {
  const at = await env.BT.prepare("SELECT v FROM meta WHERE k = 'hb_at'").first();
  if (at && now - +at.v < 10 * 60e3 && now >= +at.v) return null;
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('hb_at', ?)").bind(String(now)).run();
  const today = trDay(now), m = trMin(now), wd = new Date(today + 'T00:00:00Z').getUTCDay();
  const closed = (wd >= 1 && wd <= 5 && m >= 1095) ? today : trDay(now - 864e5);
  const hd = await env.BT.prepare("SELECT v FROM meta WHERE k = 'hb_day'").first();
  let d = hd && hd.v ? hd.v : '2026-09-28';
  for (let i = 0; i < 20; i++) {
    d = new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
    if (d > closed) return null;
    if ([0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay())) continue;
    const sigs = (await env.BT.prepare("SELECT id, t, sym FROM sig INDEXED BY sig_d WHERE d = ? AND hb IS NULL AND src NOT LIKE 'kap-%' LIMIT 500").bind(d).all()).results || [];
    if (!sigs.length) { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('hb_day', ?)").bind(d).run(); continue; }
    const from = Date.parse(prevBD(d) + 'T18:00:00Z') - TRMS, to = Math.max(...sigs.map(r => r.t)) + 1;
    const kaps = (await env.BT.prepare('SELECT t, syms, onem, tip FROM kap INDEXED BY kap_t WHERE t >= ? AND t < ?').bind(from, to).all()).results || [];
    const R = newsGap(sigs, kaps, from), st = env.BT.prepare('UPDATE sig SET hb = ? WHERE id = ?');
    for (let k = 0; k < R.length; k += 100) await env.BT.batch(R.slice(k, k + 100).map(x => st.bind(x.hb, x.id)));
    if (sigs.length < 500) await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('hb_day', ?)").bind(d).run();
    return { haber_olcumu: d, sinyal: R.length, haberli: R.filter(x => x.hb >= 0).length };
  }
  return null;
}
