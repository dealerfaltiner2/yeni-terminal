// Teyitli sinyalin sonrası: 30 sn / 1 dk / 3 dk orta fiyat farkı, 3 dk en iyi/en kötü, ilk olan (H1 / H2 / stop / süre), 'kaçtı'.
import { tickOf } from './ticks.mjs';
const r3 = x => Math.round(x * 1000) / 1000;

export class Outcome {
  constructor(cfg) { this.cfg = cfg; this.open = []; }
  add(sig) { this.open.push({ sig, mfe: 0, mae: 0, r30: null, r60: null, r180: null, hit: null, ht: null, maxAsk: 0, back: false }); }
  // Her fiyat değişiminde (orta fiyat + satış₁) çağrılır; biten kayıtları döndürür
  onPrice(sym, t, mid, ask) {
    const done = [];
    for (const o of this.open) {
      const s = o.sig; if (s.sym !== sym || !(mid > 0)) continue;
      const dt = t - s.tc, r = (mid / s.lv.entry - 1) * 100;
      if (dt <= this.cfg.ttlMs) { if (ask > o.maxAsk) o.maxAsk = ask; if (ask && ask <= s.lv.entry) o.back = true; }
      if (dt <= this.cfg.timeStopMs) { if (r > o.mfe) o.mfe = r; if (r < o.mae) o.mae = r; }
      if (o.r30 == null && dt >= 30000) o.r30 = r3(r);
      if (o.r60 == null && dt >= 60000) o.r60 = r3(r);
      if (!o.hit && dt <= this.cfg.timeStopMs) {
        if (mid <= s.lv.stop) { o.hit = 'stop'; o.ht = t; }
        else if (mid >= s.lv.t2) { o.hit = 'h2'; o.ht = t; }
        else if (mid >= s.lv.t1) { o.hit = 'h1'; o.ht = t; }
      }
      if (dt >= this.cfg.timeStopMs) { o.r180 = r3(r); done.push(o); }
    }
    return this._close(done);
  }
  // Fiyat gelmese de süreyi kapat (bağlantı koptu vs.)
  tick(now) { return this._close(this.open.filter(o => now - o.sig.tc >= this.cfg.timeStopMs + 30000)); }
  _close(list) {
    if (!list.length) return [];
    this.open = this.open.filter(o => !list.includes(o));
    return list.map(o => {
      const s = o.sig, kacti = !o.back && o.maxAsk > s.lv.entry + this.cfg.kactiT * tickOf(s.lv.entry);
      return { id: s.id, sym: s.sym, r30: o.r30, r60: o.r60, r180: o.r180, mfe: r3(o.mfe), mae: r3(o.mae), hit: kacti ? 'kacti' : (o.hit || 'sure'), ht: o.ht };
    });
  }
}
