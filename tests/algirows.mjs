// v14.10 Algı radarı tek kaynak: temizleme + yaz/oku (D1 taklidi)
import { algiRowsClean, algiRowsSet, algiRowsGet } from '../worker/src/algirows.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };
const rows = algiRowsClean([{ s: 'JANTS', sc: 81.2, stage: 'ates', g: 2, f: { fa: 3.14159, rv: 2.5, fc: 0.83, fd: 1, extra: 'x' }, o: { voltl: 5e7, gizli: 1 } }, { s: 'kötü<script>', sc: 50 }, { s: 'SASA', sc: 45, stage: 'bilinmez' }]);
ok('temizleme: geçersiz kod atılır, bilinmeyen durum boş, fazla alan yok, sayılar yuvarlanır', rows.length === 2 && rows[0].f.fa === 3.142 && rows[0].f.fd === true && !('extra' in rows[0].f) && !('gizli' in rows[0].o) && rows[1].stage === '', rows);
ok('en çok 30 satır', algiRowsClean(Array.from({ length: 50 }, (_, i) => ({ s: 'A' + i, sc: 1 }))).length === 30);
const M = {}; const env = { BT: { prepare: q => ({ bind: (...a) => ({ run: async () => { if (/INSERT/.test(q)) M.algi_rows = a[0]; } }), first: async () => (M.algi_rows ? { v: M.algi_rows } : null) }) } };
const json = (o, st) => ({ o, st: st || 200 });
const r1 = await algiRowsSet({ text: async () => JSON.stringify({ rows: [{ s: 'ASELS', sc: 77, stage: 'hazir', f: {}, o: {} }] }) }, env, json);
ok('yazma: kaydedildi', r1.o.ok && r1.o.n === 1 && JSON.parse(M.algi_rows).rows[0].s === 'ASELS', r1);
const r2 = await algiRowsGet(env, json, false);
ok('okuma: aynı liste', r2.o.ok && r2.o.rows.length === 1 && r2.o.rows[0].stage === 'hazir' && r2.o.at > 0, r2);
ok('üyeye boş', (await algiRowsGet(env, json, true)).o.rows.length === 0);
ok('çok büyük gövde reddedilir', (await algiRowsSet({ text: async () => 'x'.repeat(70000) }, env, json)).st === 413);
if (bad) { console.log('ALGI RADARI: ' + bad + ' HATA'); process.exit(1); } else console.log('ALGI RADARI: hepsi geçti');
