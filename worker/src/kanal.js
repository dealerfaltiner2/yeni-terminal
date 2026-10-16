// v12.4 (17.10, Fatih: 'grubu büyütmek senin görevin') HERKESE AÇIK KANAL
// Fatih kanalı açıp botu YÖNETİCİ yapınca Telegram 'my_chat_member' gönderir → meta 'pubch' {id, title, user, at} (kanalSet).
// Kanala hafta içi iki bilgi mesajı (canlı AL/hedef/stop YOK — SPK riski; yalnız haber, takvim, piyasa özeti, geçmiş karne toplamı):
//   sabah 09:35–10:00 (kanalAm, meta 'pub_am' = gün): akşamdan beri önemli KAP (önem ≥2, en çok 8) + bugünün önemli verileri
//   akşam 18:30–21:00 (kanalPm, meta 'pub_pm' = gün): piyasa özeti (meta 'mkt_close') + günün sinyal karnesi toplamı (meta 'sigsum' bugünse; 20:30'dan sonra karnesiz)
// Her mesajda '🧭 Pusula'yı aç' düğmesi (startapp=k_am / k_pm → üye kaydında 'nereden geldi'). Abone sayısı akşam meta 'pub_hist'e (60 gün).
// Dakikalık işe ek yük: pencere dışında SIFIR okuma; pencerede dakikada 1 meta okuması (PK).
import { TG_APP } from './tgapp.js';
import { KAP_AD } from './kap.js';
import { mktBlock, tgQuote } from './tgfmt.js';
import { trDay } from './sig.js';
const TRMS = 3 * 3600e3;
const trp = ms => { const d = new Date(ms + TRMS); return { wd: d.getUTCDay(), m: d.getUTCHours() * 60 + d.getUTCMinutes(), day: d.toISOString().slice(0, 10) }; };
export const kanalKb = tag => ({ inline_keyboard: [[{ text: '🧭 Pusula\'yı aç', url: TG_APP + '?startapp=k_' + tag }]] });
const NOTE = '\n\n<i>Bilgi amaçlıdır, yatırım tavsiyesi değildir.</i>';
const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const tarih = ms => { const d = new Date(ms + TRMS); return d.getUTCDate() + ' ' + AY[d.getUTCMonth()] + ' ' + GUN[d.getUTCDay()]; };
const hm = ms => new Date(ms + TRMS).toISOString().slice(11, 16);
const EC_TR = [[/core inflation rate yoy/i, 'Çekirdek enflasyon (yıllık)'], [/inflation rate yoy/i, 'Enflasyon (yıllık)'], [/core inflation rate mom/i, 'Çekirdek enflasyon (aylık)'], [/inflation rate mom/i, 'Enflasyon (aylık)'],
  [/core pce/i, 'Çekirdek PCE enflasyonu'], [/pce price/i, 'PCE enflasyonu'], [/ppi/i, 'Üretici fiyatları (ÜFE)'], [/interest rate decision|fed interest rate|one-week repo/i, 'Faiz kararı'], [/fomc minutes/i, 'FED toplantı tutanakları'],
  [/fomc press|fed chair|powell/i, 'FED başkanı konuşması'], [/non farm payrolls/i, 'Tarım dışı istihdam'], [/unemployment rate/i, 'İşsizlik oranı'], [/initial jobless/i, 'Haftalık işsizlik başvuruları'],
  [/gdp growth rate yoy/i, 'Büyüme (yıllık)'], [/gdp growth/i, 'Büyüme'], [/retail sales/i, 'Perakende satışlar'], [/ism manufacturing/i, 'ISM imalat endeksi'], [/ism services|ism non-manufacturing/i, 'ISM hizmet endeksi'],
  [/manufacturing pmi/i, 'İmalat PMI'], [/current account/i, 'Cari denge'], [/balance of trade/i, 'Dış ticaret dengesi'], [/capacity utilization/i, 'Kapasite kullanım oranı'], [/business confidence/i, 'Reel kesim güveni'],
  [/consumer confidence/i, 'Tüketici güveni'], [/industrial production/i, 'Sanayi üretimi'], [/michigan/i, 'Michigan tüketici güveni'], [/durable goods/i, 'Dayanıklı mal siparişleri']];
