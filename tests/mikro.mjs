// MİKRO MOTOR (pc/mikro) — sentetik senaryolar: şema, ölçüler, spoofing, iki aşamalı sinyal, kapılar, kopma/bayat veri, sonuç takibi.
import { MIKRO_DEF, cfgMerge } from '../pc/mikro/config.mjs';
import { validateEvent } from '../pc/mikro/schema.mjs';
import { tickOf, tickUp, tickDown, trMin } from '../pc/mikro/ticks.mjs';
import { obi, spreadInfo, gaps, clearSec } from '../pc/mikro/metrics.mjs';
import { Book } from '../pc/mikro/book.mjs';
import { Engine } from '../pc/mikro/engine.mjs';
import { levelsOf } from '../pc/mikro/score.mjs';
import { replay } from '../pc/mikro/adapters/replay.mjs';
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const cfg = cfgMerge({});
const T11 = Date.UTC(2026, 10, 23, 8, 0, 0);   // Pazartesi 11:00 İstanbul
const r2 = x => Math.round(x * 100) / 100;

// ---- olay üreticileri
const ev = (type, sym, rts, body, seq) => ({ v: 1, src: 'test', sym, type, ts: rts, rts, seq: seq ?? null, [type]: body });
const hb = rts => ({ v: 1, src: 'test', type: 'hb', rts, hb: { robotTs: rts } });
// ask1'den başlayan 10 kademe (adım 0,02); bid1 = ask1 − 0,02
function snap(sym, t, ask1, aQ, bQ) {
  const asks = [], bids = [];
  for (let i = 0; i < 10; i++) { asks.push([r2(ask1 + 0.02 * i), typeof aQ === 'function' ? aQ(i) : aQ, null]); bids.push([r2(ask1 - 0.02 * (i + 1)), typeof bQ === 'function' ? bQ(i) : bQ, null]); }
  return ev('book', sym, t, { snap: true, bids, asks });
}
const trade = (sym, t, px, qty, side) => ev('trade', sym, t, { px, qty, side, buyer: null, seller: null, id: null });

// ---- 1) şema
ok(validateEvent(snap('THYAO', T11, 40, 1000, 1000)) === '', 'şema: geçerli defter görüntüsü');
ok(validateEvent(trade('THYAO', T11, 40, 10, 'B')) === '', 'şema: geçerli işlem');
ok(validateEvent({ v: 1, type: 'trade', sym: 'THYAO', rts: T11, trade: { px: -1, qty: 1, side: 'B' } }) === 'trade', 'şema: eksi fiyat reddedilir');
ok(validateEvent({ v: 2, type: 'hb', rts: T11 }) === 'şema sürümü', 'şema: bilinmeyen sürüm reddedilir');
ok(validateEvent({ v: 1, type: 'book', sym: 'thy ao', rts: T11, book: { snap: true, bids: [], asks: [] } }) === 'sembol', 'şema: bozuk sembol reddedilir');

// ---- 2) fiyat adımı, saat
ok(tickOf(19.99) === 0.01 && tickOf(40) === 0.02 && tickOf(75) === 0.05 && tickOf(300) === 0.25 && tickOf(3000) === 2.5, 'BIST fiyat adımları');
ok(tickUp(40.011) === 40.02 && tickDown(40.019) === 40 && tickUp(40.02) === 40.02, 'adıma yuvarlama');
ok(trMin(T11) === 660, 'İstanbul saati (UTC+3)');

// ---- 3) ölçü formülleri
{ const L = q => q.map(x => ({ eff: x })), o = obi(L([100, 100, 100]), L([50, 50, 50]), 3);
  ok(Math.abs(o - 1 / 3) < 1e-9, 'OBI 3: alış 300 / satış 150 → +0,333');
  const ow = obi(L([100, 0, 0]), L([0, 0, 100]), 3); ok(Math.abs(ow - (100 - 100 / 3) / (100 + 100 / 3)) < 1e-9, 'OBI ağırlığı 1/i (yakın kademe ağır)');
  const sp = spreadInfo(39.98, 40.00); ok(sp.t === 1 && Math.abs(sp.pct - 0.05) < 0.001, 'spread 1 adım, %0,05');
  ok(gaps([{ px: 40 }, { px: 40.02 }, { px: 40.08 }, { px: 40.1 }]) === 1, 'kademe boşluğu sayısı');
  ok(clearSec([{ tl: 50000 }, { tl: 50000 }, { tl: 50000 }, { tl: 1e9 }], 10000) === 15, 'erime süresi: 150 bin TL / 10 bin TL/sn = 15 sn'); }

