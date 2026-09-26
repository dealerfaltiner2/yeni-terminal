// Terminal "derin analiz" notu (A/B/C) — index.html analyze() fonksiyonunun geçmiş test karşılığı.
// 15 dk mumlar [t(sn,UTC), o, h, l, c, v]. Her mumda not hesaplanır (yalnız o ana kadarki veriyle);
// AL yönünde not A'ya (ya da B'ye) YENİ yükseldiğinde olay kaydedilir ve sonrası ölçülür.
// Fark: terminaldeki 6. puan (tarayıcıda ≥2 kurulum) geçmişte yeniden üretilemez → yok sayıldı.
//       Bu yüzden burada A = 5/5 puan (terminalde 5/6), yani biraz daha seçici.
const ema = (a, n) => { const k = 2 / (n + 1); let e = null; return a.map(v => e = e == null ? v : v * k + e * (1 - k)); };
function profileOf(bars, rows = 50) {
  if (!bars.length) return null;
  let hi = -Infinity, lo = Infinity; for (const b of bars) { if (b[2] > hi) hi = b[2]; if (b[3] < lo) lo = b[3]; }
  if (!(hi > lo)) return null;
  const step = (hi - lo) / rows, bins = new Array(rows).fill(0);
  for (const b of bars) { const a = Math.max(0, Math.floor((b[3] - lo) / step)), z = Math.min(rows - 1, Math.floor((b[2] - lo) / step)), sh = (b[5] || 0) / (z - a + 1); for (let i = a; i <= z; i++) bins[i] += sh; }
  const tot = bins.reduce((a, b) => a + b, 0); if (!tot) return null;
  let pi = 0; bins.forEach((v, i) => { if (v > bins[pi]) pi = i; });
  let l = pi, h = pi, acc = bins[pi];
  while (acc < tot * 0.7 && (l > 0 || h < rows - 1)) { const dn = l > 0 ? bins[l - 1] : -1, up = h < rows - 1 ? bins[h + 1] : -1; if (up >= dn) { h++; acc += bins[h]; } else { l--; acc += bins[l]; } }
  return { poc: lo + step * (pi + 0.5), val: lo + step * l };
}

export function gradeEvents(bars) {
  const n = bars.length; if (n < 100) return [];
  const T = bars.map(b => b[0]), H = bars.map(b => b[2]), L = bars.map(b => b[3]), C = bars.map(b => b[4]), V = bars.map(b => b[5] || 0);
  const day = T.map(t => Math.floor((t + 3 * 3600) / 86400)), mins = T.map(t => Math.floor(((t + 3 * 3600) % 86400) / 60));
  const e9 = ema(C, 9), e21 = ema(C, 21), e50 = ema(C, 50), ve = ema(V, 20);
  const at = []; { let a = null; for (let i = 0; i < n; i++) { const tr = i ? Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])) : H[i] - L[i]; a = a == null ? tr : (a * 13 + tr) / 14; at.push(a); } }
  const vw = []; { let cv = 0, cp = 0; for (let i = 0; i < n; i++) { if (!i || day[i] !== day[i - 1]) { cv = 0; cp = 0; } cp += (H[i] + L[i] + C[i]) / 3 * V[i]; cv += V[i]; vw.push(cv ? cp / cv : null); } }
  // gün sınırları ve önceki günün hacim profili
  const dayStart = {}, dayEnd = {}; for (let i = 0; i < n; i++) { if (dayStart[day[i]] == null) dayStart[day[i]] = i; dayEnd[day[i]] = i; }
  const days = Object.keys(dayStart).map(Number).sort((a, b) => a - b);
  const prof = {}; for (let k = 1; k < days.length; k++) { const d = days[k - 1]; prof[days[k]] = profileOf(bars.slice(dayStart[d], dayEnd[d] + 1)); }
  const dayIdx = {}; days.forEach((d, k) => dayIdx[d] = k);

  const ev = []; let prevGrade = 'C';
  for (let i = 80; i < n; i++) {
    let dir = '-', nb = 99;
    for (let j = i; j > i - 10 && j > 0; j--) { const u = e9[j] > e21[j] && e9[j - 1] <= e21[j - 1], d = e9[j] < e21[j] && e9[j - 1] >= e21[j - 1]; if (u && C[j] > e50[j]) { dir = 'AL'; nb = i - j; break; } if (d && C[j] < e50[j]) { dir = 'SAT'; nb = i - j; break; } }
    const px = C[i], side = dir !== '-' ? dir : (px > e50[i] ? 'AL' : 'SAT');
    let grade = 'C';
    if (side === 'AL') {
      const vwUp = vw[i] != null && px > vw[i], vwD = vw[i] ? (px - vw[i]) / vw[i] * 100 : null, atrPct = at[i] / px * 100, vr = ve[i] ? V[i] / ve[i] : null;
      const gate = px > e50[i] && vwUp && atrPct >= 0.30;
      if (gate) {
        const ref = prof[day[i]] || null; let p = 0;
        if (e9[i] > e21[i] && e21[i] > e50[i]) p++;
        if (dir === 'AL' && nb <= 3) p++;
        if (vr >= 1.2) p++;
        if (ref && (Math.abs((px - ref.poc) / ref.poc * 100) <= 0.6 || Math.abs((px - ref.val) / ref.val * 100) <= 0.6)) p++;
        if (vwD >= 0 && vwD <= 1.5) p++;
        grade = p >= 5 ? 'A' : p >= 3 ? 'B' : 'C';
      }
    }
    const rank = { A: 2, B: 1, C: 0 };
    const cmin = mins[i] + 15;
    if (rank[grade] > rank[prevGrade] && grade !== 'C' && cmin >= 10 * 60 + 15 && cmin <= 17 * 60 + 30) {
      const ret = j => j < n ? (C[j] / px - 1) * 100 : null;
      const eod = dayEnd[day[i]], k = dayIdx[day[i]];
      const d1 = days[k + 1] != null ? dayEnd[days[k + 1]] : null, d3 = days[k + 3] != null ? dayEnd[days[k + 3]] : null;
      // işlem: stop 1,5 ATR, hedef 2R, en fazla 3 gün (sonra kapanıştan çık)
      const stop = px - 1.5 * at[i], tgt = px + 2 * (px - stop), lastJ = d3 != null ? d3 : n - 1;
      let res = 'sure', r = null;
      for (let j = i + 1; j <= lastJ; j++) { if (L[j] <= stop) { res = 'stop'; r = -1; break; } if (H[j] >= tgt) { res = 'hedef'; r = 2; break; } }
      if (r == null) r = (C[lastJ] - px) / (px - stop);
      ev.push([T[i], grade, round(ret(i + 4)), round(ret(eod)), d1 != null ? round(ret(d1)) : null, d3 != null ? round(ret(d3)) : null, res, round(r)]);
    }
    prevGrade = grade;
  }
  return ev;
}
const round = x => x == null || !isFinite(x) ? null : Math.round(x * 1000) / 1000;
