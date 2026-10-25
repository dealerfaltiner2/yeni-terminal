// v14.12 BIST 100 / tüm borsa ayrımı: endeks listesi, yükselen-düşen sayımı, karne mesajı satırları, motor liste durumu
import { idxBreadth, idxList, endeksRoute, idxBreadthScan } from '../worker/src/endeks.js';
import { mktBlock } from '../worker/src/tgfmt.js';
import { algiRowsSet } from '../worker/src/algirows.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };

const b = idxBreadth([{ s: 'BIST:A', d: ['A', 1.2] }, { s: 'BIST:B', d: ['B', -0.5] }, { s: 'BIST:C', d: ['C', 0] }, { s: 'BIST:D', d: ['D', null] }, null]);
ok('sayım: yükselen / düşen / değişmeyen, boşlar sayılmaz', b.nu === 1 && b.nd === 1 && b.n0 === 1 && b.n === 3, b);

const L100 = Array.from({ length: 100 }, (_, i) => 'H' + String(i).padStart(3, '0'));
const M = { idx_list: JSON.stringify({ at: 1, x100: L100, x30: L100.slice(0, 30) }) };
const env = { BT: { prepare: q => ({ first: async () => { const k = (q.match(/'([a-z0-9_]+)'/) || [])[1]; return M[k] ? { v: M[k] } : null; } }) } };
const json = (o, st) => ({ o, st: st || 200 });
const L = await idxList(env);
ok('liste okunur (100 + 30)', L.x100.length === 100 && L.x30.length === 30, L);
const r = await endeksRoute(env, json);
ok('/endeks yanıtı', r.o.ok && r.o.x100.length === 100 && r.o.x30.length === 30, r.o);

let sent = null;
const scanRaw = async (e, body) => { sent = JSON.parse(body); return { json: async () => ({ data: sent.symbols.tickers.map((t, i) => ({ s: t, d: [t, i < 31 ? 1 : i < 95 ? -1 : 0] })) }) }; };
const bb = await idxBreadthScan(env, scanRaw);
ok('BIST 100 taraması yalnız 100 üyeyi sorar, sayım doğru', sent.symbols.tickers.length === 100 && sent.columns.join() === 'name,change' && bb.nu === 31 && bb.nd === 64 && bb.n === 100, bb);

const esc = s => String(s);
const t = mktBlock({ idx: [{ s: 'XU100', c: 11117, ch: -0.92, hi: 11245, lo: 10707 }], nu: 52, nd: 569, b100: { nu: 31, nd: 69, n0: 0, n: 100 } }, esc);
ok('karne: iki ayrı satır (BIST 100 + Tüm borsa)', /BIST 100: 31 hisse yükseldi, 69 hisse düştü/.test(t) && /Tüm borsa: 52 hisse yükseldi, 569 hisse düştü/.test(t), t);
const t2 = mktBlock({ idx: [{ s: 'XU100', c: 11117, ch: -0.92 }], nu: 52, nd: 569 }, esc);
ok('karne: BIST 100 sayısı gelmezse yalnız tüm borsa satırı', !/BIST 100:/.test(t2) && /Tüm borsa: 52/.test(t2), t2);

const D = {}; const env2 = { BT: { prepare: q => ({ bind: (...a) => ({ run: async () => { D.v = a[0]; } }) }) } };
await algiRowsSet({ text: async () => JSON.stringify({ rows: [], rot: { n: 258, add: 14, rm: 12, last: [{ s: 'KONTR', t: 5 }, { s: 'kötü<', t: 1 }] } }) }, env2, json);
const rot = JSON.parse(D.v).rot;
ok('motor canlı liste durumu sunucuya yazılır (geçersiz kod atılır)', rot && rot.n === 258 && rot.add === 14 && rot.last.length === 1 && rot.last[0].s === 'KONTR', rot);

if (bad) { console.log('ENDEKS: ' + bad + ' HATA'); process.exit(1); } else console.log('ENDEKS: hepsi geçti');
