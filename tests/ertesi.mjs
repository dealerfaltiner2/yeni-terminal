// Ertesi gün ölçümü testi: günlük mumdan açılış farkı / tepe / dip / kapanış / tavan; zamanlama, tatil, 10 dk sınırı.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const db = new DatabaseSync(':memory:');
const mk = (sql, a = []) => ({ bind: (...x) => mk(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => db.prepare(sql).run(...a), _run: () => db.prepare(sql).run(...a) });
const env = { BT: { prepare: mk, batch: async L => L.map(x => x._run()) } };
db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
const res = []; const ok = (n, c, i) => { res.push(!!c); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
const { sigEnsure, sigNextDay, nextDayOf } = await import(path.join(W, 'sig.js'));
await sigEnsure(env);
const sec = d => Date.parse(d + 'T07:00:00Z') / 1000;   // günlük mum zamanı (saniye)
const bar = (d, o, h, l, c) => [sec(d), o, h, l, c, 1000];
// nextDayOf saf hesap
let o = nextDayOf([bar('2026-10-08', 10, 10.5, 9.8, 10), bar('2026-10-09', 10.2, 11, 10, 11)], { d: '2026-10-08', px: 10 });
ok('açılış farkı, tepe, dip, kapanış, tavan', o && o.ng === 2 && o.nh === 10 && o.nl === 0 && o.nc === 10 && o.nt === 1, JSON.stringify(o));
ok('ertesi gün mumu yoksa boş', nextDayOf([bar('2026-10-09', 1, 1, 1, 1)], { d: '2026-10-09', px: 1 }) === null);
// sigNextDay akışı
const ins = db.prepare('INSERT INTO sig (d, t, src, sym, dir, px, done, err) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
ins.run('2026-10-09', Date.parse('2026-10-09T11:00:00+03:00'), 'firsat-B', 'AAA', 'AL', 10, 1, null);   // Cuma
ins.run('2026-10-12', Date.parse('2026-10-12T11:00:00+03:00'), 'algi', 'BBB', 'AL', 20, 1, null);       // Pazartesi (ertesi gün Salı)
ins.run('2026-10-09', Date.parse('2026-10-09T12:00:00+03:00'), 'kap-is', 'CCC', 'AL', null, 1, null);   // KAP → ölçülmez
let calls = 0;
const fb = async (e, syms) => { calls++; const o = {}; for (const s of syms) { const m = new Map();
  const L = s === 'BIST:AAA' ? [bar('2026-10-08', 9, 9, 9, 9), bar('2026-10-09', 10, 10.3, 9.7, 10), bar('2026-10-12', 9.9, 10.4, 9.5, 9.6)] : [bar('2026-10-12', 20, 21, 19, 20)];
  L.forEach((b, i) => m.set(i, b)); o[s] = { m }; } return o; };
let r = await sigNextDay(env, fb, Date.parse('2026-10-12T21:00:00+03:00'));
const a = db.prepare("SELECT * FROM sig WHERE sym = 'AAA'").get(), b = db.prepare("SELECT * FROM sig WHERE sym = 'BBB'").get(), c = db.prepare("SELECT * FROM sig WHERE sym = 'CCC'").get();
ok('Cuma sinyali Pazartesi akşamı ölçüldü (hafta sonu atlandı)', a.nx === 1 && a.ng === -1 && a.nc === -4 && a.nt === 0, JSON.stringify({ r, a }));
ok('Pazartesi sinyali daha beklemede (Salı kapanmadı), KAP satırına dokunulmadı', b.nx === null && c.nx === null, JSON.stringify({ b, c }));
ok('10 dakika dolmadan yeniden çalışmaz', (await sigNextDay(env, fb, Date.parse('2026-10-12T21:05:00+03:00'))) === null && calls === 1);
// Salı 18:30 — BBB'nin ertesi günü (13.10) henüz mumda yok (tatil gibi) → deneme geri alınır, sonsuz denemeye düşmez
r = await sigNextDay(env, fb, Date.parse('2026-10-13T18:30:00+03:00'));
ok('ertesi gün mumu yoksa bekler, deneme sayılmaz', db.prepare("SELECT nx FROM sig WHERE sym = 'BBB'").get().nx === 0 && r && r.bekleyen === 1, JSON.stringify(r));
const plan = db.prepare("EXPLAIN QUERY PLAN SELECT id FROM sig INDEXED BY sig_d WHERE d IN ('a','b') AND done = 1").all().map(x => x.detail).join(' ');
ok('sorgu sig_d indeksli', /USING INDEX sig_d/.test(plan), plan);
const f = res.filter(x => !x).length; console.log(`ERTESİ GÜN: ${res.length - f}/${res.length} geçti`); process.exit(f ? 1 : 0);
