// Sunucu karne mantığı testi (node:sqlite ile D1 taklidi): ölçüm, takılan hisse, 21:00 son saat, Telegram reddinde yeniden deneme, hata defteri.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const db = new DatabaseSync(':memory:');
const mk = (sql, a = []) => { const o = { bind: (...x) => mk(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; }, _run: () => db.prepare(sql).run(...a) }; return o; };
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
db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('mkt_close', ?)").run(JSON.stringify({ d: '2026-10-01', idx: [{ s: 'XU100', c: 12118.3, ch: -1.08, hi: 12253, lo: 12118 }, { s: 'XBANK', c: 1, ch: -1.35 }], up: [{ s: 'PASEU', ch: 7.24 }], dn: [{ s: 'TKFEN', ch: -7.46 }], nu: 150, nd: 380 }));
tgOk = false; at('21:01'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf);
ok('Telegram reddinde rapor gönderildi sayılmadı', sent.length === 1 && !meta('sigsum'));
ok('rapor hatası deftere yazıldı', db.prepare("SELECT count(*) n FROM err WHERE msg LIKE 'karne raporu gönderilemedi%'").get().n === 1);
at('21:05'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf); ok('10 dk dolmadan yeniden denemedi', sent.length === 1);
tgOk = true; at('21:12'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf); ok('10 dk sonra gönderildi', sent.length === 2 && meta('sigsum') === '2026-10-01');
at('21:20'); await sigEval(env, fetchBarsTV, tgSend, kvGet, esc, nf); ok('bir kez gönderildikten sonra tekrar yok', sent.length === 2);
ok('raporda veri gelmedi notu', /veri gelmedi/.test(sent[1]));
ok('karne raporunun başında piyasa özeti (alıntı kutusunda)', /🧭 <b>Piyasa<\/b>\n<blockquote>BIST 100   <code>12\.118<\/code>/.test(sent[1]) && /Banka −%1,35/.test(sent[1]) && /150 hisse yükseldi, 380 hisse düştü/.test(sent[1]) && /🔴 TKFEN −%7,46<\/blockquote>/.test(sent[1]) && sent[1].indexOf('Piyasa') < sent[1].indexOf('radar'), JSON.stringify(sent[1].slice(0, 600)));
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
// 01.10 akşam: işlemci yükü — yalnız gereken kadar mum, BIST 100 önbelleği, KAP sinyalinde günlük mum istenmez; tatil kayması
{ db.exec("DELETE FROM sig"); db.exec("DELETE FROM meta WHERE k IN ('sig_run','sig_kill')");
  const insk = (src, sym, d, hm, px) => db.prepare("INSERT INTO sig (src,d,t,sym,dir,px,done) VALUES (?,?,?,?,'AL',?,0)").run(src, d, Date.parse(d + 'T' + hm + ':00+03:00'), sym, px);
  insk('kap-is', 'KP1', '2026-10-01', '09:59', null); insk('kap-geri', 'KP2', '2026-10-01', '11:00', null);
  const calls = []; const rec = (e, syms, tf, n) => { calls.push({ syms: syms.slice(), tf, n }); return fetchBarsTV(e, syms); };
  at('22:00'); await sigEval(env, rec, tgSend, kvGet, esc, nf);
  const c1 = calls.filter(c => c.tf === '1');
  ok('aynı gün için en çok 650 mum istendi (eskiden 2500)', c1.length === 1 && c1[0].n <= 650, 'n=' + (c1[0] && c1[0].n));
  ok('KAP sinyallerinde günlük mum istenmedi', !calls.some(c => c.tf === '1D'));
  ok('KAP sinyalleri ölçüldü', db.prepare("SELECT count(*) n FROM sig WHERE done=1 AND err IS NULL").get().n === 2);
  insk('radar', 'RD1', '2026-10-01', '12:00', 10); calls.length = 0;
  at('22:01'); await sigEval(env, rec, tgSend, kvGet, esc, nf);
  ok('BIST 100 mumları önbellekten (yeniden istenmedi)', calls.filter(c => c.tf === '1').every(c => !c.syms.includes('BIST:XU100')));
  ok('KAP dışı sinyalde günlük mum istendi (oynaklık için)', calls.some(c => c.tf === '1D'));
  insk('radar', 'ESK', '2026-09-29', '12:00', 10); calls.length = 0;
  at('22:02'); await sigEval(env, rec, tgSend, kvGet, esc, nf);
  const c3 = calls.find(c => c.tf === '1');
  ok('eski günlü sinyalde daha çok mum istendi', c3 && c3.n > 650 && c3.n <= 2500, 'n=' + (c3 && c3.n));
  const hb = []; const mkb = (d, hm, k) => { for (let i = 0; i < k; i++) { const t = Date.parse(d + 'T' + hm + ':00+03:00') / 1000 + i * 60; hb.push([t, 20 + i * 0.01, 20.3 + i * 0.01, 19.9 + i * 0.01, 20.1 + i * 0.01, 5]); } };
  mkb('2026-10-28', '10:00', 150); mkb('2026-10-30', '10:00', 300);
  const oh = sigOutcome(hb, { t: Date.parse('2026-10-29T09:59:00+03:00'), d: '2026-10-29', dir: 'AL', px: null }, []);
  ok('tatile düşen KAP sinyali sonraki işlem gününde ölçüldü', !oh.err && oh.px === 20 && oh.pre != null && oh.r15 != null && oh.r60 != null, JSON.stringify(oh).slice(0, 120));
  const op = sigOutcome(hb, { t: Date.parse('2026-10-29T11:00:00+03:00'), d: '2026-10-29', dir: 'AL', px: 20 }, []);
  ok('fiyatlı sinyalde gün kaydırma yapılmadı', op.err === 'mum yok');
}