// ---- 4) defter: erime / iptal / spoofing
{ const b = new Book('X', cfg), t = T11;
  b.apply(snap('X', t, 40, 1000, 1000));
  b.onTrade(40, 600, 'B', t + 100);
  b.apply(snap('X', t + 150, 40, i => i ? 1000 : 400, 1000));
  b.finalize(t + 1000);
  ok(b.levels('A')[0].q === 400 && b.pend.length === 0, 'işlemle azalan kademe = erime (iptal sayılmadı)');
  // büyük alış emri (kademe 5'te, 25.000 lot ≈ 1 Mn TL) 1 sn sonra işlemsiz silinir → sahte
  b.apply(snap('X', t + 2000, 40, 1000, i => i === 4 ? 25000 : 1000));
  ok(b.levels('B')[4].big, 'büyük emir işaretlendi (ortancanın 3 katı ve ≥500 bin TL)');
  b.apply(snap('X', t + 3000, 40, 1000, 1000)); b.finalize(t + 4000);
  ok(b.spoofRatio('B', t + 4000) === 1, 'fiyattan uzak, 1 sn yaşamış, işlemsiz silinen büyük emir → sahte');
  // büyük SATIŞ emri ilk kademede işlemle eritilir → sahte değil
  const c = new Book('Y', cfg);
  c.apply(snap('Y', t, 40, i => i ? 1000 : 25000, 1000));
  c.onTrade(40, 25000, 'B', t + 500);
  c.apply(snap('Y', t + 600, 40.02, 1000, 1000)); c.finalize(t + 2000);
  ok(c.eps.A.length === 1 && c.eps.A[0].fake === false, 'işlemle eriyen büyük emir sahte sayılmaz');
  // işlem kayıttan SONRA gelirse (sağlayıcı sırası) yine erime sayılır
  const d = new Book('Z', cfg);
  d.apply(snap('Z', t, 40, i => i ? 1000 : 25000, 1000));
  d.apply(snap('Z', t + 100, 40.02, 1000, 1000));
  d.onTrade(40, 25000, 'B', t + 250); d.finalize(t + 1000);
  ok(d.eps.A[0].fake === false, 'işlem azalmadan 150 ms sonra gelse de erime (bekleme payı)');
  // fiyat kayınca 10. kademe ekrandan düşer → iptal sayılmaz
  const e = new Book('W', cfg);
  e.apply(snap('W', t, 40, 1000, i => i === 9 ? 25000 : 1000));
  e.apply(snap('W', t + 500, 40.02, 1000, 1000)); e.finalize(t + 2000);
  ok(e.spoofRatio('B', t + 2000) === 0, 'görünen aralığın dışına itilen kademe sahte sayılmaz'); }

