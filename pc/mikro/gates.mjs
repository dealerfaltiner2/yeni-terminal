// Risk ve rejim kapıları — saf fonksiyon. { ok, why, minScore } döner (why: neden kapalı, düz Türkçe).
import { trMin, trWd } from './ticks.mjs';

// inp: { now, st (hisse durumu), m (ölçüler), q (son quote: tavan/taban/last), mkt (piyasa: idx5m, adv, tedbir, halt), g (genel sayaçlar) }
export function gateCheck(inp, cfg) {
  const { now, st, m, q = {}, mkt = {}, g = {} } = inp;
  const r = why => ({ ok: false, why, minScore: 0 });
  if (st.state !== 'HAZIR') return r('veri ' + st.state.toLowerCase());
  const wd = trWd(now), mn = trMin(now);
  if (wd < 1 || wd > 5) return r('seans yok');
  if (mn < cfg.openTo) return r(mn >= cfg.openFrom ? 'açılış oynaklığı' : 'seans öncesi');
  if (mn >= cfg.closeFrom) return r('kapanışa yakın');
  if (mkt.halt || q.halt) return r('işlem durdu');
  if (mkt.tedbir) return r('Borsa tedbiri');
  if (m.spT == null || m.spT > cfg.spreadHardT || m.spPct > cfg.spreadHardPct) return r('spread geniş');
  if (mkt.adv != null && mkt.adv < cfg.minAdv) return r('likidite düşük');
  const last = m.ask || q.last;
  if (q.tavan > 0 && last >= q.tavan * (1 - cfg.tavanNear / 100)) return r('tavana yakın');
  if (q.taban > 0 && last <= q.taban * (1 + cfg.tabanNear / 100)) return r('tabana yakın');
  if (mkt.idx5m != null && mkt.idx5m <= cfg.idx5mMin) return r('endeks sert düşüyor');
  if (st.coolUntil && now < st.coolUntil) return r('bekleme süresi');
  if (g.brake) return r('günlük fren');
  if (g.day >= cfg.maxDay) return r('günlük sınır');
  if ((g.hour || []).filter(t => now - t < 3600000).length >= cfg.maxHour) return r('saatlik sınır');
  return { ok: true, why: '', minScore: m.vol != null && m.vol >= cfg.volMult ? cfg.volScoreMin : 0 };
}
