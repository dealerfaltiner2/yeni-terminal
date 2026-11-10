// v14.43 Merdiven GİRİŞİ (gösterge 'ARSLAN ERKEN AL 21 + Merdiven'): 15 sn ERKEN AL + gün tepesinden düşüş + merdiven kilidi
import fs from 'fs';
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const h = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const a = h.indexOf('var ERKEN_MIN='), b = h.indexOf('function erkenStarOf'), c = h.indexOf('var GIRIS_DROP'), d = h.indexOf('const GBC={}');
const { erkenCalc, girisCalc } = new Function(h.slice(a, b) + '\n' + h.slice(c, d) + '\nreturn {erkenCalc,girisCalc};')();
function gen(sec, n, t0, p0, seed, dn, up) { let x = seed; const r = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; const out = []; let p = p0;
  for (let i = 0; i < n; i++) { const dr = i < n * 0.5 ? dn : up; const o = p; p = p * (1 + dr * Math.sqrt(sec / 15) + (r() - .5) * 0.002 * Math.sqrt(sec / 15));
    out.push({ time: t0 + i * sec, open: o, high: Math.max(o, p) * (1 + r() * 0.0008), low: Math.min(o, p) * (1 - r() * 0.0008), close: p, volume: Math.round(1000 + r() * 5000 * (i % 37 == 0 ? 5 : 1)) }); } return out; }
const day = Math.floor(Date.UTC(2026, 10, 10, 7, 0, 0) / 1000);
const agg = (src, sec) => { const m = new Map(); for (const x of src) { const k = Math.floor((x.time - day) / sec) * sec + day; const c = m.get(k); if (!c) m.set(k, { ...x, time: k }); else { c.high = Math.max(c.high, x.high); c.low = Math.min(c.low, x.low); c.close = x.close; c.volume += x.volume; } } return [...m.values()]; };
const mk = (dn, up) => { const s15 = gen(15, 800, day, 100, 7, dn, up), pre = gen(60, 300, day - 18000, 101, 3, 0, 0);
  return { s15, g1: pre.concat(agg(s15, 60)), e5: agg(pre, 300).concat(agg(s15, 300)), g15: agg(pre, 900).concat(agg(s15, 900)), g60: agg(pre, 3600), g120: agg(pre, 7200), g240: agg(pre, 14400) }; };
const B = mk(-0.0004, 0.0006);
const E = erkenCalc(B.s15, 14, 15); let k = 0; for (let i = 0; i <= E.last; i++) { const r = E.at(i); if (r && r.buy) k++; }
const G = girisCalc(B, 14, 1.0);
ok(G && G.ev.length >= 1, 'düşüş sonrası dönüşte GİRİŞ bulundu (' + (G ? G.ev.length : 0) + ')');
ok(G.ev.length < k, 'merdiven açıkken her 15 sn ERKEN AL yeni GİRİŞ sayılmıyor (' + k + ' ERKEN AL mumu → ' + G.ev.length + ' GİRİŞ)');
ok(G.ev.every(g => g.drop >= 1 && g.stop <= g.px && g.n >= 14), 'her GİRİŞ: gün tepesinden ≥%1 aşağıda, stop ≤ giriş, ≥14/21');
const U = mk(0.0004, 0.0006), GU = girisCalc(U, 14, 1.0);
ok(GU.ev.every(g => g.drop >= 1), 'hep yükselen günde gün tepesi şartı korunuyor (' + GU.ev.length + ')');
ok(girisCalc({ s15: B.s15.slice(0, 30) }, 14) === null, 'az veriyle hesap yok');
const e1 = erkenCalc(B.e5, 16), e2 = erkenCalc(B.e5, 16, 300); ok(e1.at(e1.last).n === e2.at(e2.last).n, '5 dk ERKEN AL hesabı değişmedi');
process.exit(fail ? 1 : 0);
