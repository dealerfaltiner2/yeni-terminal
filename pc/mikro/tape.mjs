// İşlem akışı (hisse başına): son 10 dk işlem halkası, agresör tarafı, günlük VWAP, normal alım hızı, 1 dk oynaklık.
import { trDay } from './ticks.mjs';

export class Tape {
  constructor(sym, cfg) {
    this.sym = sym; this.cfg = cfg;
    this.tr = [];            // { t, px, qty, tl, side:'B'|'S'|'U' }
    this.last = null;        // { px, side }
    this.day = ''; this.pv = 0; this.v = 0;
    this.slices = new Map(); // 3 sn dilim no → alıcılı TL
    this.mins = [];          // [dakika no, son fiyat] — son 25 dk
    this.lastT = 0;
  }
  // Alıcı mı vurdu, satıcı mı? Sağlayıcı vermediyse işlemden ÖNCEKİ en iyi fiyatlara göre tahmin (motorun flowTick kuralı).
  infer(px, side, bid, ask) {
    if (side === 'B' || side === 'S') return side;
    if (ask && px >= ask) return 'B';
    if (bid && px <= bid) return 'S';
    const lp = this.last && this.last.px;
    if (lp && px > lp) return 'B';
    if (lp && px < lp) return 'S';
    return (this.last && this.last.side) || 'U';
  }
  add(t, px, qty, side) {
    const d = trDay(t);
    if (d !== this.day) { this.day = d; this.pv = 0; this.v = 0; this.tr = []; this.slices.clear(); this.mins = []; }
    const tl = px * qty;
    this.tr.push({ t, px, qty, tl, side });
    this.pv += tl; this.v += qty;
    if (side === 'B') { const k = Math.floor(t / this.cfg.baseSliceMs); this.slices.set(k, (this.slices.get(k) || 0) + tl); }
    const mn = Math.floor(t / 60000), lm = this.mins[this.mins.length - 1];
    if (lm && lm[0] === mn) lm[1] = px; else { this.mins.push([mn, px]); if (this.mins.length > 25) this.mins.shift(); }
    this.last = { px, side: side === 'U' ? (this.last && this.last.side) || 'U' : side };
    this.lastT = t;
    const old = t - 600000; let i = 0; while (i < this.tr.length && this.tr[i].t < old) i++; if (i) this.tr.splice(0, i);
    const oldS = Math.floor((t - this.cfg.baseWinMs) / this.cfg.baseSliceMs); for (const k of this.slices.keys()) if (k < oldS) this.slices.delete(k);
  }
  // [from, to) aralığında alıcılı / satıcılı TL
  sum(from, to = Infinity) {
    let ab = 0, as = 0, n = 0;
    for (let i = this.tr.length - 1; i >= 0; i--) { const x = this.tr[i]; if (x.t < from) break; if (x.t >= to) continue; n++; if (x.side === 'B') ab += x.tl; else if (x.side === 'S') as += x.tl; }
    return { ab, as, n, dr: ab + as > 0 ? (ab - as) / (ab + as) : 0 };
  }
  // from'dan beri fiyatı ≥ px olan alıcılı işlemlerin TL'si (karşı kademe erimesi)
  boughtAtOrAbove(px, from) {
    let tl = 0; for (let i = this.tr.length - 1; i >= 0; i--) { const x = this.tr[i]; if (x.t < from) break; if (x.side === 'B' && x.px >= px - 1e-9) tl += x.tl; } return tl;
  }
  // Normal alıcılı TL / 3 sn dilim: son 20 dk ortalaması (seyrek işlemde ortanca 0 çıkacağı için ortalama), tabanı baseFloorTL
  baseSlice(now) {
    const cur = Math.floor(now / this.cfg.baseSliceMs), from = Math.floor((now - this.cfg.baseWinMs) / this.cfg.baseSliceMs);
    let s = 0; for (const [k, v] of this.slices) if (k >= from && k < cur) s += v;
    const n = Math.max(1, cur - from);
    return Math.max(this.cfg.baseFloorTL, s / n);
  }
  hiz(now) { const s = this.sum(now - this.cfg.baseSliceMs); return s.ab / this.baseSlice(now); }
  vwap() { return this.v > 0 ? this.pv / this.v : null; }
  // Son 1 dk getirisi ÷ son 20 dk'nın ortalama 1 dk getirisi (mutlak)
  volRatio() {
    const m = this.mins; if (m.length < 6) return 1;
    const r = []; for (let i = 1; i < m.length; i++) r.push(Math.abs(Math.log(m[i][1] / m[i - 1][1])));
    const lastR = r[r.length - 1], base = r.slice(0, -1).reduce((a, b) => a + b, 0) / (r.length - 1);
    return base > 0 ? lastR / base : 1;
  }
}