// ---- 5) motor senaryosu
const CTX = { ema20_15: 39.9, ema50_15: 39.7, h4: 1, abc: 'A' };
function mkEngine(over = {}, ctx = CTX, mkt = { idx5m: 0.1, adv: 2e8 }) {
  const out = []; const e = new Engine({ cfg: cfgMerge({ ...over }), context: () => ctx, market: () => mkt, emit: x => out.push(x) }); return { e, out };
}
// Isınma: 80 sn sakin piyasa (her sn kalp atışı, 3 sn'de bir küçük işlem)
function warm(e, sym, t0, dur = 80000) {
  e.onEvent(hb(t0)); e.onEvent(snap(sym, t0, 40, 2000, 2000));
  for (let t = t0 + 1000; t <= t0 + dur; t += 1000) {
    e.onEvent(hb(t)); if ((t - t0) % 3000 === 0) { e.onEvent(trade(sym, t, (t / 3000) % 2 ? 40 : 39.98, 60, 'U')); e.onEvent(snap(sym, t + 5, 40, 2000, 2000)); }
    e.tick(t);
  }
  return t0 + dur;
}
// Kurulum: alış tarafı ağır, satış ince (8 sn), sonra agresif alım satış kademelerini eritir
function setup(e, sym, t, follow = true) {
  for (let k = 0; k < 8; k++) { t += 1000; e.onEvent(hb(t)); e.onEvent(snap(sym, t, 40, 1000, 3000)); e.tick(t); }
  t += 200; e.onEvent(trade(sym, t, 40, 1000, 'B')); e.onEvent(snap(sym, t + 20, 40.02, 1000, 3000));
  t += 200; e.onEvent(trade(sym, t, 40.02, 1000, 'B')); e.onEvent(snap(sym, t + 20, 40.04, 1000, 3000));
  t += 200; e.onEvent(trade(sym, t, 40.04, 500, 'B')); e.onEvent(snap(sym, t + 20, 40.04, i => i ? 1000 : 500, 3000));
  const tCand = t + 20;
  if (follow) {
    t += 300; e.onEvent(trade(sym, t, 40.04, 500, 'B')); e.onEvent(snap(sym, t + 20, 40.06, 1000, 3000));
    for (const p of [40.06, 40.08, 40.10]) { t += 300; e.onEvent(trade(sym, t, p, 1000, 'B')); e.onEvent(snap(sym, t + 20, r2(p + 0.02), 1000, 3000)); }
  }
  return { t: t + 20, tCand };
}
{ const { e, out } = mkEngine();
  let t = warm(e, 'TEST', T11);
  ok(e.S.get('TEST').state === 'HAZIR', 'ısınma (60 sn) sonrası hisse HAZIR');
  const s = setup(e, 'TEST', t); t = s.t;
  const cand = out.find(x => x.st === 'cand'), conf = out.find(x => x.st === 'conf');
  ok(!!cand, 'alış ağır + satış ince + agresif alım → ADAY');
  ok(!!conf && conf.tc - conf.t0 <= cfg.confWin, 'karşı kademe eridi + agresif hacim + VWAP/trend uyumu → TEYİT (' + (conf ? conf.tc - conf.t0 : '-') + ' ms)');
  if (conf) {
    ok(conf.score >= 0 && conf.score <= 100 && conf.parts && 'obi' in conf.parts, 'güven skoru 0–100 ve parçaları (' + conf.score + ')');
    const L = conf.lv;
    ok(L.t1 >= L.entry * 1.005 - 1e-9 && L.t1 >= L.entry + 3 * tickOf(L.entry) - 1e-9 && L.t2 > L.t1, 'hedefler: H1 ≥ +%0,5 ve ≥ 3 adım, H2 > H1 (' + L.entry + ' → ' + L.t1 + ' / ' + L.t2 + ')');
    ok(L.stop < L.entry && L.stop >= L.entry * 0.99 - 1e-9, 'stop girişin altında ve en çok %1 (' + L.stop + ')');
    ok(conf.tg === false, 'gölge dönem: Telegram yok');
    ok(conf.ctx.abc === 'A' && conf.ctx.dVw != null, 'kayıtta bağlam (ABC notu, VWAP uzaklığı)');
    // sonrası: fiyat H1'e çıkar, 3 dk dolar
    for (let k = 1; k <= 200; k++) { t += 1000; e.onEvent(hb(t)); const a = r2(Math.min(L.t1 + 0.04, conf.pxe + 0.002 * k)); e.onEvent(snap('TEST', t, a, 1000, 3000)); e.tick(t); }
    const son = out.find(x => x.st === 'son');
    ok(son && son.hit === 'h1' && son.r30 != null && son.r60 != null && son.r180 != null && son.mfe > 0, 'sonuç: H1 ve 30 sn / 1 dk / 3 dk ölçüldü (' + (son ? son.hit + ' ' + son.r30 + '/' + son.r60 + '/' + son.r180 : '-') + ')');
  }
  // aynı hissede bekleme süresi
  const n0 = out.filter(x => x.st === 'conf').length;
  setup(e, 'TEST', t);
  ok(out.filter(x => x.st === 'conf').length === n0 && out.some(x => x.st === 'blok' && x.gate === 'bekleme süresi'), 'aynı hissede 10 dk bekleme (yeni sinyal yok)');
}
// Takip alımı gelmezse aday süresi dolar
{ const { e, out } = mkEngine();
  let t = warm(e, 'TEST', T11); const s = setup(e, 'TEST', t, false); t = s.t;
  for (let k = 0; k < 5; k++) { t += 1000; e.onEvent(hb(t)); e.tick(t); }
  const ex = out.find(x => x.st === 'exp');
  ok(!out.some(x => x.st === 'conf') && ex && ex.fail.includes('agresif alım yetersiz'), 'takip alımı yok → aday süresi doldu, neden kayıtlı (' + (ex ? ex.fail.join(', ') : '-') + ')'); }
