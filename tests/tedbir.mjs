// Borsa tedbirleri testi: tür ayırma, kaldırma haberi, süre dolumu, KAP'tan ilk kurulum (indeksli), yeni haberle güncelleme.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const db = new DatabaseSync(':memory:');
const mk = (sql, a = []) => { const o = { bind: (...x) => mk(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => db.prepare(sql).run(...a), _run: () => db.prepare(sql).run(...a) }; return o; };
const env = { BT: { prepare: mk, batch: async L => L.map(x => x._run()) } };
db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
db.exec('CREATE TABLE kap (idx INTEGER PRIMARY KEY, t INTEGER, syms TEXT, title TEXT, subj TEXT, summ TEXT, tip TEXT, yon INTEGER, onem INTEGER, sent INTEGER DEFAULT 0)');
db.exec('CREATE INDEX kap_t ON kap(t)');
const res = []; const ok = (n, c, i) => { res.push(!!c); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
const { tedbirKinds, tedbirPut, tedbirPrune, tedbirAdd, tedbirRoute } = await import(path.join(W, 'tedbir.js'));
const D = 864e5, now = Date.parse('2026-10-12T12:00:00+03:00');
ok('tür: brüt takas + açığa satış', tedbirKinds('Pay piyasasında brüt takas ve açığa satış yasağı uygulanması').join() === 'brut,aciga');
ok('tür: tek fiyat', tedbirKinds('Tek Fiyat Yöntemi ile işlem görmesi').join() === 'tek');
ok('tür: işlem durdurma', tedbirKinds('Pay İşlem Sırası Kapatma / Açma | Pay Sırasının İşleme Kapatılması').join() === 'durdur');
ok('tür: Yakın İzleme Pazarı', tedbirKinds('Pazar Değişikliği | Payların Yakın İzleme Pazarına Alınması').join() === 'yip');
ok('tür: hak kullanımı (Borsa duyurusu)', tedbirKinds('BISTECH Pay Piyasası Alım Satım Sistemi Duyurusu | Hak Kullanımı').join() === 'hak' && tedbirKinds('Hak Kullanımı | ').join() === 'hak');
{ let q = tedbirPut({}, { syms: 'USAK', subj: 'Pazar Değişikliği', summ: 'Payların Yakın İzleme Pazarına Alınması', t: now - 2 * D });
  q = tedbirPut(q, { syms: 'USAK', subj: 'BISTECH Pay Piyasası Alım Satım Sistemi Duyurusu', summ: 'Pazar Değişikliği', t: now - D }); const a = !!q.USAK;
  q = tedbirPut(q, { syms: 'USAK', subj: 'Pazar Değişikliği', summ: "Payların Ana Pazar'a Alınması", t: now }); ok('YİP: BISTECH tekrar duyurusu silmez, başka pazara alınma siler', a && !q.USAK); }
ok('tür: ilgisiz Borsa duyurusu boş', tedbirKinds('BISTECH Pay Piyasası Alım Satım Sistemi Duyurusu | İşleme Açılan Varantlar').length === 0 && tedbirKinds('Endeks Şirketlerinde Değişiklik | -').length === 0);
{ let q = tedbirPut({}, { syms: 'MEGAP', subj: 'Pay İşlem Sırası Kapatma / Açma', summ: 'Pay Sırasının İşleme Kapatılması', t: now - 3600e3 });
  const a = !!q.MEGAP; q = tedbirPut(q, { syms: 'MEGAP', subj: 'Pay İşlem Sırası Kapatma / Açma', summ: 'Pay Sırasının İşleme Açılması', t: now });
  ok('işlem durdurma: kapatma ekler, açılma siler', a && !q.MEGAP); }
let m = tedbirPut({}, { syms: 'AAA,BBB', subj: 'Brüt takas', t: now - 2 * D });
ok('iki hisseye birden yazılır', m.AAA && m.BBB && m.AAA[0].k === 'brut');
m = tedbirPut(m, { syms: 'AAA', subj: 'Brüt takas tedbirinin kaldırılması', t: now - D });
ok('kaldırma haberi o türü siler', !m.AAA && m.BBB);
const p = tedbirPrune({ X: [{ k: 'brut', t: now - 31 * D }], Y: [{ k: 'durdur', t: now - 2 * D }], Z: [{ k: 'tek', t: now - 5 * D }] }, now);
ok('süre: 30 gün / durdurma 1 gün', !p.X && !p.Y && p.Z);
// ilk kurulum: KAP tablosundan, meta yokken
db.prepare('INSERT INTO kap (idx,t,syms,subj,summ,tip) VALUES (?,?,?,?,?,?)').run(1, now - 3 * D, 'CCC', 'VBTS kapsamında brüt takas', '', 'kisit');
db.prepare('INSERT INTO kap (idx,t,syms,subj,summ,tip) VALUES (?,?,?,?,?,?)').run(2, now - 60 * D, 'DDD', 'Brüt takas', '', 'kisit');
db.prepare('INSERT INTO kap (idx,t,syms,subj,summ,tip) VALUES (?,?,?,?,?,?)').run(3, now - D, 'EEE', 'Yeni iş ilişkisi', '', 'is');
const plan = db.prepare("EXPLAIN QUERY PLAN SELECT t, syms, subj, summ FROM kap INDEXED BY kap_t WHERE t > ? AND syms <> '' AND (tip = 'kisit' OR subj LIKE '%Pazar%') ORDER BY t").all(0).map(x => x.detail).join(' ');
ok('ilk kurulum sorgusu indeksli', /USING INDEX kap_t/.test(plan), plan);
const json = o => o;
let r = await tedbirRoute(env, json, now);
ok('ilk kurulum: yalnız süresi dolmamış tedbir', r.ok && r.map.CCC && r.map.CCC[0].ad === 'Brüt takas' && !r.map.DDD && !r.map.EEE, JSON.stringify(r.map));
ok('kurulum meta\'ya yazıldı', !!db.prepare("SELECT v FROM meta WHERE k='tedbir'").get());
await tedbirAdd(env, [{ tip: 'kisit', syms: 'FFF', subj: 'Kredili işlem yasağı', t: now }, { tip: 'is', syms: 'GGG', subj: 'x', t: now }, { tip: 'diger', syms: 'TERA', subj: 'Pazar Değişikliği', summ: 'Payların Yakın İzleme Pazarına Alınması', t: now }], now);
r = await tedbirRoute(env, json, now);
ok('yeni haber eklenir (tipi diger olsa da metinden), ilgisiz eklenmez', r.map.FFF && r.map.FFF[0].k === 'kredi' && r.map.CCC && !r.map.GGG && r.map.TERA && r.map.TERA[0].ad === 'Yakın İzleme Pazarı', JSON.stringify(r.map));
ok('kısıt yoksa hiçbir şey okunmaz', (await tedbirAdd(env, [{ tip: 'is', syms: 'H', t: now }], now)) === 0);
const f = res.filter(x => !x).length; console.log(`BORSA TEDBİRLERİ: ${res.length - f}/${res.length} geçti`); process.exit(f ? 1 : 0);
