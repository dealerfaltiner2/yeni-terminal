// MİKRO MOTOR — iki aşamalı sinyal: CANDIDATE (aday) → confWin içinde teyit → CONFIRMED, yoksa süresi dolar.
// Yalnız NormalizedMarketEvent görür (sağlayıcıdan bağımsız). Dış bağımlılıklar parametreyle gelir:
//   context(sym) → { vwapD?, ema20_15, ema50_15, h4 (1 yukarı / 0 / −1 aşağı), abc ('A'|'B'|'C'|null) } | null   (Pusula'nın 15 dk / 4 sa bağlamı)
//   market(sym)  → { idx5m (BIST 100 son 5 dk %), adv (20 gün ort. işlem TL), tedbir (bool), halt (bool) }
//   emit(kayıt)  → st: 'cand' | 'conf' | 'exp' | 'blok' | 'son' (sonuç) | 'durum'
import { validateEvent } from './schema.mjs';
import { Book } from './book.mjs';
import { Tape } from './tape.mjs';
import { Smooth, snapshot } from './metrics.mjs';
import { gateCheck } from './gates.mjs';
import { scoreOf, levelsOf } from './score.mjs';
import { Outcome } from './outcome.mjs';
import { trDay } from './ticks.mjs';

export class Engine {
  constructor({ cfg, context = () => null, market = () => ({}), emit = () => {} }) {
    this.cfg = cfg; this.context = context; this.market = market; this.emit = emit;
    this.S = new Map();
    this.g = { d: '', day: 0, hour: [], stops: 0, brake: false, lastHb: 0, bad: 0, badWhy: {}, n: 0 };
    this.out = new Outcome(cfg);
  }
  sym(s) {
    let S = this.S.get(s);
    if (!S) { S = { sym: s, book: new Book(s, this.cfg), tape: new Tape(s, this.cfg), sm: new Smooth(this.cfg.obiTau), state: 'YOK', readyAt: 0, q: {}, cand: null, coolUntil: 0, lastBlok: 0, m: null }; this.S.set(s, S); }
    return S;
  }
  _day(now) { const d = trDay(now); if (d !== this.g.d) { this.g.d = d; this.g.day = 0; this.g.hour = []; this.g.stops = 0; this.g.brake = false; } }
  _setState(S, st, now, why) { if (S.state === st) return; S.state = st; this.emit({ st: 'durum', sym: S.sym, t: now, durum: st, why: why || '' }); if (st !== 'HAZIR' && st !== 'ISINMA' && S.cand) this._expire(S, now, ['veri ' + st.toLowerCase()]); }

  onEvent(ev) {
    const err = validateEvent(ev);
    if (err) { this.g.bad++; this.g.badWhy[err] = (this.g.badWhy[err] || 0) + 1; return; }
    const now = ev.rts; this._day(now); this.g.n++;
    if (ev.type === 'hb') { this.g.lastHb = now; return; }
    const S = this.sym(ev.sym);
    if (ev.type === 'book') {
      const e = S.book.apply(ev);
      if (S.book.broken) this._setState(S, 'BOZUK', now, 'sıra numarası atladı');
      else if (!e && S.book.ok && (S.state === 'YOK' || S.state === 'BOZUK' || S.state === 'BAYAT')) { S.readyAt = now + this.cfg.warmMs; this._setState(S, 'ISINMA', now); }
    } else if (ev.type === 'trade') {
      const t = ev.trade, { bid, ask } = S.book.best();
      const side = S.tape.infer(t.px, t.side, bid, ask);
      S.book.onTrade(t.px, t.qty, side, now);
      S.tape.add(now, t.px, t.qty, side);
    } else if (ev.type === 'quote') S.q = { ...S.q, ...ev.quote };
    else if (ev.type === 'status') { S.q.halt = ev.status.state === 'halt'; if (S.q.halt) this._setState(S, 'DURDU', now); else if (S.state === 'DURDU') { S.book.ok = false; this._setState(S, 'BAYAT', now, 'işlem yeniden açıldı, tam görüntü bekleniyor'); } }
    else if (ev.type === 'akd') S.akd = ev.akd;
    if (ev.type === 'book' || ev.type === 'trade') this._eval(S, now);
  }