// Bağlam uyumsuz (15 dk trend aşağı) → teyit yok
{ const { e, out } = mkEngine({}, { ...CTX, ema20_15: 40.5, ema50_15: 40.8 });
  let t = warm(e, 'TEST', T11); t = setup(e, 'TEST', t).t;
  for (let k = 0; k < 5; k++) { t += 1000; e.onEvent(hb(t)); e.tick(t); }
  ok(!out.some(x => x.st === 'conf') && out.some(x => x.st === 'exp' && x.fail.includes('15 dk trend yukarı değil')), '15 dk trend aşağı → teyit verilmez (onay katmanı)'); }
// Kovalama: fiyat günlük VWAP'tan %3'ten uzak
{ const { e, out } = mkEngine({}, { ...CTX, ema20_15: 39, ema50_15: 38 });
  let t = warm(e, 'TEST', T11);
  e.S.get('TEST').tape.pv = 38.5 * 1e6; e.S.get('TEST').tape.v = 1e6;   // gün ortalaması 38,50
  t = setup(e, 'TEST', t).t; for (let k = 0; k < 5; k++) { t += 1000; e.onEvent(hb(t)); e.tick(t); }
  ok(!out.some(x => x.st === 'conf') && out.some(x => x.st === 'exp' && x.fail.some(f => f.startsWith('kovalama'))), 'günlük VWAP\'tan +%3 uzak → kovalama, teyit yok'); }
// Kapılar: açılış saati, endeks düşüşü, tavana yakın
{ const T950 = Date.UTC(2026, 10, 23, 6, 50 - 2, 0);   // 09:48 İstanbul (+80 sn ısınma → 09:49)
  const { e, out } = mkEngine(); let t = warm(e, 'TEST', T950); setup(e, 'TEST', t);
  ok(!out.some(x => x.st === 'cand') && out.some(x => x.st === 'blok' && x.gate === 'açılış oynaklığı'), 'kapı: 09:40–10:05 açılış oynaklığı'); }
{ const { e, out } = mkEngine({}, CTX, { idx5m: -1.2, adv: 2e8 }); let t = warm(e, 'TEST', T11); setup(e, 'TEST', t);
  ok(out.some(x => x.st === 'blok' && x.gate === 'endeks sert düşüyor'), 'kapı: BIST 100 son 5 dk −%0,7\'den fazla düştü'); }
{ const { e, out } = mkEngine(); let t = warm(e, 'TEST', T11); e.onEvent(ev('quote', 'TEST', t, { tavan: 40.3, taban: 33 })); setup(e, 'TEST', t);
  ok(out.some(x => x.st === 'blok' && x.gate === 'tavana yakın'), 'kapı: tavana %1\'den yakın'); }
// Spoofing: alış ağırlığı TAZE büyük emirlerden geliyorsa aday açılmaz
{ const { e, out } = mkEngine(); let t = warm(e, 'TEST', T11);
  for (let k = 0; k < 8; k++) { t += 1000; e.onEvent(hb(t)); e.onEvent(snap('TEST', t, 40, 1000, i => i >= 2 && i < 5 ? (k % 2 ? 40000 : 39000) : 1000)); e.tick(t); }
  // her saniye yeniden yazılan dev emirler: yaşları 2 sn'yi geçse de spoof oranı yükselir mi? → önce sil-yaz döngüsü
  for (let k = 0; k < 6; k++) { t += 700; e.onEvent(snap('TEST', t, 40, 1000, 1000)); t += 700; e.onEvent(snap('TEST', t, 40, 1000, i => i >= 2 && i < 5 ? 40000 : 1000)); e.tick(t); }
  const S = e.S.get('TEST'); const sp = S.book.spoofRatio('B', t);
  t += 300; e.onEvent(trade('TEST', t, 40, 1000, 'B')); e.onEvent(snap('TEST', t + 20, 40.02, 1000, i => i >= 2 && i < 5 ? 40000 : 1000));
  ok(sp > 0.5, 'gelip giden dev alış emirleri sahte işaretlendi (oran ' + r2(sp) + ')');
  ok(!out.some(x => x.st === 'conf'), 'sahte alış duvarıyla şişen dengeye teyit verilmez'); }
