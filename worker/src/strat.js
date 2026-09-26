// Aday strateji yarışı — hepsi yalnız AL, gün içi (17:55'te kapanır), komisyonsuz, 1 fiyat adımı kayma.
// Girdi: 5 dk mumlar [t(sn,UTC), o, h, l, c, v].
import { resample } from './bt.js';

const tickOf = p => p < 20 ? .01 : p < 50 ? .02 : p < 100 ? .05 : p < 250 ? .1 : p < 500 ? .25 : p < 1000 ? .5 : p < 2500 ? 1 : 2.5;

function prep(bars) {
  const n = bars.length, X = { n, T: [], O: [], H: [], L: [], C: [], V: [], day: [], mins: [], first: [] };
  for (let i = 0; i < n; i++) {
    const b = bars[i]; X.T.push(b[0]); X.O.push(b[1]); X.H.push(b[2]); X.L.push(b[3]); X.C.push(b[4]); X.V.push(b[5] || 0);
    const ist = b[0] + 3 * 3600, d = Math.floor(ist / 86400); X.day.push(d); X.mins.push(Math.floor((ist - d * 86400) / 60));
    X.first.push(i === 0 || d !== X.day[i - 1]);
  }
  // günlük VWAP + 1σ/2σ bant, gün açılışı, gün dibi, önceki gün kapanışı, gün içi sıra
  X.vw = []; X.sd = []; X.dOpen = []; X.dLow = []; X.pdc = []; X.k = [];
  let pv = 0, vv = 0, p2 = 0, dOpen = 0, dLow = 0, pdc = null, k = 0;
  for (let i = 0; i < n; i++) {
    if (X.first[i]) { if (i > 0) pdc = X.C[i - 1]; pv = vv = p2 = 0; dOpen = X.O[i]; dLow = X.L[i]; k = 0; } else k++;
    const hl = (X.H[i] + X.L[i] + X.C[i]) / 3; pv += hl * X.V[i]; vv += X.V[i]; p2 += hl * hl * X.V[i];
    const m = vv > 0 ? pv / vv : X.C[i]; X.vw.push(m); X.sd.push(vv > 0 ? Math.sqrt(Math.max(0, p2 / vv - m * m)) : 0);
    dLow = Math.min(dLow, X.L[i]); X.dOpen.push(dOpen); X.dLow.push(dLow); X.pdc.push(pdc); X.k.push(k);
  }
  const ema = (len) => { const a = 2 / (len + 1), o = []; let e = null; for (let i = 0; i < n; i++) { e = e == null ? X.C[i] : a * X.C[i] + (1 - a) * e; o.push(i >= len ? e : null); } return o; };
  X.e20 = ema(20); X.e50 = ema(50);
  X.atr = []; { let r = null; for (let i = 0; i < n; i++) { const tr = i ? Math.max(X.H[i] - X.L[i], Math.abs(X.H[i] - X.C[i - 1]), Math.abs(X.L[i] - X.C[i - 1])) : X.H[i] - X.L[i]; r = r == null ? tr : (r * 13 + tr) / 14; X.atr.push(i >= 14 ? r : null); } }
  X.rv = []; { let s = 0; for (let i = 0; i < n; i++) { s += X.V[i]; if (i >= 20) s -= X.V[i - 20]; X.rv.push(i >= 20 && s > 0 ? X.V[i] / (s / 20) : 0); } }
  X.rsi2 = []; { let g = null, l = null; for (let i = 0; i < n; i++) { if (!i) { X.rsi2.push(50); continue; } const d = X.C[i] - X.C[i - 1]; const up = Math.max(d, 0), dn = Math.max(-d, 0); g = g == null ? up : (g + up) / 2; l = l == null ? dn : (l + dn) / 2; X.rsi2.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); } }
  return X;
}