  // Saniyede bir çağrılır: kopma / bayat veri, ısınma, aday süresi, sonuç süresi
  tick(now) {
    this._day(now);
    const hbDead = this.g.lastHb && now - this.g.lastHb > this.cfg.hbMaxMs;
    for (const S of this.S.values()) {
      if (S.state === 'YOK' || S.state === 'DURDU') continue;
      if (hbDead && S.state !== 'BAYAT') { S.book.ok = false; this._setState(S, 'BAYAT', now, 'robottan kalp atışı yok'); continue; }
      const bk = S.book.lastT, tr = S.tape.lastT;
      if (S.state === 'HAZIR' && tr > bk && now - bk > this.cfg.bookStaleMs) { S.book.ok = false; this._setState(S, 'BAYAT', now, 'işlem var, defter güncellenmiyor'); continue; }
      if (S.state === 'ISINMA' && now >= S.readyAt) this._setState(S, 'HAZIR', now);
      if (S.cand && now - S.cand.t0 > this.cfg.confWin) this._expire(S, now, S.cand.fail || ['süre']);
      S.book.finalize(now);
    }
    for (const r of this.out.tick(now)) this._son(r);
  }

  _eval(S, now) {
    if (S.state === 'ISINMA' && now >= S.readyAt) this._setState(S, 'HAZIR', now);
    if (!S.book.ok) return;
    const m = snapshot(S.book, S.tape, now, this.cfg, S.sm); S.m = m;
    if (m.mid) for (const r of this.out.onPrice(S.sym, now, m.mid, m.ask)) this._son(r);
    const c = this.cfg;
    if (S.cand) {
      if (now - S.cand.t0 > c.confWin) return this._expire(S, now, S.cand.fail || ['süre']);
      const k = this._confirm(S, m, now); S.cand.fail = k.fail; S.cand.c = k.c;
      if (k.ok) this._conf(S, m, now, k);
      return;
    }
    if (S.state !== 'HAZIR') return;
    const spMax = m.ask && m.ask < c.lowPx ? c.spreadMaxTLow : c.spreadMaxT;
    const candOk = m.obi3s >= c.obi3Min && m.obi5 >= c.obi5Min && m.spT != null && m.spT <= spMax && m.spPct <= c.spreadMaxPct && m.clear <= c.clearMax && m.dr10 >= c.drCand;
    if (!candOk) return;
    const mkt = this.market(S.sym) || {};
    const gt = gateCheck({ now, st: S, m, q: S.q, mkt, g: { brake: this.g.brake, day: this.g.day, hour: this.g.hour } }, c);
    if (!gt.ok) {
      if (now - S.lastBlok > c.blokThrottleMs) { S.lastBlok = now; this.emit({ st: 'blok', id: S.sym + '-' + now, sym: S.sym, t0: now, px0: m.ask, gate: gt.why, m }); }
      return;
    }
    S.cand = { id: S.sym + '-' + now, t0: now, px0: m.ask, askTL0: m.askTL1, m0: m, minScore: gt.minScore, fail: null, c: null };
    this.emit({ st: 'cand', id: S.cand.id, sym: S.sym, t0: now, px0: m.ask, m });
    const k = this._confirm(S, m, now); S.cand.fail = k.fail; S.cand.c = k.c;
    if (k.ok) this._conf(S, m, now, k);
  }