// Kopma: kalp atışı durursa BAYAT, aday iptal; tam görüntü gelince ISINMA → HAZIR
{ const { e, out } = mkEngine(); let t = warm(e, 'TEST', T11);
  t += 5000; e.tick(t);
  ok(e.S.get('TEST').state === 'BAYAT', 'robottan 3 sn kalp atışı gelmezse BAYAT');
  e.onEvent(hb(t)); e.onEvent(ev('book', 'TEST', t, { snap: false, side: 'A', px: 40, qty: 10, op: 'upd' }));
  ok(e.S.get('TEST').state === 'BAYAT', 'tam görüntü gelmeden değişiklik kabul edilmez');
  e.onEvent(snap('TEST', t + 10, 40, 2000, 2000));
  ok(e.S.get('TEST').state === 'ISINMA', 'tam görüntü → ISINMA (60 sn)');
  for (let k = 0; k < 61; k++) { t += 1000; e.onEvent(hb(t)); e.tick(t); }
  ok(e.S.get('TEST').state === 'HAZIR', '60 sn sonra yeniden HAZIR'); }
// İşlem var ama defter güncellenmiyor → BAYAT
{ const { e } = mkEngine(); let t = warm(e, 'TEST', T11);
  for (let k = 0; k < 4; k++) { t += 1000; e.onEvent(hb(t)); e.onEvent(trade('TEST', t, 40, 10, 'B')); e.tick(t); }
  ok(e.S.get('TEST').state === 'BAYAT', 'işlem akıyor ama defter 2 sn güncellenmedi → BAYAT'); }
// Sıra numarası atlarsa BOZUK
{ const { e } = mkEngine(); const t = T11;
  e.onEvent({ ...snap('S2', t, 40, 1000, 1000), seq: 1 });
  e.onEvent(ev('book', 'S2', t + 10, { snap: false, side: 'A', px: 40, qty: 900, op: 'upd' }, 2));
  e.onEvent(ev('book', 'S2', t + 20, { snap: false, side: 'A', px: 40, qty: 800, op: 'upd' }, 5));
  ok(e.S.get('S2').state === 'BOZUK', 'sıra numarası atladı → BOZUK (tam görüntü bekler)'); }
// Hatalı olay sayılır, motoru durdurmaz
{ const { e } = mkEngine(); e.onEvent({ v: 1, type: 'trade', sym: 'X', rts: T11, trade: { px: 0 } }); e.onEvent(null);
  ok(e.g.bad === 2, 'hatalı olaylar işlenmez, sayılır'); }
// Günlük fren: üst üste 2 stop
{ const { e } = mkEngine(); e._son({ sym: 'A', hit: 'stop', ht: T11 }); e._son({ sym: 'B', hit: 'stop', ht: T11 });
  ok(e.g.brake === true, 'üst üste 2 stop → günlük fren'); }
// Seviyeler: duvarlar
{ const L = levelsOf(40, { wallA: 40.3, wallB: 39.9 }, cfg);
  ok(L.t1 === 40.2 && L.t2 === 40.28 && L.stop === 39.88, 'H2 = satış duvarının 1 adım altı, stop = alış duvarının 1 adım altı');
  const L2 = levelsOf(40, { wallB: 30 }, cfg); ok(L2.stop === 39.6, 'uzak duvar → stop en çok %1'); }
// Ayar birleştirme
{ const c = cfgMerge({ confWin: 1500, shadow: false, bilinmeyen: 5, obi3Min: 'x' });
  ok(c.confWin === 1500 && c.shadow === false && c.obi3Min === MIKRO_DEF.obi3Min && !('bilinmeyen' in c), 'sunucu ayarı yalnız bilinen ve doğru türdeki alanları değiştirir'); }
// Geri oynatma adaptörü
{ const { e, out } = mkEngine(); const lines = [];
  const cap = { onEvent: x => lines.push(JSON.stringify(x)), tick: () => {} };
  let t = warm(cap, 'TEST', T11); setup(cap, 'TEST', t);
  replay(lines, e);
  ok(out.some(x => x.st === 'conf'), 'kayıtlı günü geri oynatınca aynı sinyal çıkar (' + lines.length + ' satır)'); }

if (fail) { console.log(fail + ' kontrol BAŞARISIZ'); process.exit(1); }
console.log('mikro: hepsi geçti');
