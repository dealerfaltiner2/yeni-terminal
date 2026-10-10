// KAP geçmişi toplayıcı testi: tür ayırma, düz metin, seans saatinde çalışmama, liste → detay akışı.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const db = new DatabaseSync(':memory:');
const mk = (sql, a = []) => { const o = { bind: (...x) => mk(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => db.prepare(sql).run(...a), _run: () => db.prepare(sql).run(...a) }; return o; };
const env = { BT: { prepare: mk, batch: async L => L.map(x => x._run()) } };
db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
const res = []; const ok = (n, c, i) => { res.push(!!c); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
const { kaphKind, kaphText, kaphTime, kaphStep } = await import(path.join(W, 'kaph.js'));
ok('tür: yeni iş ilişkisi', kaphKind({ subject: 'Özel Durum Açıklaması (Genel)', summary: 'Yeni İş İlişkisi' }) === 'is');
ok('tür: sipariş', kaphKind({ subject: 'Özel Durum Açıklaması (Genel)', summary: 'Sipariş Alınması' }) === 'is');
ok('tür: içeriden', kaphKind({ subject: 'Pay Alım Satım Bildirimi', summary: 'x' }) === 'icerden');
ok('tür: geri alım', kaphKind({ subject: 'Payların Geri Alınmasına İlişkin Bildirim', summary: '15.10.2025 Tarihli Pay Geri Alım İşlemleri' }) === 'geri');
ok('tür: ilgisiz', kaphKind({ subject: 'Sermaye Artırımı', summary: 'Bedelli' }) === null);
ok('zaman', kaphTime('15.10.2025 23:53:06') === Date.parse('2025-10-15T23:53:06+03:00'));
const t = kaphText(JSON.stringify([{ disclosure: { a: '<div class="x">Sözleşme&#160;Tutarı</div><td>12.500.000 USD</td>' } }]));
ok('düz metin: etiketler atıldı', t === 'Sözleşme Tutarı 12.500.000 USD', t);
let calls = [];
globalThis.fetch = async (u, o) => { calls.push(u); if (/byCriteria/.test(u)) { const b = JSON.parse(o.body); return { ok: true, status: 200, json: async () => [
  { disclosureIndex: 11, publishDate: b.fromDate.split('-').reverse().join('.') + ' 18:10:00', subject: 'Özel Durum Açıklaması (Genel)', summary: 'Yeni İş İlişkisi', stockCodes: 'ASELS' },
  { disclosureIndex: 12, publishDate: b.fromDate.split('-').reverse().join('.') + ' 19:00:00', subject: 'Payların Geri Alınmasına İlişkin Bildirim', summary: 'Pay Geri Alım İşlemleri', stockCodes: 'THYAO' },
  { disclosureIndex: 13, publishDate: b.fromDate.split('-').reverse().join('.') + ' 20:00:00', subject: 'Genel Kurul', summary: 'x', stockCodes: 'SASA' }] }; }
  return { ok: true, status: 200, text: async () => JSON.stringify([{ d: '<b>Tutar</b> 5 milyon TL' }]) }; };
const sat = Date.parse('2026-10-10T12:00:00+03:00'), mon = Date.parse('2026-10-12T11:00:00+03:00');
ok('başlatılmadan çalışmaz', (await kaphStep(env, 'x', sat)) === null);
db.prepare("INSERT INTO meta (k,v) VALUES ('kaph_day','2026-10-08')").run();
ok('seans saatinde çalışmaz', (await kaphStep(env, 'x', mon)) === null && calls.length === 0);
let r = await kaphStep(env, 'x', sat);
ok('1. gün listesi: 2 ilgili satır', r && r.satir === 2 && db.prepare('SELECT count(*) n FROM kaph').get().n === 2, JSON.stringify(r));
r = await kaphStep(env, 'x', sat);
ok('2. gün listesi (çift kayıt yok, imleç ilerliyor)', db.prepare("SELECT v FROM meta WHERE k='kaph_day'").get().v === '2026-10-10');
r = await kaphStep(env, 'x', sat);
ok('bugüne gelince detay: yalnız iş/içeriden çekilir', r && r.detay === 1 && db.prepare('SELECT txt FROM kaph WHERE idx = 11').get().txt === 'Tutar 5 milyon TL', JSON.stringify(r));
r = await kaphStep(env, 'x', sat);
ok('hepsi bitince durum özeti', r && r.bitti && /is/.test(db.prepare("SELECT v FROM meta WHERE k='kaph_st'").get().v));
{ const v1 = db.prepare("SELECT v FROM meta WHERE k='kaph_st'").get().v; await kaphStep(env, 'x', sat + 60e3); await kaphStep(env, 'x', sat + 120e3);
  ok('bitince her dakika tabloyu yeniden saymaz (okuma sınırı)', db.prepare("SELECT v FROM meta WHERE k='kaph_st'").get().v === v1); }
const f = res.filter(x => !x).length; console.log(`KAP GEÇMİŞİ: ${res.length - f}/${res.length} geçti`); process.exit(f ? 1 : 0);
