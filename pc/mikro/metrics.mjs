// Mikroyapı ölçüleri — saf fonksiyonlar (test edilebilir). Tüm miktarlar TL.
import { tickOf } from './ticks.mjs';

// OBI_N = (Σ wᵢ·Alışᵢ − Σ wᵢ·Satışᵢ) / (Σ wᵢ·Alışᵢ + Σ wᵢ·Satışᵢ),  wᵢ = 1/i
export function obi(bids, asks, n) {
  let b = 0, a = 0;
  for (let i = 0; i < n; i++) { const w = 1 / (i + 1); if (bids[i]) b += w * bids[i].eff; if (asks[i]) a += w * asks[i].eff; }
  return b + a > 0 ? (b - a) / (b + a) : 0;
}
// Spoofing süzgeci: 2 sn'den genç büyük emir ortanca kadar sayılır; tarafın spoof oranı yüksekse büyükler yarım ağırlık
export function filt(levels, med, now, cfg, spoofHi) {
  return levels.map(l => {
    let eff = l.tl;
    if (l.big && now - l.bigSince < cfg.youngMs) eff = Math.min(eff, med);
    if (l.big && spoofHi) eff *= 0.5;
    return { ...l, eff };
  });
}
export function spreadInfo(bid, ask) {
  if (!(bid > 0 && ask > 0) || ask < bid) return { t: null, pct: null };
  const t = Math.round((ask - bid) / tickOf(bid)), mid = (bid + ask) / 2;
  return { t, pct: (ask - bid) / mid * 100 };
}
// İlk n kademede ardışık iki fiyat arası 1 adımdan büyükse boşluk
export function gaps(levels, n = 5) {
  let g = 0; const L = levels.slice(0, n);
  for (let i = 1; i < L.length; i++) if (Math.abs(L[i].px - L[i - 1].px) > tickOf(Math.min(L[i].px, L[i - 1].px)) * 1.5) g++;
  return g;
}
// Mevcut alım hızıyla ilk 3 satış kademesi kaç saniyede biter
export function clearSec(asks, buyTLps) {
  const tl = asks.slice(0, 3).reduce((s, l) => s + l.tl, 0);
  return buyTLps > 0 ? tl / buyTLps : Infinity;
}
// Zaman ağırlıklı yumuşatma (τ ms)
export class Smooth {
  constructor(tau) { this.tau = tau; this.v = null; this.t = 0; }
  add(x, t) { if (this.v == null) { this.v = x; this.t = t; return x; } const k = 1 - Math.exp(-Math.max(0, t - this.t) / this.tau); this.v += k * (x - this.v); this.t = t; return this.v; }
}
const r3 = x => x == null || !isFinite(x) ? x : Math.round(x * 1000) / 1000;
// Bir hissenin o anki tüm ölçüleri
export function snapshot(book, tape, now, cfg, sm) {
  const { bid, ask, askQ } = book.best();
  const spB = book.spoofRatio('B', now), spA = book.spoofRatio('A', now);
  const B = filt(book.levels('B'), book.med, now, cfg, spB > cfg.spoofHi);
  const A = filt(book.levels('A'), book.med, now, cfg, spA > cfg.spoofHi);
  const o3 = obi(B, A, 3), o5 = obi(B, A, 5), o10 = obi(B, A, 10);
  const s3 = tape.sum(now - 3000), s10 = tape.sum(now - 10000), s60 = tape.sum(now - 60000);
  const sp = spreadInfo(bid, ask);
  const rate = s10.ab / 10;      // alıcılı TL/sn (son 10 sn)
  return {
    bid, ask, mid: bid && ask ? (bid + ask) / 2 : null, askTL1: ask ? ask * askQ : 0, askTL3: A.slice(0, 3).reduce((s, l) => s + l.tl, 0),
    spT: sp.t, spPct: r3(sp.pct), obi3: r3(o3), obi5: r3(o5), obi10: r3(o10), obi3s: r3(sm ? sm.add(o3, now) : o3),
    dr3: r3(s3.dr), dr10: r3(s10.dr), dr60: r3(s60.dr), ab3: Math.round(s3.ab), ab10: Math.round(s10.ab), as10: Math.round(s10.as),
    hiz: r3(tape.hiz(now)), clear: r3(clearSec(A, rate)), gapA: gaps(A), gapB: gaps(B), spoofB: r3(spB), spoofA: r3(spA), med: Math.round(book.med),
    vwap: tape.vwap(), vol: r3(tape.volRatio()),
    wallB: (B.filter(l => l.big && !(now - l.bigSince < cfg.youngMs))[0] || {}).px || null,   // destek olan (yaşlı) büyük alış
    wallA: (A.filter(l => l.big)[0] || {}).px || null,                                          // üstteki ilk büyük satış
  };
}
