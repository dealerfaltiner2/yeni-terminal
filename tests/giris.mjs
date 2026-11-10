// v14.43 Merdiven GİRİŞİ (gösterge 'ARSLAN ERKEN AL 21 + Merdiven'): 15 sn ERKEN AL + gün tepesinden düşüş + merdiven kilidi
import fs from 'fs';
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const h = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const a = h.indexOf('var ERKEN_MIN='), b = h.indexOf('function erkenStarOf'), c = h.indexOf('var GIRIS_DROP'), d = h.indexOf('const GBC={}');
const { erkenCalc, girisCalc, merdStep } = new Function(h.slice(a, b) + '\n' + h.slice(c, d) + '\nreturn {erkenCalc,girisCalc,merdStep};')();
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
// Gerçek veri (10.11 SDTTR): göstergenin grafiğinde GİRİŞ 15 sn · 11,79 · stop 11,78 (14:13:45). 15 sn penceresi günün başını kapsamıyor → VWAP 1 dk mumlarıyla başlatılmalı (v14.45)
{ const T0 = 1794298155, rd = f => fs.readFileSync(new URL('./data/' + f, import.meta.url), 'utf8').split(';').map(r => r.split(' ').map(Number));
  const s15 = rd('sdttr_15s_1011.txt').map(x => ({ time: T0 + x[0] * 15, open: x[1] / 100, high: x[2] / 100, low: x[3] / 100, close: x[4] / 100, volume: x[5] }));
  const g1 = rd('sdttr_1m_1011.txt').map(x => ({ time: x[0], open: x[1] / 100, high: x[2] / 100, low: x[3] / 100, close: x[4] / 100, volume: x[5] }));
  const ag = (src, sec) => { const m = new Map(); for (const x of src) { const k = Math.floor((x.time + 10800) / sec) * sec - 10800; const c = m.get(k); if (!c) m.set(k, { ...x, time: k }); else { c.high = Math.max(c.high, x.high); c.low = Math.min(c.low, x.low); c.close = x.close; c.volume += x.volume; } } return [...m.values()]; };
  const R = girisCalc({ s15, g1, e5: ag(g1, 300), g15: ag(g1, 900) }, 14, 1), hit = R.ev.find(g => g.t === 1794312825 - 10800 + 0 || new Date((g.t + 10800) * 1000).toISOString().slice(11, 19) === '14:13:45');
  ok(hit && hit.px === 11.79 && hit.stop === 11.78, 'gerçek veri SDTTR 10.11: göstergeyle aynı GİRİŞ 14:13:45 · 11,79 · stop 11,78'); }
// v14.48b merdiven takibi (merdStep): girisCalc'ın son girişiyle aynı basamak/stop; parça parça çalıştırınca aynı sonuç
{ const last = B.s15[B.s15.length - 1].time + 15;
  for (const [nm, X] of [['düşüş-dönüş', B], ['yükselen', U]]) {
    const Gx = girisCalc(X, 14, 1.0); if (!Gx || !Gx.ev.length) continue; const g = Gx.ev[Gx.ev.length - 1];
    const st = { ct: g.t + 15, stage: 0, stop: g.stop, stf: 0 }, r = merdStep(X, 14, st, last);
    const same = Gx.lAct && Gx.lEntry === g.px ? (!r.exit && st.stage === Gx.lStage && st.stop === Gx.lStop) : !!r.exit;
    ok(same, 'merdStep (' + nm + '): göstergeyle aynı durum — basamak ' + st.stage + '/6, stop ' + (+st.stop).toFixed(3) + (r.exit ? ', çıkış ' + r.exit.px.toFixed(3) : ', açık'));
    const s2 = { ct: g.t + 15, stage: 0, stop: g.stop, stf: 0 }, mid = Math.floor((g.t + last) / 2), r1 = merdStep(X, 14, s2, mid), r2 = r1.exit ? r1 : merdStep(X, 14, s2, last);
    ok(s2.stage === st.stage && s2.stop === st.stop && !!r2.exit === !!r.exit && (!r.exit || r2.exit.t === r.exit.t), 'merdStep (' + nm + '): artımlı (iki parça) = tek seferde');
  } }
{ // çöküş: girişten 20 dk sonra fiyat %5 düşerse çıkış olmalı ve çıkış fiyatı stopun altında bir kapanış olmalı
  const g = girisCalc(B, 14, 1.0).ev[0], i0 = B.s15.findIndex(x => x.time >= g.t + 1200);
  const s15 = B.s15.map((x, i) => i < i0 ? x : { ...x, open: x.open * 0.95, high: x.high * 0.95, low: x.low * 0.95, close: x.close * 0.95 });
  const pre = B.g1.filter(x => x.time < day), X = { s15, g1: pre.concat(agg(s15, 60)), e5: B.e5.filter(x => x.time < day).concat(agg(s15, 300)), g15: B.g15.filter(x => x.time < day).concat(agg(s15, 900)), g60: B.g60, g120: B.g120, g240: B.g240 };
  const st = { ct: g.t + 15, stage: 0, stop: g.stop, stf: 0 }, r = merdStep(X, 14, st, s15[s15.length - 1].time + 15);
  ok(r.exit && r.exit.px < st.stop && r.exit.t >= (g.t + 1200) * 1000, 'merdStep: çöküşte gösterge çıkışı (basamak ' + st.stage + ', çıkış ' + (r.exit ? r.exit.px.toFixed(2) : '-') + ' < stop ' + (+st.stop).toFixed(2) + ')'); }
process.exit(fail ? 1 : 0);
