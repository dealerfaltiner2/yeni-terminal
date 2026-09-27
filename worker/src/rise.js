// "Yükselen hisseler neden yükseldi?" — hisse-gün özellikleri (15 dk mumlardan).
// Her gün için yalnız O ANA KADAR bilinenler (açılış öncesi + 10:30) ve sonuç etiketleri üretilir.
// Satır: [gun(YYYY-MM-DD), getiri%, 10:30→kapanış%, boşluk%, ilk30dk %, ilk30dk hacim oranı,
//         dün%, 5g%, 20g%, 20g zirveye uzaklık%, sıkışma(5g/20g mum boyu), hacim eğilimi(3g/20g),
//         EMA20(günlük) üstü 0/1, endeks gün%, endeks 10:30%, haftanın günü(1-5), gün içi zirve saati]
function daily(bars) {
  const D = new Map();
  for (const b of bars) {
    const ist = b[0] + 3 * 3600, d = Math.floor(ist / 86400), m = Math.floor((ist % 86400) / 60);
    let x = D.get(d);
    if (!x) { x = { d, o: b[1], h: b[2], l: b[3], c: b[4], v: 0, v30: 0, c30: null, h30: -Infinity, l30: Infinity, hiT: m, post: [] }; D.set(d, x); }
    x.h = Math.max(x.h, b[2]); if (b[2] >= x.h) x.hiT = m; x.l = Math.min(x.l, b[3]); x.c = b[4]; x.v += b[5] || 0;
    if (m + 15 <= 10 * 60 + 30) { x.v30 += b[5] || 0; x.c30 = b[4]; x.h30 = Math.max(x.h30, b[2]); x.l30 = Math.min(x.l30, b[3]); }
    else x.post.push([m, b[2], b[3]]); // 10:30 sonrası mumlar: [dakika, yüksek, düşük]
  }
  return [...D.values()].sort((a, b) => a.d - b.d);
}
export function riseRows(bars, idxBars) {
  const S = daily(bars), I = new Map(daily(idxBars || []).map(x => [x.d, x]));
  const IL = [...I.values()];
  const out = []; let e20 = null; const k = 2 / 21;
  for (let i = 0; i < S.length; i++) {
    const x = S[i];
    if (i >= 21 && x.c30 != null) {
      const p = S[i - 1], pc = p.c;
      const ret = (x.c / pc - 1) * 100, rest = (x.c / x.c30 - 1) * 100;
      const gap = (x.o / pc - 1) * 100, r30 = (x.c30 / pc - 1) * 100;
      let v30avg = 0; for (let j = i - 20; j < i; j++) v30avg += S[j].v30; v30avg /= 20;
      const vr30 = v30avg > 0 ? x.v30 / v30avg : null;
      const d1 = (pc / S[i - 2].c - 1) * 100, d5 = (pc / S[i - 6].c - 1) * 100, d20 = (pc / S[i - 21].c - 1) * 100;
      let h20 = -Infinity; for (let j = i - 20; j < i; j++) h20 = Math.max(h20, S[j].h);
      const dist = (pc / h20 - 1) * 100;
      const rng = j => (S[j].h - S[j].l) / S[j].c;
      let r5 = 0, r20 = 0; for (let j = i - 5; j < i; j++) r5 += rng(j); for (let j = i - 20; j < i; j++) r20 += rng(j);
      const sq = r20 > 0 ? (r5 / 5) / (r20 / 20) : null;
      let v3 = 0, v20 = 0; for (let j = i - 3; j < i; j++) v3 += S[j].v; for (let j = i - 20; j < i; j++) v20 += S[j].v;
      const vt = v20 > 0 ? (v3 / 3) / (v20 / 20) : null;
      const above = e20 != null && pc > e20 ? 1 : 0;
      const ix = I.get(x.d), ixp = ix ? IL[IL.indexOf(ix) - 1] : null;
      const ir = ix && ixp ? (ix.c / ixp.c - 1) * 100 : null, i30 = ix && ixp && ix.c30 ? (ix.c30 / ixp.c - 1) * 100 : null;
      const wd = new Date(x.d * 86400000).getUTCDay();
      const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;
      // v2: 10:30 sonrası yol — en yüksek (mfe), en düşük (mae), +%3'e ilk ulaşma dakikası (t3),
      //     +%3 gelene kadarki en derin sarkma (dd3; +%3'ün geldiği mum dahil = temkinli), sabah oynaklığı, günlük oynaklık
      let mfe = -Infinity, mae = Infinity, t3 = null, dd3 = Infinity;
      for (const [pm, ph, pl] of x.post) {
        mfe = Math.max(mfe, ph); mae = Math.min(mae, pl);
        if (t3 == null) { dd3 = Math.min(dd3, pl); if (ph >= x.c30 * 1.03) t3 = pm; }
      }
      const pct = v => isFinite(v) ? (v / x.c30 - 1) * 100 : null;
      const rng30 = isFinite(x.h30) ? (x.h30 - x.l30) / pc * 100 : null;
      let adr = 0; for (let j = i - 20; j < i; j++) adr += rng(j); adr = adr / 20 * 100;
      // v3: simetrik hedef/stop (±%1, ±%1,5, ±%2) — hangisi önce? 1 = hedef, 2 = stop, 0 = ikisi de yok (kapanış).
      //     Aynı 15 dk mumda ikisi birden varsa stop sayılır (temkinli).
      const race = K => { const up = x.c30 * (1 + K / 100), dn = x.c30 * (1 - K / 100);
        for (const [, ph, pl] of x.post) { if (pl <= dn) return 2; if (ph >= up) return 1; } return 0; };
      out.push([new Date(x.d * 86400000).toISOString().slice(0, 10), r2(ret), r2(rest), r2(gap), r2(r30), r2(vr30), r2(d1), r2(d5), r2(d20), r2(dist), r2(sq), r2(vt), above, r2(ir), r2(i30), wd, x.hiT,
        r2(pct(mfe)), r2(pct(mae)), t3, r2(pct(dd3)), r2(rng30), r2(adr), race(1), race(1.5), race(2)]);
    }
    e20 = e20 == null ? x.c : k * x.c + (1 - k) * e20; // bugünün kapanışı yarının "dün EMA20"si
  }
  return out;
}
