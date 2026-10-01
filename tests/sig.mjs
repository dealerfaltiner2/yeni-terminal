// Sunucu karne mantığı testi (node:sqlite ile D1 taklidi): ölçüm, takılan hisse, 21:00 son saat, Telegram reddinde yeniden deneme, hata defteri.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const db = new DatabaseSync(':memory:');
const mk = sql => { let a = []; const o = { bind: (...x) => { a = x; return o; }, first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; }, _run: () => db.prepare(sql).run(...a) }; return o; };
const env = { BT: { prepare: mk, batch: async L => { for (const x of L) x._run(); } } };
db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
const { sigEval } = await import(path.join(W, 'sig.js'));
const res = []; const ok = (n, c, i) => { res.push(!!c); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
let T0; const at = hm => { T0 = Date.parse('2026-10-01T' + hm + ':00+03:00'); Date.now = () => T0; };
let tgOk = true; const sent = [];
const tgSend = async (c, m) => { sent.push(m); return tgOk ? { ok: true } : { ok: false, error: 'Unauthorized' }; };
const kvGet = async () => ({ tgTok: 'x', chat: '1' }), esc = s => String(s), nf = x => x;
const meta = k => (db.prepare('SELECT v FROM meta WHERE k=?').get(k) || {}).v;
at('11:00'); await sigEval(env, async () => ({}), tgSend, kvGet, esc, nf);
const ins = (sym, hm, done) => db.prepare("INSERT INTO sig (src,d,t,sym,dir,px,done,o10) VALUES ('radar','2026-10-01',?,?,'AL',10,?,?)").run(Date.parse('2026-10-01T' + hm + ':00+03:00'), sym, done, done ? 1 : null);
ins('AAA', '11:00', 1); ins('BBB', '12:00', 0); ins('CCC', '12:05', 0);
const bar = t => [t / 1000, 10, 10.2, 9.95, 10.1, 100];
const fetchBarsTV = async (e, syms) => { const o = {}; for (const s of syms) { const m = new Map(); if (!s.includes('BBB')) for (let i = 0; i < 400; i++) { const t = Date.parse('2026-10-01T10:00:00+03:00') + i * 60e3; m.set(t, bar(t)); } o[s] = { m, err: '' }; } return o; };
at('18:30'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf);
for (let i = 0; i < 3; i++) await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf);
ok('CCC ölçüldü, BBB (verisiz) bekliyor', db.prepare("SELECT count(*) n FROM sig WHERE done=0").get().n === 1);
ok('21:00 öncesi eksikken rapor gitmedi', sent.length === 0);
ok('veri gelmeyen hisse toparlama olarak deftere yazıldı', db.prepare("SELECT count(*) n FROM err WHERE kind='toparlama'").get().n >= 1);
tgOk = false; at('21:01'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf);
ok('Telegram reddinde rapor gönderildi sayılmadı', sent.length === 1 && !meta('sigsum'));
ok('rapor hatası deftere yazıldı', db.prepare("SELECT count(*) n FROM err WHERE msg LIKE 'karne raporu gönderilemedi%'").get().n === 1);
at('21:05'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf); ok('10 dk dolmadan yeniden denemedi', sent.length === 1);
tgOk = true; at('21:12'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf); ok('10 dk sonra gönderildi', sent.length === 2 && meta('sigsum') === '2026-10-01');
at('21:20'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf); ok('bir kez gönderildikten sonra tekrar yok', sent.length === 2);
ok('raporda veri gelmedi notu', /veri gelmedi/.test(sent[1]));
// 01.10: ölçüm yarıda kesilirse (Cloudflare sınırı) aynı hisseler sonsuza dek takılmasın; kesen hisse ayıklansın
const { sigOutcome } = await import(path.join(W, 'sig.js'));
{ const TR = 3 * 3600e3, day = ms => new Date(ms + TR).toISOString().slice(0, 10);
  const bs = []; for (let i = 0; i < 2500; i++) { const t = Date.parse('2026-09-30T14:00:00+03:00') / 1000 + i * 60; const c = 10 + Math.sin(i / 7) * 0.3; bs.push([t, c, c + 0.05, c - 0.05, c, 1]); }
  const r = { t: Date.parse('2026-10-01T11:00:00+03:00'), d: '2026-10-01', dir: 'AL', px: null };
  const o = sigOutcome(bs, r, bs); const s0 = Math.floor(r.t / 60000) * 60;
  const B = bs.filter(b => b[0] >= s0 + 60 && day(b[0] * 1000) === r.d); let pc = null; for (const b of bs) { if (day(b[0] * 1000) < r.d) pc = b[4]; else break; }
  ok('gün sınırı hesabı eskisiyle aynı', o.px === Math.round(B[0][1] * 100) / 100 && o.pre === Math.round((B[0][1] / pc - 1) * 1e4) / 100 && o.rc === Math.round((B[B.length - 1][4] / B[0][1] - 1) * 1e4) / 100 && o.idx === Math.round((bs.filter(b => b[0] <= s0 && day(b[0] * 1000) === r.d).pop()[4] / pc - 1) * 1e4) / 100); }
['KIL', 'IY1', 'IY2'].forEach(x => ins(x, '13:00', 0));
const asked = []; const hang = (e, syms) => { asked.push(syms.filter(x => x !== 'BIST:XU100')); return new Promise(() => {}); };
at('21:30'); sigEval(env, hang, tgSend, kvGet, esc, nf); await new Promise(r => setTimeout(r, 20));
ok('ölçüm başlarken hisseler kaydedildi', /KIL/.test(meta('sig_run') || ''));
at('21:30'); ok('önceki ölçüm sürerken ikincisi beklenir', (await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf)).bekle);
const killer = (e, syms) => syms.includes('BIST:KIL') ? hang(e, syms) : fetchBarsTV(e, syms);
for (let i = 1; i <= 8; i++) { at('21:' + (30 + i * 2)); const p = sigEval(env, killer, tgSend, kvGet, esc, nf); await Promise.race([p, new Promise(r => setTimeout(r, 20))]); }
ok('yarıda kesilme deftere yazıldı', db.prepare("SELECT count(*) n FROM err WHERE msg LIKE 'karne ölçümü yarıda kesildi%'").get().n >= 1);
ok('suçsuz hisseler tek tek ölçüldü', db.prepare("SELECT count(*) n FROM sig WHERE sym IN ('IY1','IY2') AND done=1 AND err IS NULL").get().n === 2);
ok('kesen hisse 3 kezden sonra kapatıldı', db.prepare("SELECT count(*) n FROM sig WHERE sym='KIL' AND done=1 AND err LIKE 'ölçülemedi%'").get().n === 1);
ok('takılı kayıt kalmadı', !meta('sig_run') && db.prepare("SELECT count(*) n FROM sig WHERE done=0").get().n === 1);
console.log('\nKARNE: ' + res.filter(Boolean).length + '/' + res.length + ' geçti');
process.exit(res.every(Boolean) ? 0 : 1);