  _confirm(S, m, now) {
    const c = this.cfg, k = S.cand, fail = [];
    const eriTL = S.tape.boughtAtOrAbove(k.px0, k.t0), erime = k.askTL0 > 0 ? eriTL / k.askTL0 : 0, stepped = m.ask > k.px0;
    if (!(erime >= c.erimeOran || (stepped && erime >= c.erimeStepOran))) fail.push('karşı kademe erimedi');
    const w = S.tape.sum(k.t0), baseW = S.tape.baseSlice(now) * (c.confWin / c.baseSliceMs);
    if (!(w.ab >= Math.max(c.confMinTL, c.confBaseMult * baseW) && w.dr >= c.drConf)) fail.push('agresif alım yetersiz');
    if (!(m.obi3 >= c.obi3Keep)) fail.push('kademe dengesi bozuldu');
    const ctx = this.context(S.sym), px = m.ask, vw = m.vwap || (ctx && ctx.vwapD);
    if (!ctx) fail.push('bağlam yok');
    else {
      if (!(vw && px >= vw)) fail.push('günlük VWAP altında');
      if (!(ctx.ema20_15 && ctx.ema50_15 && px > ctx.ema20_15 && ctx.ema20_15 > ctx.ema50_15)) fail.push('15 dk trend yukarı değil');
      if (ctx.h4 === -1) fail.push('4 saatlik aşağı');
      if (vw && (px / vw - 1) * 100 > c.maxChase) fail.push('kovalama (VWAP\'tan uzak)');
    }
    return { ok: !fail.length, fail, c: { erime: Math.round(erime * 1000) / 1000, stepped, drW: Math.round(w.dr * 1000) / 1000, abW: Math.round(w.ab), baseW: Math.round(baseW) } };
  }

  _conf(S, m, now, k) {
    const c = this.cfg, ctx = this.context(S.sym) || {}, mkt = this.market(S.sym) || {};
    const sc = scoreOf(m, k.c, ctx, mkt, c);
    if (sc.score < S.cand.minScore) return this._expire(S, now, ['oynak piyasada skor yetersiz (' + sc.score + ')']);
    const lv = levelsOf(m.ask, m, c), vw = m.vwap || ctx.vwapD;
    const rec = { st: 'conf', id: S.cand.id, sym: S.sym, t0: S.cand.t0, tc: now, px0: S.cand.px0, pxe: lv.entry, score: sc.score, parts: sc.parts,
      m0: S.cand.m0, m, c: k.c, ctx: { vwap: vw ? Math.round(vw * 1000) / 1000 : null, dVw: vw ? Math.round((m.ask / vw - 1) * 10000) / 100 : null, ema20_15: ctx.ema20_15 ?? null, ema50_15: ctx.ema50_15 ?? null, h4: ctx.h4 ?? null, abc: ctx.abc ?? null, idx5m: mkt.idx5m ?? null },
      lv, ttl: now + c.ttlMs, tg: !c.shadow && sc.score >= c.tgScore };
    this.emit(rec); this.out.add(rec);
    S.coolUntil = now + c.coolMs; this.g.day++; this.g.hour.push(now); S.cand = null;
  }
  _expire(S, now, fail) { const k = S.cand; if (!k) return; this.emit({ st: 'exp', id: k.id, sym: S.sym, t0: k.t0, px0: k.px0, m0: k.m0, fail, c: k.c, tx: now }); S.cand = null; }
  _son(r) {
    this.emit({ st: 'son', ...r });
    const S = this.S.get(r.sym);
    if (r.hit === 'stop') { this.g.stops++; if (S) S.coolUntil = Math.max(S.coolUntil, (r.ht || 0) + this.cfg.coolStopMs); if (this.g.stops >= this.cfg.brakeStops) this.g.brake = true; }
    else if (r.hit === 'h1' || r.hit === 'h2') this.g.stops = 0;
  }
  status() { return { n: this.g.n, bad: this.g.bad, badWhy: this.g.badWhy, day: this.g.day, brake: this.g.brake, lastHb: this.g.lastHb, syms: [...this.S.values()].map(S => ({ sym: S.sym, durum: S.state, aday: !!S.cand })) }; }
}
