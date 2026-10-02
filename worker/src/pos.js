// v8.2 POZİSYON ASİSTANI — "Aldım" denen işlemleri sunucu dakikada bir izler (telefon kapalı olsa da).
// D1 meta 'pos' = [{id, sym, e, sp, tp, lot, src, t, f:{up1,near,tp,sp}}]. Uyarılar: Telegram + iPhone bildirimi (kategori 'poz').
// +%1'de "stopu girişe çek", stopa %0,3 kala "dikkat", hedef/stop geldi, 17:45'te "açık pozisyonun var" hatırlatması. 18:15'ten sonra liste temizlenir.
const TRMS = 3 * 3600e3;
const nf = (n, d = 2) => (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
async function getPos(env) { const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'pos'").first(); try { return r ? JSON.parse(r.v) : []; } catch (e) { return []; } }
async function setPos(env, L) { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('pos', ?)").bind(JSON.stringify(L.slice(-20))).run(); }
export async function posRoute(request, env, json) {
  if (request.method !== 'POST') return json({ ok: true, list: await getPos(env) });
  let b; try { b = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
  let L = await getPos(env);
  if (b.op === 'add') {
    const sym = String(b.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10), e = +b.e, sp = +b.sp, tp = +b.tp || null;
    if (!sym || !(e > 0) || !(sp > 0) || sp >= e) return json({ ok: false, error: 'eksik ya da hatalı (stop girişin altında olmalı)' }, 400);
    const id = String(b.id || (sym + '-' + Date.now())).slice(0, 40);
    L = L.filter(x => x.id !== id); L.push({ id, sym, e, sp, tp, lot: +b.lot || null, src: String(b.src || '').slice(0, 16), t: Date.now(), f: {} });
  } else if (b.op === 'del') L = L.filter(x => x.id !== String(b.id || ''));
  else if (b.op === 'upd') { const x = L.find(x => x.id === String(b.id || '')); if (x) { if (+b.sp > 0) x.sp = +b.sp; if (+b.tp > 0) x.tp = +b.tp; } }
  await setPos(env, L);
  return json({ ok: true, list: L });
}
export async function posWatch(env, h) {
  const d = new Date(Date.now() + TRMS), wd = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (wd < 1 || wd > 5) return null;
  let L = await getPos(env);
  if (!L.length) return null;
  if (m >= 1095) { await setPos(env, []); return { temizlendi: L.length }; }
  if (m < 600 || m > 1090) return null;
  const tick = [...new Set(L.map(x => 'BIST:' + x.sym))].slice(0, 20);
  const r = await h.scanRaw(env, JSON.stringify({ symbols: { tickers: tick }, columns: ['name', 'close'] }));
  const j = await r.json(); const Q = {}; (j.data || []).forEach(x => { Q[String(x.s).split(':').pop()] = x.d[1]; });
  const cfg = await h.kvGet(env, 'cfg', null);
  const say = async (title, body, sym, tag) => {
    try { await h.tgSend(cfg, '<b>' + h.esc(title) + '</b>\n' + h.esc(body)); } catch (e) {}
    try { await h.pushSend(env, { cat: 'poz', title, body, url: './?s=' + sym, tag }, 3); } catch (e) {}
  };
  let dirty = false, n = 0;
  const keep = [];
  for (const x of L) {
    const p = Q[x.sym]; if (!(p > 0)) { keep.push(x); continue; }
    const ch = (p / x.e - 1) * 100, f = x.f || (x.f = {});
    const st = '\nGiriş ' + nf(x.e) + ' · şimdi ' + nf(p) + ' (' + (ch >= 0 ? '+' : '') + nf(ch) + '%)';
    if (p <= x.sp && !f.sp) { f.sp = 1; dirty = true; n++; await say('🛑 ' + x.sym + ' · stop seviyesi geldi', 'Stop ' + nf(x.sp) + st + '\nPlanına göre çık; izleme kapatıldı.', x.sym, 'poz' + x.id); continue; }
    if (x.tp && p >= x.tp && !f.tp) { f.tp = 1; dirty = true; n++; await say('🎯 ' + x.sym + ' · hedef geldi', 'Hedef ' + nf(x.tp) + st + '\nKârı al ya da stopu yükselterek devam et; izleme kapatıldı.', x.sym, 'poz' + x.id); continue; }
    if (ch >= 1 && !f.up1) { f.up1 = 1; dirty = true; n++; await say('📈 ' + x.sym + ' · +%1 kârda', 'Stopu giriş fiyatına (' + nf(x.e) + ') çekebilirsin; böylece işlem en kötü başa baş biter.' + st, x.sym, 'poz' + x.id); }
    else if (p > x.sp && p <= x.sp * 1.003 && !f.near) { f.near = 1; dirty = true; n++; await say('⚠️ ' + x.sym + ' · stopa çok yakın', 'Stop ' + nf(x.sp) + ' · kalan %' + nf((p / x.sp - 1) * 100) + st, x.sym, 'poz' + x.id); }
    keep.push(x);
  }
  if (keep.length !== L.length) dirty = true;
  if (m >= 1065 && keep.length) {
    const rm = await env.BT.prepare("SELECT v FROM meta WHERE k = 'pos_rem'").first(), day = d.toISOString().slice(0, 10);
    if (!rm || rm.v !== day) {
      await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('pos_rem', ?)").bind(day).run();
      await say('⏰ Kapanışa 15 dakika · açık pozisyon', keep.map(x => x.sym + ' ' + nf(Q[x.sym]) + ' (' + (Q[x.sym] ? ((Q[x.sym] / x.e - 1) * 100 >= 0 ? '+' : '') + nf((Q[x.sym] / x.e - 1) * 100) + '%' : '-') + ')').join(' · ') + '\nGün içi işlemse kapanış öncesi çıkmayı düşün.', keep[0].sym, 'pozrem');
    }
  }
  if (dirty) await setPos(env, keep);
  return { izlenen: keep.length, uyari: n };
}
