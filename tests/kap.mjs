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
ok('KAP mesajı yeni düzende (alıntı kutusu, uzun bağlantı yok)', /^📰 <b>KAP · /.test(sent[0]) && /<blockquote>/.test(sent[0]) && !/https?:/.test(sent[0]), sent[0]);
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
// 12.10: büyük günlük liste — yalnız yeni bildirimler ayrıştırılır; biçim farklıysa tam ayrıştırmaya düşer
const { kapFresh } = await import(path.join(W, 'kap.js'));
const big = []; for (let i = 0; i < 400; i++) big.push({ publishDate: '12.10.2026 18:00:00', kapTitle: 'Ş' + i, summary: 'özet ' + i, subject: 'Özel Durum', disclosureIndex: 2000 + i, relatedStocks: 'ASELS' });
const raw = JSON.stringify(big.slice().reverse());
let F = kapFresh(raw, 2389, 40);
ok('kapFresh: yalnız yeniler, en eskiden', F && F.length === 10 && F[0].disclosureIndex === 2390 && F[9].disclosureIndex === 2399, F && F.map(x => x.disclosureIndex).join(','));
ok('kapFresh: en çok 40', (kapFresh(raw, 0, 40) || []).length === 40 && kapFresh(raw, 0, 40)[0].disclosureIndex === 2000);
ok('kapFresh: yeni yoksa boş', Array.isArray(kapFresh(raw, 5000)) && kapFresh(raw, 5000).length === 0);
const odd = JSON.stringify([{ disclosureIndex: 7, summary: 'süslü } parantez', subject: 'x' }]);
ok('kapFresh: metinde süslü parantez → tam ayrıştırmaya düşer', kapFresh(odd, 0) === null);
ok('kapFresh: boş liste → tam ayrıştırma', kapFresh('[]', 0) === null);
// takılma: Telegram gönderiminde çalışma ölürse kap_last yine de ilerlemiş olmalı
at('2026-10-12', '18:14');
KAP = [{ disclosureIndex: 900, publishDate: pub(Date.now() - 30e3), subject: 'Yeni İş İlişkisi', summary: 'sözleşme imzalandı', relatedStocks: 'ASELS', kapTitle: 'ASELSAN' }];
const h2 = Object.assign({}, h, { tgSend: async () => { throw new Error('kesildi'); } });
try { await kapPoll(env, h2); } catch (e) {}
ok('çalışma sonda kesilse de kap_last ilerledi (her dakika aynı yük yok)', db.prepare("SELECT v FROM meta WHERE k='kap_last'").get().v === '900');
// v11.4: seans içi geri alım → Telegram (günün ilk bildirimi, her gün bildiren ve tabandaki hariç)
db.prepare("DELETE FROM meta WHERE k='geri_seen'").run();
const geri = (idx, sym) => ({ disclosureIndex: idx, publishDate: pub(Date.now() - 20e3), subject: 'Pay Geri Alımına İlişkin Bildirim', summary: 'geri alım', relatedStocks: sym, kapTitle: sym });
let QQ = {};
const h3 = Object.assign({}, h, { tgSend: async (c, m) => { sent.push(m); return { ok: true }; }, scanRaw: async (e, b) => ({ json: async () => ({ data: JSON.parse(b).symbols.tickers.map(t => ({ s: t, d: [t.split(':')[1], (QQ[t.split(':')[1]] || {}).c || 10, (QQ[t.split(':')[1]] || {}).ch || 0.5] })) }) }) });
at('2026-10-13', '11:00'); sent.length = 0; QQ = { KCHOL: { c: 200, ch: 0.4 } };
KAP = [geri(1001, 'KCHOL')]; await kapPoll(env, h3);
ok('seans içi geri alım Telegram\'a gitti (AL kartı, hedef/stop)', sent.length === 1 && /AL · KCHOL/.test(sent[0]) && /206,00/.test(sent[0]) && /198,00/.test(sent[0]), sent[0]);
at('2026-10-13', '13:00'); sent.length = 0; KAP.push(geri(1002, 'KCHOL')); await kapPoll(env, h3);
ok('aynı gün ikinci geri alım gitmez', sent.length === 0, sent[0]);
at('2026-10-13', '14:00'); sent.length = 0; QQ.TABAN = { c: 5, ch: -9.9 }; KAP.push(geri(1003, 'TABAN')); await kapPoll(env, h3);
ok('tabandaki hissenin geri alımı gitmez', sent.length === 0, sent[0]);
for (const [d, i] of [['2026-10-14', 1010], ['2026-10-15', 1020], ['2026-10-16', 1030]]) { at(d, '11:00'); KAP.push(geri(i, 'DCTTR')); await kapPoll(env, h3); }
at('2026-10-19', '11:00'); sent.length = 0; KAP.push(geri(1040, 'DCTTR')); await kapPoll(env, h3);
ok('her gün bildiren hisse (son 7 günde 3 gün) gitmez', sent.length === 0, sent[0]);
at('2026-10-19', '19:00'); sent.length = 0; KAP.push(geri(1050, 'SISE')); await kapPoll(env, h3);
ok('seans dışı geri alım AL kartı olarak gitmez', !sent.some(m => /AL · SISE/.test(m)));
at('2026-10-20', '11:00'); sent.length = 0; QQ.FIYAT = { c: 50, ch: 4.2 }; KAP.push({ disclosureIndex: 1100, publishDate: pub(Date.now() - 20e3), subject: 'Yeni İş İlişkisi', summary: 'sözleşme', relatedStocks: 'FIYAT', kapTitle: 'F' });
const h4 = Object.assign({}, h3, { kvGet: async () => ({ tgTok: 'x', chat: '1', watch: ['FIYAT'], opt: {} }) }); await kapPoll(env, h4);
ok('geç mi kaldım: haber öncesi +%4,2 uyarısı', sent.length === 1 && /zaten \+%4,20 yükselmişti/.test(sent[0]), sent[0]);
console.log('\nKAP: ' + res.filter(Boolean).length + '/' + res.length + ' geçti');
process.exit(res.every(Boolean) ? 0 : 1);
