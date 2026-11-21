// Güven skoru (0–100) ve giriş / hedef / stop seviyeleri — saf fonksiyonlar.
import { tickOf, tickUp, tickDown } from './ticks.mjs';

const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
// c = teyit bilgisi { erime (0…1+), drW, abW }, ctx = { abc }, mkt = { idx5m }
export function scoreOf(m, c, ctx, mkt, cfg) {
  const parts = {
    obi: cl((m.obi3s - 0.2) / 0.6) * 14 + cl(m.obi5 / 0.6) * 3 + cl(m.obi10 / 0.5) * 3,                     // 20
    agr: cl((c.drW - 0.3) / 0.7) * 10 + cl((m.hiz - 1) / (cfg.hizFull - 1)) * 15,                           // 25
    eri: cl(c.erime) * 12 + (m.clear <= cfg.clearStrong ? 8 : m.clear <= cfg.clearMax ? 4 : 0),            // 20
    spr: Math.max(0, Math.min(10, (m.spT <= 1 ? 6 : m.spT <= 2 ? 2 : 0) + (m.gapA > 0 ? 2 : 0) - (m.gapB > 0 ? 2 : 0) + 2)),   // 10
    ctx: ({ A: 20, B: 12, C: 5 })[ctx && ctx.abc] ?? 5,                                                     // 20
    rej: mkt && mkt.idx5m != null ? (mkt.idx5m > 0.3 ? 5 : mkt.idx5m < -0.3 ? -5 : 0) : 0,                  // ±5
    spf: -Math.round(cl(m.spoofB) * 15),                                                                    // −15
  };
  let s = 0; for (const k in parts) s += parts[k];
  for (const k in parts) parts[k] = Math.round(parts[k] * 10) / 10;
  return { score: Math.round(cl(s, 0, 100)), parts };
}
// Giriş = teyit anındaki satış₁; H1 = +%0,5 (en az 3 adım); H2 = üstteki büyük satış duvarının 1 adım altı ya da +%1 (yakın olan, H1'den büyük);
// Stop = destek olan alış duvarının 1 adım altı, ama en çok %1 (duvar yoksa %0,6)
export function levelsOf(entry, m, cfg) {
  const t = tickOf(entry);
  const t1 = Math.max(tickUp(entry * (1 + cfg.t1Pct / 100)), +(entry + cfg.t1MinT * t).toFixed(6));
  let t2 = tickUp(entry * (1 + cfg.t2Pct / 100));
  if (m.wallA && m.wallA > t1) { const w = +(m.wallA - tickOf(m.wallA)).toFixed(6); if (w > t1 && w < t2) t2 = w; }
  if (t2 <= t1) t2 = +(t1 + t).toFixed(6);
  const floor = tickUp(entry * (1 - cfg.stopMaxPct / 100));
  let stop = m.wallB && m.wallB < entry ? +(m.wallB - tickOf(m.wallB)).toFixed(6) : tickDown(entry * (1 - cfg.stopDefPct / 100));
  if (stop < floor) stop = floor;
  if (stop >= entry) stop = +(entry - t).toFixed(6);
  return { entry, t1, t2, stop };
}
