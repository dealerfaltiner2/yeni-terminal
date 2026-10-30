// v14.26 çok yıllık günlük mum arşivi: kuyruk, paketleme, bitiş
import { gunlukStep, gunlukPack } from '../worker/src/gunluk.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };
ok('paket: gün sayısı + değerler', gunlukPack([[86400 * 20000 + 25200, 1.23456, 2, 1, 1.5, 1000.4]]) === '20000,1.2346,2,1,1.5,1000');
const meta = { gunluk_q: JSON.stringify(['THYAO', 'FX_IDC:USDTRY']) }, tab = {};
const stmt = q => { const S = { a: [], bind(...a) { const n = stmt(q); n.a = a; return n; },
  async first() { if (/FROM meta/.test(q)) { const k = q.match(/k = '(\w+)'/)[1]; return meta[k] != null ? { v: meta[k] } : null; } return null; },
  async run() { if (/INSERT OR REPLACE INTO meta/.test(q)) { const k = q.match(/VALUES \('(\w+)'/); meta[k ? k[1] : S.a[0]] = k ? S.a[0] : S.a[1]; }
    if (/DELETE FROM meta/.test(q)) delete meta[q.match(/k = '(\w+)'/)[1]];
    if (/INTO gunluk/.test(q)) tab[S.a[0]] = S.a; return {}; } }; return S; };
const env = { BT: { prepare: stmt } }, asked = [];
const fb = async (e, list, tf, n) => { asked.push([list[0], tf, n]); const m = new Map(); m.set(1, [86400 * 20000, 10, 11, 9, 10.5, 5]); m.set(2, [86400 * 20001, 10.5, 12, 10, 11, 6]); return { [list[0]]: { m } }; };
let r = await gunlukStep(env, fb);
ok('1. kod: BIST öneki, 1D, kuyruktan çıktı, tabloya yazıldı', r.sym === 'THYAO' && asked[0][0] === 'BIST:THYAO' && asked[0][1] === '1D' && tab.THYAO && tab.THYAO[1] === 2 && JSON.parse(meta.gunluk_q).length === 1, r);
r = await gunlukStep(env, fb);
ok('2. kod: önekli kod olduğu gibi, ad son parça', asked[1][0] === 'FX_IDC:USDTRY' && tab.USDTRY, r);
r = await gunlukStep(env, fb);
ok('kuyruk bitti: meta silindi, durum yazıldı', r.bitti === 1 && !meta.gunluk_q && meta.gunluk_st, r);
ok('kuyruk yokken hiçbir şey yapmaz', (await gunlukStep(env, fb)) === null);
if (bad) { console.log('GÜNLÜK ARŞİV: ' + bad + ' HATA'); process.exit(1); } else console.log('GÜNLÜK ARŞİV: hepsi geçti');
