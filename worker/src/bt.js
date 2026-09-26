// NABIZ geçmiş test motoru — pine/nabiz.pine kurallarının JS karşılığı.
// Girdi: 5 dk mumlar [t(sn,UTC), o, h, l, c, v]. Çıktı: işlem listesi + özet.
export const BT_VER = 'nabiz-v1';
export const BT_SYMS = ['THYAO', 'ASELS', 'EREGL', 'KRDMD', 'SISE', 'BIMAS', 'GARAN', 'AKBNK', 'YKBNK', 'ISCTR',
  'TUPRS', 'KCHOL', 'SAHOL', 'FROTO', 'TOASO', 'PGSUS', 'TCELL', 'HEKTS', 'SASA', 'PETKM',
  'ASTOR', 'KONTR', 'ENKAI', 'EKGYO', 'ARCLK', 'TTKOM', 'GUBRF', 'ALARK', 'OYAKC', 'MGROS'];

export const DEF = { minScore: 70, rvMin: 2.0, brkLen: 20, pressLen: 5, extK: 2.5, lateChg: 5.0, coolBars: 10,
  stopATR: 1.0, rr: 2.0, atrLen: 14, useExit: true, eod: true, comm: 0, // Fatih: komisyon yok (yalnız 1 fiyat adımı kayma)
  minRiskPct: 0, tf: 5 };

// Yarıştırılan ayarlar (ver adı → ayar). nabiz-v1 = göstergenin ilk hali.
export const VARIANTS = [
  ['k0-v1-ilk', {}],
  ['k0-v2-stop2atr', { stopATR: 2.0 }],
  ['k0-v3-risk08-cikyok', { stopATR: 1.5, minRiskPct: 0.8, useExit: false }],
  ['k0-v4-secici', { stopATR: 1.5, minRiskPct: 0.8, useExit: false, minScore: 80, rvMin: 3.0 }],
  ['k0-v5-15dk', { tf: 15, stopATR: 1.5, minRiskPct: 0.8, useExit: false }],
  ['k0-v6-15dk-secici', { tf: 15, stopATR: 1.5, minRiskPct: 0.8, useExit: false, minScore: 80, rvMin: 3.0 }],
];

// 5 dk → 15 dk (İstanbul saatine hizalı)
export function resample(bars, min) {
  if (min === 5) return bars;
  const out = []; let cur = null, key = null;
  for (const b of bars) {
    const k = Math.floor(b[0] / (min * 60));
    if (k !== key) { if (cur) out.push(cur); key = k; cur = [k * min * 60, b[1], b[2], b[3], b[4], b[5]]; }
    else { cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.min(cur[3], b[3]); cur[4] = b[4]; cur[5] += b[5]; }
  }
  if (cur) out.push(cur);
  return out;
}

const tickOf = p => p < 20 ? .01 : p < 50 ? .02 : p < 100 ? .05 : p < 250 ? .1 : p < 500 ? .25 : p < 1000 ? .5 : p < 2500 ? 1 : 2.5;

