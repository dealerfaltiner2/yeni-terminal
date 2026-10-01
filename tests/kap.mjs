// KAP haber işlemi testi (node:sqlite ile D1 taklidi, sahte KAP yanıtı): aynı yanıtta ayrıştırma atlanır, yarıda kesilmede
// çift kayıt olmaz, sabah özeti 4096 karakteri aşmadan parçalanır ve Telegram reddinde haberler 'gönderildi' sayılmaz.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const db = new DatabaseSync(':memory:');
const mk = (sql, a = []) => { const o = { bind: (...x) => mk(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; }, _run: () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } }; return o; };
const env = { BT: { prepare: mk, batch: async L => L.map(x => x._run()) } };
db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
db.prepare("INSERT INTO meta (k,v) VALUES ('xu100', ?)").run(JSON.stringify(['ASELS', 'THYAO']));
const res = []; const ok = (n, c, i) => { res.push(!!c); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
let T0; const at = (d, hm) => { T0 = Date.parse(d + 'T' + hm + ':00+03:00'); Date.now = () => T0; };
const pub = ms => { const d = new Date(ms + 3 * 3600e3); const p = n => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':00'; };
let KAP = [], fetchN = 0, bodies = [];
globalThis.fetch = async (u, o) => { fetchN++; bodies.push(o && o.body); const t = JSON.stringify(KAP); return { ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t) }; };
const { kapPoll, kapMorning } = await import(path.join(W, 'kap.js'));
const sent = []; let tgOk = true;
const h = { UA: 'x', esc: s => String(s), kvGet: async () => ({ tgTok: 'x', chat: '1', watch: [], opt: {} }), tgSend: async (c, m) => { sent.push(m); return tgOk ? { ok: true } : { ok: false, error: 'red' }; }, scanRaw: null };
at('2026-10-01', '14:00');
KAP = [{ disclosureIndex: 100, publishDate: pub(Date.now() - 60e3), subject: 'Yeni İş İlişkisi', summary: 'sözleşme imzalandı', relatedStocks: 'ASELS', kapTitle: 'ASELSAN' }];
let r = await kapPoll(env, h);
ok('yeni bildirim işlendi', r.yeni === 1);
ok('karneye yazıldı', db.prepare("SELECT count(*) n FROM sig WHERE src LIKE 'kap-%'").get().n === 1);
ok('önem 3 taze haber Telegram\'a gitti', sent.length === 1);
r = await kapPoll(env, h);
ok('aynı yanıt: yeni yok', r.yeni === 0);
r = await kapPoll(env, h);
ok('aynı yanıt ikinci kez: ayrıştırma atlandı', r.yeni === 0);
// yarıda kesilme taklidi: kap_last yazılmadan önce ölmüş gibi
KAP.push({ disclosureIndex: 101, publishDate: pub(Date.now() - 30e3), subject: 'Pay Geri Alım', summary: 'geri alım', relatedStocks: 'THYAO', kapTitle: 'THY' });
r = await kapPoll(env, h);
db.prepare("UPDATE meta SET v='100' WHERE k='kap_last'").run();
KAP.push({ disclosureIndex: 102, publishDate: pub(Date.now()), subject: 'Yeni İş İlişkisi', summary: 'ihale kazanıldı', relatedStocks: 'SASA', kapTitle: 'SASA' });
r = await kapPoll(env, h);
ok('yeniden denemede çift karne kaydı yok', db.prepare("SELECT count(*) n FROM sig WHERE sym='THYAO'").get().n === 1, 'THYAO=' + db.prepare("SELECT count(*) n FROM sig WHERE sym='THYAO'").get().n);
ok('yeniden denemede çift Telegram yok', sent.filter(m => /THYAO/.test(m)).length <= 1);
ok('yeni gelen yine işlendi', db.prepare("SELECT count(*) n FROM sig WHERE sym='SASA'").get().n === 1);
// gece yarısı: ilk 15 dk dünü de iste
at('2026-10-02', '00:05'); KAP = KAP.slice(); await kapPoll(env, h);
const b = JSON.parse(bodies[bodies.length - 1]);
ok('gece yarısından sonra dün de istendi', b.fromDate === '2026-10-01' && b.toDate === '2026-10-02', b.fromDate + '→' + b.toDate);
// sabah özeti: 30 gece haberi, Telegram önce reddeder
for (let i = 0; i < 30; i++) db.prepare("INSERT INTO kap (idx,t,syms,title,subj,summ,tip,yon,onem,sent) VALUES (?,?,?,?,?,?,?,?,?,0)").run(500 + i, Date.now(), 'ASELS', 't', 'Uzun başlık '.repeat(10), 'Uzun özet metni '.repeat(12), 'is', 1, 3);
at('2026-10-02', '09:31'); tgOk = false; sent.length = 0;
r = await kapMorning(env, h);
ok('Telegram reddinde haberler gönderildi sayılmadı', db.prepare('SELECT count(*) n FROM kap WHERE sent=0').get().n >= 30);
tgOk = true; sent.length = 0;
r = await kapMorning(env, h);
ok('sabah özeti parçalara bölündü (her biri 4096 altı)', sent.length >= 2 && sent.every(m => m.length < 4096), sent.map(m => m.length).join(','));
ok('gönderilenler işaretlendi', db.prepare('SELECT count(*) n FROM kap WHERE sent=0 AND idx>=500').get().n === 5, 'kalan=' + db.prepare('SELECT count(*) n FROM kap WHERE sent=0 AND idx>=500').get().n);
console.log('\nKAP: ' + res.filter(Boolean).length + '/' + res.length + ' geçti');
process.exit(res.every(Boolean) ? 0 : 1);