const ecTitle = e => { for (const [r, t] of EC_TR) if (r.test(e.ti)) return t; return e.ti; };
const ecImp = e => e.im >= 1 || (e.c === 'TR' && /inflation|interest rate|repo|gdp/i.test(e.ti));
// önceki iş gününün 18:00'i (TR) — sabah mesajının 'akşamdan beri' başlangıcı
export function prevEve(now) {
  let t = now;
  for (let i = 0; i < 5; i++) { t -= 864e5; const p = trp(t); if (p.wd >= 1 && p.wd <= 5) break; }
  return Date.parse(trp(t).day + 'T18:00:00Z') - TRMS;
}
// saf: sabah mesajı metni
export function amText(now, kaps, ecal, esc) {
  let t = '🌅 <b>Günaydın · BIST Pusula</b>   <i>' + tarih(now) + '</i>\n\n📰 <b>Akşamdan bu yana önemli KAP haberleri</b>';
  if (kaps.length) t += '\n' + kaps.map(r => (r.yon > 0 ? '🟢' : r.yon < 0 ? '🔴' : '⚪') + ' <b>' + esc(String(r.syms || '').split(',').slice(0, 3).join(', ')) + '</b> · ' + esc(KAP_AD[r.tip] || r.tip || 'bildirim') +
    '\n<blockquote>' + esc(String(r.summ || r.subj || '').slice(0, 120)) + '</blockquote>').join('');
  else t += '\nÖnemli bir KAP haberi gelmedi.';
  const day = trp(now).day, ev = (ecal || []).filter(e => ecImp(e) && trp(e.t).day === day).slice(0, 6);
  if (ev.length) t += '\n\n🗓 <b>Bugünün önemli verileri</b>\n<blockquote>' + ev.map(e => hm(e.t) + '  ' + (e.c === 'TR' ? '🇹🇷' : e.c === 'US' ? '🇺🇸' : esc(e.c)) + ' ' + esc(ecTitle(e)) +
    (e.f != null ? ' · beklenti ' + e.f + (e.u === '%' ? '%' : '') : '')).join('\n') + '</blockquote>';
  return t + NOTE;
}
const PUB_SRC = { algi: '⚡ Algı', 'firsat-A': '🅰️ Fırsat A', 'firsat-B': '🅱️ Fırsat B', momentum: '🧪 Momentum', tavan6: '🚀 Tavan sakin açılış' };
// saf: akşam mesajı metni (karne satırları: [{src, o31}] — o31 1 hedef, 2 stop, 0 sonuçsuz)
export function pmText(now, mkt, rows, esc) {
  let t = '🌆 <b>Günün özeti · BIST Pusula</b>   <i>' + tarih(now) + '</i>';
  const mb = mktBlock(mkt, esc); if (mb) t += tgQuote(mb);
  if (rows && rows.length) {
    const G = {};
    for (const r of rows) { if (!PUB_SRC[r.src]) continue; const g = G[r.src] = G[r.src] || { n: 0, h: 0, s: 0 }; g.n++; if (r.o31 === 1) g.h++; else if (r.o31 === 2) g.s++; }
    const L = Object.keys(PUB_SRC).filter(k => G[k]);
    if (L.length) {
      const T = L.reduce((a, k) => ({ n: a.n + G[k].n, h: a.h + G[k].h, s: a.s + G[k].s }), { n: 0, h: 0, s: 0 });
      t += '\n\n📊 <b>Bugünün sinyal karnesi</b>\n<i>Pusula\'nın bugünkü bütün sinyalleri; +%3 hedefe mi yoksa −%1 stopa mı önce gitti?</i>\n<blockquote>' +
        L.map(k => PUB_SRC[k] + ': ' + G[k].n + ' sinyal · ' + G[k].h + ' hedef · ' + G[k].s + ' stop').join('\n') +
        '\nToplam: ' + T.n + ' sinyalin ' + T.h + '\'i hedefe, ' + T.s + '\'i stopa gitti' + (T.n - T.h - T.s > 0 ? ', ' + (T.n - T.h - T.s) + '\'i gün içinde ikisine de ulaşmadı' : '') + '.</blockquote>';
    }
  }
  return t + NOTE;
}
const meta = async (env, k) => { const r = await env.BT.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first(); return r ? r.v : null; };
const metaSet = (env, k, v) => env.BT.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind(k, v).run();
async function tgApi(tok, method, body) {
  try { return await (await fetch('https://api.telegram.org/bot' + tok + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) })).json(); }
  catch (e) { return { ok: false, description: String(e.message || e) }; }
}
export async function pubCh(env) { try { const v = await meta(env, 'pubch'); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
async function pubSend(env, h, ch, text, tag) {
  const cfg = await h.kvGet(env, 'cfg', null); if (!cfg || !cfg.tgTok) return { ok: false, description: 'token yok' };
  return tgApi(cfg.tgTok, 'sendMessage', { chat_id: ch.id, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: kanalKb(tag) });
}
// Telegram güncellemesi: bot bir kanalda yönetici oldu / çıkarıldı (tgbot.js çağırır)
export async function kanalSet(env, h, u) {
  const c = u && u.chat, nm = u && u.new_chat_member;
  if (!c || c.type !== 'channel' || !nm) return null;
  const old = await pubCh(env);
  if (nm.status === 'administrator' && nm.can_post_messages !== false) {
    const ch = { id: c.id, title: String(c.title || '').slice(0, 60), user: c.username || '', at: Date.now() };
    await metaSet(env, 'pubch', JSON.stringify(ch));
    if (!old || old.id !== ch.id) {
      const intro = '🧭 <b>BIST Pusula kanalına hoş geldin</b>\n\nHafta içi her gün:\n<blockquote>🌅 09:35 · Akşamdan beri gelen önemli KAP haberleri ve günün önemli verileri\n🌆 18:30 · Piyasa özeti ve Pusula\'nın günlük sinyal karnesi</blockquote>' +
        'Endeksin yönü, KAP haberleri ve hisse röntgeni için aşağıdaki düğmeyle Pusula\'yı aç. Ücretsizdir; fiyatlar 15 dakika gecikmelidir.' + NOTE;
      const r = await pubSend(env, h, ch, intro, 'giris');
      const cfg = await h.kvGet(env, 'cfg', null);
      if (r && r.ok && r.result && cfg && cfg.tgTok) await tgApi(cfg.tgTok, 'pinChatMessage', { chat_id: ch.id, message_id: r.result.message_id, disable_notification: true });
      await metaSet(env, 'pubch_res', new Date().toISOString() + ' ' + JSON.stringify(r).slice(0, 160));
    }
    return ch;
  }
  if ((nm.status === 'left' || nm.status === 'kicked' || nm.status === 'member') && old && old.id === c.id) await env.BT.prepare("DELETE FROM meta WHERE k = 'pubch'").run();
  return null;
}
export async function kanalAm(env, h, now = Date.now()) {
  const p = trp(now); if (p.wd < 1 || p.wd > 5 || p.m < 575 || p.m >= 600) return null;
  if (await meta(env, 'pub_am') === p.day) return null;
  const ch = await pubCh(env); if (!ch) return null;
  await metaSet(env, 'pub_am', p.day);   // önce işaretle: hata olursa her dakika denemesin
  const kaps = (await env.BT.prepare('SELECT t, syms, subj, summ, tip, yon, onem FROM kap INDEXED BY kap_t WHERE t >= ? AND onem >= 2 ORDER BY onem DESC, t DESC LIMIT 8').bind(prevEve(now)).all()).results || [];
  let ecal = []; try { ecal = JSON.parse(await meta(env, 'ecal') || '[]'); } catch (e) {}
  const r = await pubSend(env, h, ch, amText(now, kaps, ecal, h.esc), 'am');
  return { ok: !!(r && r.ok), err: r && !r.ok ? r.description : undefined };
}
export async function kanalPm(env, h, now = Date.now()) {
  const p = trp(now); if (p.wd < 1 || p.wd > 5 || p.m < 1110 || p.m >= 1260) return null;
  if (await meta(env, 'pub_pm') === p.day) return null;
  const ch = await pubCh(env); if (!ch) return null;
  let mkt = null; try { mkt = JSON.parse(await meta(env, 'mkt_close') || 'null'); } catch (e) {}
  if (!mkt || mkt.d !== p.day) { if (p.m < 1230) return null; mkt = null; }   // piyasa özeti 20:30'a kadar beklenir
  const sigDone = await meta(env, 'sigsum') === p.day;
  if (!sigDone && p.m < 1230) return null;   // karne ölçümü bitene kadar (en geç 20:30)
  if (!mkt && !sigDone) { await metaSet(env, 'pub_pm', p.day); return { ok: false, err: 'veri yok' }; }
  await metaSet(env, 'pub_pm', p.day);
  const rows = sigDone ? ((await env.BT.prepare('SELECT src, o31 FROM sig INDEXED BY sig_d WHERE d = ? AND done = 1 AND err IS NULL').bind(trDay(now)).all()).results || []) : [];
  const r = await pubSend(env, h, ch, pmText(now, mkt, rows, h.esc), 'pm');
  // abone sayısı (haftalık büyüme raporu için)
  try {
    const cfg = await h.kvGet(env, 'cfg', null), c = cfg && cfg.tgTok ? await tgApi(cfg.tgTok, 'getChatMemberCount', { chat_id: ch.id }) : null;
    if (c && c.ok) { let H = []; try { H = JSON.parse(await meta(env, 'pub_hist') || '[]'); } catch (e) {} H = H.filter(x => x.d !== p.day).concat([{ d: p.day, n: c.result }]).slice(-60); await metaSet(env, 'pub_hist', JSON.stringify(H)); }
  } catch (e) {}
  return { ok: !!(r && r.ok), err: r && !r.ok ? r.description : undefined };
}
