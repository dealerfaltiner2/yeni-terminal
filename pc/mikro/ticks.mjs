// BIST pay fiyat adımları (1 Aralık'ta gerçek veriyle DOĞRULANACAK) + İstanbul saati yardımcıları
const STEPS = [[20, 0.01], [50, 0.02], [100, 0.05], [250, 0.10], [500, 0.25], [1000, 0.50], [2500, 1], [Infinity, 2.5]];
export function tickOf(px) { for (const [lim, t] of STEPS) if (px < lim) return t; return 2.5; }
const r6 = x => Math.round(x * 1e6) / 1e6;
export const tickUp = px => { const t = tickOf(px); return r6(Math.ceil(r6(px / t)) * t); };
export const tickDown = px => { const t = tickOf(px); return r6(Math.floor(r6(px / t)) * t); };
export const ticksBetween = (a, b) => Math.round((b - a) / tickOf(Math.min(a, b)));
// Türkiye yaz saati uygulamıyor: UTC+3 sabit
export const trMin = ms => Math.floor(((ms / 60000) + 180) % 1440);
export const trDay = ms => new Date(ms + 10800000).toISOString().slice(0, 10);
export const trWd = ms => new Date(ms + 10800000).getUTCDay();
