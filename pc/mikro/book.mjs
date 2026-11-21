// Emir defteri (hisse başına). Kademeler FİYATA göre tutulur → her fiyatın lotu, ilk görülme anı,
// 'büyük emir' olduğu an ve spoofing izi. Kademe azalması işlemle mi (erime) iptalle mi (silme) oldu ayrılır.
import { tickOf } from './ticks.mjs';

const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export class Book {
  constructor(sym, cfg) {
    this.sym = sym; this.cfg = cfg;
    this.side = { B: new Map(), A: new Map() };      // px → { q, t0, bigSince, ep }
    this.traded = { B: new Map(), A: new Map() };    // işlemle eriyen lot (px → { q, t }) — azalmayı açıklamak için
    this.pend = [];                                  // işlemi henüz gelmemiş azalmalar (graceMs bekler)
    this.eps = { B: [], A: [] };                     // büyük emir bölümleri { t, tl, fake, done }
    this.ok = false; this.broken = false; this.seq = null; this.lastT = 0; this.med = 0; this.n = 0;
  }
  // ---- sorgular
  levels(sd, n = this.cfg.levels) {
    const arr = [...this.side[sd].entries()].filter(([, l]) => l.q > 0);
    arr.sort((a, b) => sd === 'B' ? b[0] - a[0] : a[0] - b[0]);
    return arr.slice(0, n).map(([px, l]) => ({ px, q: l.q, tl: px * l.q, t0: l.t0, big: !!l.bigSince, bigSince: l.bigSince }));
  }
  best() { const b = this.levels('B', 1)[0], a = this.levels('A', 1)[0]; return { bid: b ? b.px : null, ask: a ? a.px : null, bidQ: b ? b.q : 0, askQ: a ? a.q : 0 }; }
  mid() { const { bid, ask } = this.best(); return bid && ask ? (bid + ask) / 2 : null; }
  // Son spoofWin içinde başlayan büyük emirlerin TL'sinin ne kadarı sahte çıktı (0…1)
  spoofRatio(sd, now) {
    const w = now - this.cfg.spoofWin; let all = 0, fake = 0;
    this.eps[sd] = this.eps[sd].filter(e => e.t >= w);
    for (const e of this.eps[sd]) { all += e.tl; if (e.fake) fake += e.tl; }
    return all > 0 ? fake / all : 0;
  }
  // ---- işlem: hangi kademeyi eritti?
  onTrade(px, qty, aggr, now) {
    // alıcı vurdu → satış kademesi erir; satıcı vurdu → alış kademesi; bilinmiyorsa fiyatın bulunduğu taraf
    let sd = aggr === 'B' ? 'A' : aggr === 'S' ? 'B' : (this.side.A.has(px) ? 'A' : this.side.B.has(px) ? 'B' : null);
    if (!sd) return;
    let left = qty;
    // önce bekleyen (işlemi geç gelmiş) azalmaları açıkla
    for (const p of this.pend) if (p.sd === sd && p.px === px && p.cancel > 0 && left > 0) { const k = Math.min(p.cancel, left); p.cancel -= k; left -= k; }
    if (left > 0) { const m = this.traded[sd], o = m.get(px); m.set(px, { q: (o ? o.q : 0) + left, t: now }); }
  }
  // ---- defter güncellemesi; dönen değer: hata metni ya da ''
  apply(ev) {
    const now = ev.rts, b = ev.book;
    if (ev.seq != null) {
      if (this.seq != null && ev.seq !== this.seq + 1 && !b.snap) { this.broken = true; this.ok = false; }
      this.seq = ev.seq;
    }
    if (b.snap) {
      const nb = new Map(b.bids.filter(l => l[1] > 0).map(l => [l[0], l[1]]));
      const na = new Map(b.asks.filter(l => l[1] > 0).map(l => [l[0], l[1]]));
      this._diff('B', nb, now); this._diff('A', na, now);
      this.ok = true; this.broken = false;
    } else {
      if (!this.ok) return 'anlık görüntü yok';
      const m = this.side[b.side], l = m.get(b.px), nq = b.op === 'del' ? 0 : b.qty;
      if (!l) { if (nq > 0) m.set(b.px, { q: nq, t0: now, bigSince: 0, ep: null }); }
      else if (nq < l.q) this._dec(b.side, b.px, l, l.q - nq, nq, now);
      else l.q = nq;
      if (l && nq === 0 && !l.bigSince) m.delete(b.px);
    }
    this.lastT = now; this.n++;
    this._bigMark(now);
    this.finalize(now);
    return '';
  }
  // Yeni tam görüntüyü eskiyle karşılaştır
  _diff(sd, nm, now) {
    const m = this.side[sd];
    // görünen aralığın dışına itilen kademe iptal sayılmaz (fiyat kayınca 10. kademe ekrandan düşer)
    const px = [...nm.keys()]; const edge = px.length ? (sd === 'B' ? Math.min(...px) : Math.max(...px)) : null;
    for (const [p, l] of [...m.entries()]) {
      const nq = nm.get(p) || 0;
      if (nq < l.q) {
        const out = edge != null && nq === 0 && (sd === 'B' ? p < edge : p > edge) && px.length >= this.cfg.levels;
        if (out) { m.delete(p); continue; }
        this._dec(sd, p, l, l.q - nq, nq, now);
      } else l.q = nq;
    }
    for (const [p, q] of nm) if (!m.has(p)) m.set(p, { q, t0: now, bigSince: 0, ep: null });
    for (const [p, l] of [...m.entries()]) if (l.q <= 0 && !this.pend.some(x => x.sd === sd && x.px === p)) m.delete(p);
  }
  _dec(sd, p, l, dq, nq, now) {
    const tm = this.traded[sd], tr = tm.get(p), ex = Math.min(dq, tr ? tr.q : 0);
    if (tr) { tr.q -= ex; if (tr.q <= 0) tm.delete(p); }
    const cancel = dq - ex;
    if (l.bigSince && l.ep) this.pend.push({ sd, px: p, cancel, dq, t: now, wasBig: true, ep: l.ep, age: now - l.bigSince, nq, mid: this.mid() });
    else if (cancel > 0) this.pend.push({ sd, px: p, cancel, dq, t: now, wasBig: false });
    l.q = nq;
  }
  // graceMs geçmiş azalmaları kesinleştir: büyük emir çoğunlukla İPTALLE, gençken ve fiyattan uzakken kalktıysa → sahte
  finalize(now) {
    const keep = [];
    for (const p of this.pend) {
      if (now - p.t < this.cfg.graceMs) { keep.push(p); continue; }
      if (p.wasBig && p.ep && !p.ep.done) {
        const l = this.side[p.sd].get(p.px), stillBig = l && l.q > 0 && l.ep === p.ep;
        if (!stillBig) {
          const far = p.mid ? Math.abs(p.px - p.mid) / tickOf(p.px) > this.cfg.spoofFarT : false;
          p.ep.done = true;
          p.ep.fake = p.cancel >= 0.5 * p.dq && p.age < this.cfg.spoofAgeMs && far;
        }
      }
    }
    this.pend = keep;
    for (const sd of ['B', 'A']) { const tm = this.traded[sd]; for (const [p, x] of tm) if (now - x.t > 3000) tm.delete(p); }
    for (const sd of ['B', 'A']) for (const [p, l] of [...this.side[sd].entries()]) if (l.q <= 0 && !keep.some(x => x.sd === sd && x.px === p)) this.side[sd].delete(p);
  }
  // Büyük emirleri işaretle (ortanca kademe TL'sine göre)
  _bigMark(now) {
    const lv = [...this.levels('B'), ...this.levels('A')];
    this.med = median(lv.map(x => x.tl));
    const thr = Math.max(this.cfg.bigMult * this.med, this.cfg.bigMinTL);
    for (const sd of ['B', 'A']) for (const x of this.levels(sd)) {
      const l = this.side[sd].get(x.px);
      if (x.tl >= thr) { if (!l.bigSince) { l.bigSince = now; l.ep = { t: now, tl: x.tl, fake: false, done: false }; this.eps[sd].push(l.ep); } }
      else if (l.bigSince) { l.bigSince = 0; if (l.ep && !this.pend.some(p => p.ep === l.ep)) l.ep.done = true; l.ep = null; }
    }
  }
}