// v8.4 bot yarışı ölçümleri: çabuk çıkış (tx) ve geri çekilme girişi (pb, pbn)
{ const t0 = Date.parse('2026-10-02T11:00:00+03:00') / 1000, mkb = f => { const a = []; for (let i = 0; i < 300; i++) { const c = f(i); a.push([t0 + i * 60, c, c, c, c, 1]); } return a; };
  const r = { t: t0 * 1000, d: '2026-10-02', dir: 'AL', px: 100, src: 'algi' };
  let o = sigOutcome(mkb(i => i < 20 ? 100 : i < 40 ? 99.5 : i < 100 ? 100.3 : 102), r, []);
  ok('geri çekilme: 30 dk içinde %0,5 düştü → giriş var, sonra hedef', o.pbn === 1 && o.pb === 1, JSON.stringify(o));
  ok('çabuk çıkış: 60 dk içinde hedef yok → 60. dakikanın kapanışı', o.tx === 0.3, 'tx=' + o.tx);
  ok('normal yarış (gün boyu) hedefi buldu', o.o10 === 1);
  ok('+%3/−%1: −%0,5 geri çekilme sonra +%2 → sonuçsuz (0)', o.o31 === 0, 'o31=' + o.o31);
  ok('+%3/−%1: önce +%3 → kazandı', sigOutcome(mkb(i => i < 10 ? 100 : i < 50 ? 99.2 : 103.1), r, []).o31 === 1);
  ok('+%3/−%1: önce −%1 → kaybetti (sonra +%3 gelse de)', sigOutcome(mkb(i => i < 10 ? 100 : i < 50 ? 98.9 : 104), r, []).o31 === 2);
  { const q = sigOutcome(mkb(i => i < 10 ? 100 : i < 50 ? 103.2 : 104.1), r, []); ok('+%4/−%1: +%3 gelip +%4 de gelince kazandı; hedefsiz çıkış gün sonu', q.o31 === 1 && q.o41 === 1 && q.h1 === 4.1, JSON.stringify([q.o31, q.o41, q.h1])); }
  { const q = sigOutcome(mkb(i => i < 10 ? 100 : i < 50 ? 103.2 : 98.8), r, []); ok('+%4/−%1: +%3 sonra düşüş → +%4 kaybetti, hedefsiz −%1', q.o31 === 1 && q.o41 === 2 && q.h1 === -1, JSON.stringify([q.o31, q.o41, q.h1])); }
  { const q = sigOutcome(mkb(i => i < 10 ? 100 : i < 50 ? 98.8 : 103.1), r, []); ok('+%3/−%1,5: −%1,2 sonra +%3 → −%1 kaybetti ama −%1,5 kazandı', q.o31 === 2 && q.o315 === 1, JSON.stringify([q.o31, q.o315])); }
  { const q = sigOutcome(mkb(i => i < 10 ? 100 : 98.4), r, []); ok('+%3/−%1,5: −%1,6 → stop', q.o315 === 2, 'o315=' + q.o315); }
  // v13.5 Algı +%2 çıkışları
  { const q = sigOutcome(mkb(i => i < 10 ? 100 : i < 50 ? 102.3 : 101.5), r, []); ok('+%2 kâr al: +%2 önce → kazandı; stop girişe: geri dönmedi → gün sonu +1,5', q.o21 === 1 && q.b2 === 1.5, JSON.stringify([q.o21, q.b2])); }
  { const q = sigOutcome(mkb(i => i < 10 ? 100 : i < 50 ? 102.3 : 99.5), r, []); ok('+%2 sonra girişin altına → stop girişe çekilmişti → 0', q.o21 === 1 && q.b2 === 0, JSON.stringify([q.o21, q.b2])); }
  { const q = sigOutcome(mkb(i => i < 10 ? 100 : i < 50 ? 98.9 : 103), r, []); ok('önce −%1 → ikisi de stop (−1)', q.o21 === 2 && q.b2 === -1, JSON.stringify([q.o21, q.b2])); }
  { const q = sigOutcome(mkb(i => i < 10 ? 100 : 101.2), r, []); ok('+%2 hiç gelmedi → sonuçsuz, gün sonu +1,2', q.o21 === 0 && q.b2 === 1.2, JSON.stringify([q.o21, q.b2])); }
  { const { momExits } = await import(path.join(W, 'sig.js'));
    const E = momExits([{ o31: 2, o315: 1, o15: 1, h1: -1, rc: 4 }, { o31: 0, o315: 0, o15: 0, h1: 0.5, rc: 0.5 }, { o31: -1, o315: null, o15: 2, h1: null, rc: null }]), g = k => E.find(x => x.k === k);
    ok('Momentum çıkış tablosu (100.000 TL): −1 / −1,5 / ±1,5 / hedefsiz', g('o31').tl === -500 && g('o31').n === 2 && g('o315').tl === 3500 && g('o15').tl === 500 && g('o15').n === 3 && g('h1').tl === -500 && g('h1').l === 1, JSON.stringify(E)); }
  o = sigOutcome(mkb(i => 100 + i * 0.001), r, []);
  ok('geri çekilme olmadı → işlem yok', o.pbn === 0 && o.pb === null);
  o = sigOutcome(mkb(i => i < 10 ? 100 : 98.9), r, []);
  ok('çabuk çıkış stopu yakaladı', o.tx === -1);
  o = sigOutcome(mkb(i => i < 10 ? 100 : 98.9), { ...r, src: 'momentum' }, []);
  ok('momentum ±%1,5: −%1,1 stop sayılmaz', o.tx === -1.1, 'tx=' + o.tx);
  // geriye dönük tamamlama
  db.exec("DELETE FROM sig");
  db.prepare("INSERT INTO sig (src,d,t,sym,dir,px,done,o10) VALUES ('algi','2026-10-02',?,'BFX','AL',100,1,1)").run(t0 * 1000);
  const bfx = async (e, syms) => { const o = {}; for (const s of syms) { const m = new Map(); mkb(i => i < 20 ? 100 : i < 40 ? 99.5 : 101).forEach(b => m.set(b[0], b)); o[s] = { m, err: '' }; } return o; };
  T0 = Date.parse('2026-10-03T04:00:00+03:00'); Date.now = () => T0;
  const bf = await sigEval(env, bfx, tgSend, kvGet, esc, nf);
  const row = db.prepare("SELECT tx, pb, pbn FROM sig WHERE sym='BFX'").get();
  ok('eski sinyaller geriye dönük tamamlandı', bf && bf.tamamlama === 1 && row.pbn === 1 && row.pb === 1, JSON.stringify({ bf, row }));
  { const r2 = await sigEval(env, bfx, tgSend, kvGet, esc, nf); ok('tamamlanan sinyal ikinci kez denenmez', !r2 || r2.tamamlama == null, JSON.stringify(r2)); }
}
// v11.4: tavan sakin açılış + karne piyasa yönü ayrımı
{
  const { tavanPick, tavanOpen } = await import(path.join(W, 'tavan.js'));
  const P = tavanPick([{ s: 'A', c: 10 }, { s: 'B', c: 10 }, { s: 'C', c: 10 }, { s: 'D', c: 10 }], { A: { o: 10.3, c: 10.4, ch: 4 }, B: { o: 11, c: 11, ch: 10 }, C: { o: 10.7, c: 10.8, ch: 8 }, D: { o: 0, c: 10, ch: 0 } });
  ok('tavanPick: yalnız açılışı %6 altı (A), tavan/yüksek açılış ve açılmayan hariç', P.length === 1 && P[0].s === 'A' && Math.abs(P[0].gap - 3) < 1e-9, JSON.stringify(P));
  const P2 = tavanPick([{ s: 'T', c: 141.6 }, { s: 'U', c: 10 }], { T: { o: 146, c: 155.7, ch: 9.96 }, U: { o: 10.2, c: 10.5, ch: 5 } });
  ok('tavanPick v12.1: açılışı sakin ama mesaj anında +%6 üstü (T) alınmaz', P2.length === 1 && P2[0].s === 'U', JSON.stringify(P2));
  { const { momRep } = await import(path.join(W, 'sig.js'));
    const R = momRep([{ sym: 'M', d: '2026-10-13' }, { sym: 'M', d: '2026-10-16' }, { sym: 'N', d: '2026-10-01' }, { sym: 'N', d: '2026-10-16' }, { sym: 'K', d: '2026-10-16' }]);
    ok('momRep v12.1: 6 gün içinde tekrar (M) işaretli, eski (N) ve ilk (K) değil', R.map(r => r.rep ? 1 : 0).join('') === '01000', JSON.stringify(R)); }
  db.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('tavan_list', ?)").run(JSON.stringify({ d: '2026-10-15', L: [{ s: 'A', c: 10 }, { s: 'B', c: 10 }] }));
  const T = d => Date.parse(d + ':00+03:00'), add = [];
  const sc = Q => async () => ({ json: async () => ({ data: Object.entries(Q).map(([k, q]) => ({ s: 'BIST:' + k, d: [k, q.c, q.ch, q.o] })) }) });
  const hh = { sigAdd: async (e, x) => add.push(x), tgSend, kvGet, esc };
  T0 = T('2026-10-16T09:58'); sent.length = 0;
  ok('tavanOpen: 10:01 öncesi çalışmaz', (await tavanOpen(env, Object.assign({ scanRaw: sc({}) }, hh))) == null);
  T0 = T('2026-10-16T10:02');
  await tavanOpen(env, Object.assign({ scanRaw: sc({ A: { c: 10.35, ch: 3.5, o: 10.2 }, B: { c: 11, ch: 10, o: 11 } }) }, hh));
  ok('tavanOpen: Telegram listesi yalnız sakin açanı içerir', sent.length === 1 && /<b>A<\/b>/.test(sent[0]) && !/<b>B<\/b>/.test(sent[0]), sent[0]);
  ok('tavanOpen: karneye tavan6 (px = şimdiki fiyat)', add.length === 1 && add[0].src === 'tavan6' && add[0].px === 10.35);
  T0 = T('2026-10-16T10:03'); sent.length = 0;
  ok('tavanOpen: günde bir kez', (await tavanOpen(env, Object.assign({ scanRaw: sc({ A: { c: 10, ch: 0, o: 10 } }) }, hh))) == null && sent.length === 0);
  db.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('tavan_list', ?)").run(JSON.stringify({ d: '2026-10-28', L: [{ s: 'A', c: 10 }] }));
  T0 = T('2026-10-29T10:05'); sent.length = 0;
  const rr = await tavanOpen(env, Object.assign({ scanRaw: sc({ A: { c: 10, ch: 10, o: 9.2 } }) }, hh));
  ok('tavanOpen: tatil günü (dünkü tavan değerleri) mesaj yok', rr && rr.tatil === 1 && sent.length === 0);
  const { statFold } = await import(path.join(W, 'sig.js'));
  const F = statFold([{ d: 'x', src: 'a', u: 1, n: 2, h: 1, s: 1, r0: 0 }, { d: 'x', src: 'a', u: 0, n: 3, h: 0, s: 2, r0: 0.5 }, { d: 'x', src: 'a', u: null, n: 1, h: 0, s: 0, r0: 0.2 }]);
  ok('statFold: yön ayrımı tek satıra toplanır', F.length === 1 && F[0].n === 6 && F[0].h === 1 && F[0].s === 3 && Math.abs(F[0].r0 - 0.7) < 1e-9);
}
// v11.5: haber ölçümü — p30 ve hb
{
  const { sigOutcome, newsGap, sigNews } = await import(path.join(W, 'sig.js'));
  const d0 = Date.parse('2026-10-14T10:00:00+03:00') / 1000, B = [];
  for (let i = 0; i < 120; i++) { const c = 10 + i * 0.01; B.push([d0 + i * 60, c, c + 0.01, c - 0.01, c, 100]); }
  const t = (d0 + 60 * 60) * 1000;   // 11:00 sinyali; 10:30 kapanışı 10,30 → px 10,60
  const o = sigOutcome(B, { t, d: '2026-10-14', px: 10.6, dir: 'AL', src: 'algi' }, null);
  ok('p30: sinyalden önceki 30 dk hareketi', Math.abs(o.p30 - (10.6 / 10.3 - 1) * 100) < 0.02, String(o.p30));
  const o2 = sigOutcome(B, { t: (d0 + 600) * 1000, d: '2026-10-14', px: 10.1, dir: 'AL', src: 'algi' }, null);
  ok('p30: 10:30 öncesi sinyalde günün açılışından', Math.abs(o2.p30 - (10.1 / 10 - 1) * 100) < 0.02, String(o2.p30));
  const G = newsGap([{ id: 1, sym: 'AAA', t: 1000 * 60e3 }, { id: 2, sym: 'BBB', t: 1000 * 60e3 }, { id: 3, sym: 'CCC', t: 1000 * 60e3 }],
    [{ t: 900 * 60e3, syms: 'AAA,ZZZ', onem: 2, tip: 'is' }, { t: 990 * 60e3, syms: 'AAA', onem: 1, tip: 'ozel' }, { t: 1010 * 60e3, syms: 'BBB', onem: 3, tip: 'is' }, { t: 995 * 60e3, syms: 'CCC', onem: 2, tip: 'devre' }], 0);
  ok('newsGap: son haberden dakika, sonraki haber ve devre kesici sayılmaz', G[0].hb === 10 && G[1].hb === -1 && G[2].hb === -1, JSON.stringify(G));
  db.exec("CREATE TABLE IF NOT EXISTS kap (idx INTEGER PRIMARY KEY, t INTEGER, syms TEXT, title TEXT, subj TEXT, summ TEXT, tip TEXT, yon INTEGER, onem INTEGER, sent INTEGER DEFAULT 0)");
  try { db.exec('CREATE INDEX kap_t ON kap(t)'); } catch (e) {}
  db.prepare("INSERT INTO kap (idx,t,syms,tip,onem) VALUES (99001, ?, 'NEWS', 'is', 2)").run(Date.parse('2026-10-13T19:00:00+03:00'));
  db.prepare("INSERT INTO sig (src,d,t,sym,dir,px,done) VALUES ('algi','2026-10-14',?,'NEWS','AL',10,1)").run(Date.parse('2026-10-14T11:00:00+03:00'));
  db.prepare("INSERT INTO sig (src,d,t,sym,dir,px,done) VALUES ('algi','2026-10-14',?,'QUIET','AL',10,1)").run(Date.parse('2026-10-14T11:00:00+03:00'));
  db.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('hb_day','2026-10-13')").run();
  const rn = await sigNews(env, Date.parse('2026-10-14T19:00:00+03:00'));
  const hb = Object.fromEntries(db.prepare("SELECT sym, hb FROM sig WHERE d='2026-10-14' AND sym IN ('NEWS','QUIET')").all().map(r => [r.sym, r.hb]));
  ok('sigNews: önceki akşamki KAP haberli, diğeri habersiz; gün bitti işareti', hb.NEWS === 960 && hb.QUIET === -1 && rn && rn.haberli >= 1 && db.prepare("SELECT v FROM meta WHERE k='hb_day'").get().v === '2026-10-14', JSON.stringify({ hb, rn }));
}
console.log('\nKARNE: ' + res.filter(Boolean).length + '/' + res.length + ' geçti');
process.exit(res.every(Boolean) ? 0 : 1);