// Ortak işlem simülatörü. sig(i) → {stop, tgt|null, exitFn?} ya da null. Giriş: i kapanışı + 1 adım.
function sim(X, sig, tfMin) {
  const trades = []; let pos = null;
  const lastBarMin = 17 * 60 + 55 - tfMin; // bu mumun kapanışı 17:55
  for (let i = 1; i < X.n; i++) {
    const eod = X.mins[i] >= lastBarMin;
    if (pos && X.first[i]) { // güvenlik: gün değiştiyse önceki kapanıştan çık
      const px = X.C[i - 1] - pos.tk; trades.push(fin(pos, px, 'gunsonu', X.T[i - 1])); pos = null;
    }
    if (pos) {
      if (X.L[i] <= pos.stop) { trades.push(fin(pos, Math.min(X.O[i], pos.stop) - pos.tk, 'stop', X.T[i])); pos = null; }
      else if (pos.tgt != null && X.H[i] >= pos.tgt) { trades.push(fin(pos, Math.max(X.O[i], pos.tgt), 'hedef', X.T[i])); pos = null; }
      else if (pos.exitFn && pos.exitFn(i)) { trades.push(fin(pos, X.C[i] - pos.tk, 'cik', X.T[i])); pos = null; }
      else if (eod) { trades.push(fin(pos, X.C[i] - pos.tk, 'gunsonu', X.T[i])); pos = null; }
      if (!pos) continue;
    }
    if (!pos && !eod && X.atr[i] != null) {
      const s = sig(i);
      if (s && s.stop < X.C[i]) { const tk = tickOf(X.C[i]); pos = { i, t: X.T[i], entry: X.C[i] + tk, stop: s.stop, tgt: s.tgt, exitFn: s.exitFn, tk, day: X.day[i] }; }
    }
  }
  return trades;
}
function fin(pos, px, why, t) { const risk = pos.entry - pos.stop; return { t: pos.t, s: t, r: (px - pos.entry) / risk, p: (px / pos.entry - 1) * 100, why }; }