export function runNabiz(bars0, P0 = {}) {
  const P = Object.assign({}, DEF, P0);
  const bars = resample(bars0, P.tf);
  const n = bars.length;
  const tfSec = P.tf * 60;
  const T = new Array(n), O = new Array(n), H = new Array(n), L = new Array(n), C = new Array(n), V = new Array(n);
  const day = new Array(n), hIst = new Array(n), mIst = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i]; T[i] = b[0]; O[i] = b[1]; H[i] = b[2]; L[i] = b[3]; C[i] = b[4]; V[i] = b[5] || 0;
    const ist = b[0] + 3 * 3600; day[i] = Math.floor(ist / 86400); const sod = ist - day[i] * 86400;
    hIst[i] = Math.floor(sod / 3600); mIst[i] = Math.floor((sod % 3600) / 60);
  }
  // EMA / ATR (Pine ile aynı: EMA ilk değerden, ATR = RMA(TR) ilk değer SMA)
  const ema = (src, len) => { const a = 2 / (len + 1), out = new Array(n); let e = null, s = 0; for (let i = 0; i < n; i++) { if (i < len - 1) { s += src[i]; out[i] = null; continue; } if (e == null) { s += src[i]; e = s / len; } else e = a * src[i] + (1 - a) * e; out[i] = e; } return out; };
  const e9 = ema(C, 9), e21 = ema(C, 21);
  const atr = new Array(n); { let r = null, s = 0; for (let i = 0; i < n; i++) { const tr = i === 0 ? H[i] - L[i] : Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])); if (i < P.atrLen - 1) { s += tr; atr[i] = null; continue; } if (r == null) { s += tr; r = s / P.atrLen; } else r = (r * (P.atrLen - 1) + tr) / P.atrLen; atr[i] = r; } }
  // VWAP (günlük), RVOL, alım baskısı, önceki zirve
  const vw = new Array(n); { let pv = 0, vv = 0; for (let i = 0; i < n; i++) { if (i === 0 || day[i] !== day[i - 1]) { pv = 0; vv = 0; } const hl3 = (H[i] + L[i] + C[i]) / 3; pv += hl3 * V[i]; vv += V[i]; vw[i] = vv > 0 ? pv / vv : C[i]; } }
  const rvol = new Array(n); { let s = 0; for (let i = 0; i < n; i++) { s += V[i]; if (i >= 20) s -= V[i - 20]; rvol[i] = i >= 19 && s > 0 ? V[i] / (s / 20) : 0; } }
  const press = new Array(n); { let sd = 0, sv = 0; const dv = new Array(n); for (let i = 0; i < n; i++) { const r = H[i] - L[i]; const clv = r > 0 ? ((C[i] - L[i]) - (H[i] - C[i])) / r : 0; dv[i] = clv * V[i]; sd += dv[i]; sv += V[i]; if (i >= P.pressLen) { sd -= dv[i - P.pressLen]; sv -= V[i - P.pressLen]; } press[i] = i >= P.pressLen - 1 && sv > 0 ? sd / sv : 0; } }
  const prevHigh = new Array(n); for (let i = 0; i < n; i++) { if (i < P.brkLen) { prevHigh[i] = null; continue; } let m = -Infinity; for (let k = i - P.brkLen; k < i; k++) if (H[k] > m) m = H[k]; prevHigh[i] = m; }
  // Üst zaman dilimi (60 dk ve 240 dk; BIST 240 dk = 10–14, 14–18) — kapanmış önceki mum
  const htf = (keyOf) => {
    const up = new Array(n).fill(false); const closes = [], emas = []; let curKey = null, curClose = null; const a = 2 / 21; let e = null, cnt = 0, s = 0;
    for (let i = 0; i < n; i++) {
      const k = keyOf(i);
      if (curKey !== null && k !== curKey) { // önceki mum kapandı
        closes.push(curClose); cnt++;
        if (cnt < 20) { s += curClose; emas.push(null); } else { if (e == null) { s += curClose; e = s / 20; } else e = a * curClose + (1 - a) * e; emas.push(e); }
      }
      curKey = k; curClose = C[i];
      const L1 = closes.length; const c1 = closes[L1 - 1], m1 = emas[L1 - 1], m2 = emas[L1 - 2];
      up[i] = L1 >= 2 && m1 != null && m2 != null && c1 > m1 && m1 > m2;
    }
    return up;
  };
  const up1 = htf(i => day[i] * 24 + hIst[i]);
  const up2 = htf(i => day[i] * 2 + (hIst[i] >= 14 ? 1 : 0));
  // Önceki gün kapanışı
  const pdc = new Array(n); { let last = null, prev = null; for (let i = 0; i < n; i++) { if (i > 0 && day[i] !== day[i - 1]) prev = C[i - 1]; pdc[i] = prev; } }

  // Açılış aralığı + sinyal + işlem simülasyonu
  let orH = null, dayStart = null, lastSig = -1e9, pos = null; const trades = [];
  const c = P.comm / 100;
  const close = (i, px, why) => { const ent = pos.entry; const net = (px * (1 - c)) / (ent * (1 + c)) - 1; const risk = (ent - pos.stop) / ent; trades.push({ t: T[pos.i], s: T[i], r: net / risk, p: net * 100, why }); pos = null; };
  for (let i = 1; i < n; i++) {
    const newDay = day[i] !== day[i - 1];
    if (newDay) { dayStart = T[i]; orH = H[i]; } else if (dayStart != null && T[i] - dayStart < Math.max(15 * 60, tfSec)) orH = Math.max(orH, H[i]);
    const orDone = dayStart != null && T[i] - dayStart >= Math.max(15 * 60, tfSec);
    const lateDay = hIst[i] * 60 + mIst[i] + P.tf >= 17 * 60 + 55; // mum kapanışı 17:55 ve sonrası

    // açık pozisyon: önce mum içi stop/hedef (aynı mumda ikisi → stop, temkinli)
    if (pos && i > pos.i) {
      const tk = tickOf(pos.entry);
      if (L[i] <= pos.stop) close(i, Math.min(O[i], pos.stop) - tk, 'stop');
      else if (H[i] >= pos.tgt) close(i, Math.max(O[i], pos.tgt), 'hedef');
      else {
        const xDown = e9[i] != null && e21[i] != null && e9[i - 1] != null && e9[i] < e21[i] && e9[i - 1] >= e21[i - 1];
        if (P.useExit && (C[i] < vw[i] || xDown)) close(i, C[i] - tk, 'cik');
        else if (P.eod && lateDay) close(i, C[i] - tk, 'gunsonu');
      }
    }

    if (atr[i] == null || e21[i - 1] == null || prevHigh[i] == null) continue;
    const brk = C[i] > prevHigh[i] || (orDone && orH != null && C[i] > orH && C[i - 1] <= orH);
    const sVW = C[i] > vw[i] ? 15 : 0;
    const sEMA = e9[i] > e21[i] && e21[i] > e21[i - 1] ? 15 : e9[i] > e21[i] ? 7 : 0;
    const sVol = rvol[i] >= P.rvMin ? 20 : rvol[i] >= P.rvMin * 0.75 ? 10 : 0;
    const sPr = press[i] >= 0.35 ? 20 : press[i] >= 0.2 ? 10 : 0;
    const sBrk = brk ? 15 : 0;
    const sHTF = (up1[i] ? 7.5 : 0) + (up2[i] ? 7.5 : 0);
    const extended = atr[i] > 0 && (C[i] - vw[i]) > P.extK * atr[i];
    const dayChg = pdc[i] > 0 ? (C[i] / pdc[i] - 1) * 100 : 0;
    const late = dayChg >= P.lateChg;
    const score = Math.max(0, Math.min(100, sVW + sEMA + sVol + sPr + sBrk + sHTF - (extended ? 25 : 0) - (late ? 20 : 0)));
    const sig = score >= P.minScore && brk && C[i] > vw[i] && rvol[i] >= P.rvMin * 0.75 && press[i] > 0.2 && !extended && !late
      && i - lastSig >= P.coolBars && !pos && !(P.eod && lateDay);
    if (sig) {
      lastSig = i;
      const entry = C[i] + tickOf(C[i]); // 1 fiyat adımı kayma
      const stop = C[i] - Math.max(P.stopATR * atr[i], C[i] * P.minRiskPct / 100);
      if (stop < entry) pos = { i, entry, stop, tgt: C[i] + P.rr * (C[i] - stop) };
    }
  }
  return trades;
}

export function summarize(trades) {
  let eq = 1, peak = 1, dd = 0, gp = 0, gl = 0, wins = 0, sumR = 0;
  for (const t of trades) {
    const pnl = t.p / 100; eq *= 1 + pnl; if (eq > peak) peak = eq; dd = Math.max(dd, (peak - eq) / peak);
    if (pnl > 0) { wins++; gp += pnl; } else gl += -pnl;
    sumR += t.r;
  }
  return { n: trades.length, wins, gp, gl, net: (eq - 1) * 100, dd: dd * 100, sumR };
}