// ───────────── Adaylar ─────────────
// A) VWAP geri çekilme (trend günü): gün yükselişte, fiyat son 12 mumun ≥10'unda VWAP üstünde, VWAP'a değip yeşil kapatıyor
function vwapPullback(X, rr) {
  const done = {};
  return sim(X, i => {
    if (X.mins[i] < 10 * 60 + 45 || X.mins[i] > 16 * 60 + 30 || done[X.day[i]]) return null;
    if (!(X.pdc[i] > 0) || X.C[i] / X.pdc[i] - 1 < 0.005) return null;
    let above = 0; for (let k = i - 12; k < i; k++) if (k >= 0 && X.day[k] === X.day[i] && X.C[k] > X.vw[k]) above++;
    if (above < 10) return null;
    if (!(X.L[i] <= X.vw[i] * 1.0015 && X.C[i] > X.vw[i] && X.C[i] > X.O[i])) return null;
    if (!(X.e20[i] > X.e20[i - 3])) return null;
    done[X.day[i]] = 1;
    const stop = Math.min(X.L[i], X.vw[i]) - 0.5 * X.atr[i];
    return { stop, tgt: rr ? X.C[i] + rr * (X.C[i] - stop) : null };
  }, 5);
}
// B) Açılış aralığı kırılımı (ilk 30 dk): 10:30–12:00 arası ilk kapanış OR üstünde, hacimli; stop OR ortası
function orb(X, rr) {
  const OR = {}, done = {};
  return sim(X, i => {
    const d = X.day[i], m = X.mins[i];
    if (m < 10 * 60 + 30) { const o = OR[d] || (OR[d] = { h: -Infinity, l: Infinity }); o.h = Math.max(o.h, X.H[i]); o.l = Math.min(o.l, X.L[i]); return null; }
    const o = OR[d]; if (!o || done[d] || m > 12 * 60) return null;
    if (!(X.C[i] > o.h && X.rv[i] >= 1.5 && X.C[i] > X.vw[i])) return null;
    done[d] = 1;
    const stop = (o.h + o.l) / 2;
    return { stop, tgt: rr ? X.C[i] + rr * (X.C[i] - stop) : null };
  }, 5);
}
// C) Sabah gücü → gün sonu: 10:30'da gün +%1 üstü ve VWAP üstü ise al, stop gün dibi, gün sonu çık
function morningMomentum(X) {
  const done = {};
  return sim(X, i => {
    const d = X.day[i];
    if (done[d] || X.mins[i] !== 10 * 60 + 25) return null; // 10:25 mumu = 10:30 kapanışı
    done[d] = 1;
    if (!(X.pdc[i] > 0) || X.C[i] / X.pdc[i] - 1 < 0.01 || X.C[i] <= X.vw[i]) return null;
    return { stop: X.dLow[i] - tickOf(X.C[i]), tgt: null };
  }, 5);
}
// D) Öğleden sonra gücü: 16:00'da gün +%1 üstü, VWAP üstü, gün zirvesine yakın → gün sonu çık
function lateMomentum(X) {
  const done = {}; const dHigh = {};
  return sim(X, i => {
    const d = X.day[i]; dHigh[d] = Math.max(dHigh[d] || -Infinity, X.H[i]);
    if (done[d] || X.mins[i] !== 15 * 60 + 55) return null;
    done[d] = 1;
    if (!(X.pdc[i] > 0) || X.C[i] / X.pdc[i] - 1 < 0.01 || X.C[i] <= X.vw[i] || X.C[i] < dHigh[d] * 0.99) return null;
    return { stop: X.vw[i] - tickOf(X.C[i]), tgt: null };
  }, 5);
}
// E) Aşırı satım dönüşü: fiyat VWAP −2σ altına sarkıp yeşil mumla bandın içine dönüyor → hedef VWAP
function bandReversion(X) {
  return sim(X, i => {
    if (X.mins[i] < 10 * 60 + 30 || X.mins[i] > 16 * 60 + 30 || X.k[i] < 6) return null;
    const lo2 = X.vw[i] - 2 * X.sd[i];
    if (!(X.sd[i] > 0 && X.L[i] < lo2 && X.C[i] > lo2 && X.C[i] > X.O[i] && X.rv[i] >= 1.2)) return null;
    const stop = X.L[i] - 0.3 * X.atr[i];
    if (X.vw[i] - X.C[i] < (X.C[i] - stop)) return null; // en az 1R potansiyel
    return { stop, tgt: X.vw[i] };
  }, 5);
}
// F) 15 dk RSI(2) aşırı satım, yükseliş trendinde (EMA50 üstü): RSI2>70 ya da gün sonu çık
function rsi2(X15) {
  return sim(X15, i => {
    if (X15.mins[i] < 10 * 60 + 30 || X15.mins[i] > 16 * 60) return null;
    if (!(X15.e50[i] && X15.C[i] > X15.e50[i] && X15.rsi2[i] < 10)) return null;
    return { stop: X15.C[i] - 1.5 * X15.atr[i], tgt: null, exitFn: j => X15.rsi2[j] > 70 };
  }, 15);
}

export const CANDIDATES = [
  ['s-A-vwapgeri-15R', X => vwapPullback(X, 1.5)],
  ['s-A-vwapgeri-gunsonu', X => vwapPullback(X, 0)],
  ['s-B-orb-2R', X => orb(X, 2)],
  ['s-B-orb-gunsonu', X => orb(X, 0)],
  ['s-C-sabahgucu', X => morningMomentum(X)],
  ['s-D-aksamgucu', X => lateMomentum(X)],
  ['s-E-bantdonus', X => bandReversion(X)],
  ['s-F-rsi2-15dk', (X, bars) => rsi2(prep(resample(bars, 15)))],
];

export function runCandidate(name, bars) {
  const c = CANDIDATES.find(x => x[0] === name);
  return c[1](prep(bars), bars);
}
