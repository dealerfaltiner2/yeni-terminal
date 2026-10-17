// v12.4 (17.10, Fatih: 'grubu büyütmek senin görevin') HERKESE AÇIK KANAL
// Fatih kanalı açıp botu YÖNETİCİ yapınca Telegram 'my_chat_member' gönderir → meta 'pubch' {id, title, user, at} (kanalSet).
// Kanala hafta içi iki bilgi mesajı (canlı AL/hedef/stop YOK — SPK riski; yalnız haber, takvim, piyasa özeti, geçmiş karne toplamı):
//   sabah 09:35–10:00 (kanalAm, meta 'pub_am' = gün): akşamdan beri önemli KAP (önem ≥2, en çok 8) + bugünün önemli verileri
//   akşam 18:30–21:00 (kanalPm, meta 'pub_pm' = gün): piyasa özeti (meta 'mkt_close') + günün sinyal karnesi toplamı (meta 'sigsum' bugünse; 20:30'dan sonra karnesiz)
// Her mesajda '🧭 Pusula'yı aç' düğmesi (startapp=k_am / k_pm → üye kaydında 'nereden geldi'). Abone sayısı akşam meta 'pub_hist'e (60 gün).
// Dakikalık işe ek yük: pencere dışında SIFIR okuma; pencerede dakikada 1 meta okuması (PK).
import { tgAppLink } from './tgapp.js';
import { KAP_AD } from './kap.js';
import { mktBlock, tgQuote } from './tgfmt.js';
import { trDay } from './sig.js';
const TRMS = 3 * 3600e3;
const trp = ms => { const d = new Date(ms + TRMS); return { wd: d.getUTCDay(), m: d.getUTCHours() * 60 + d.getUTCMinutes(), day: d.toISOString().slice(0, 10) }; };
// v12.9 (17.10, Fatih: 'botu sen tanıtacaksın'): kanal kullanıcı adı varsa ikinci satır '📣 Arkadaşına gönder' = t.me/share ile kanal bağlantısı (okuyan kişi kanalı yayar)
export const shareLink = (url, text) => 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
export const SHARE_TXT = 'BIST Pusula: önemli KAP haberleri, günlük piyasa özeti ve hisse röntgeni tek yerde. Tamamen ücretsiz.';
export const kanalKb = (tag, user) => {
  const kb = [[{ text: '🧭 Pusula\'yı aç', url: tgAppLink('k_' + tag) }]];
  if (/^[A-Za-z0-9_]{4,32}$/.test(user || '')) kb.push([{ text: '📣 Arkadaşına gönder', url: shareLink('https://t.me/' + user, SHARE_TXT) }]);
  return { inline_keyboard: kb };
};
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
// v12.6: kanal hangi botla yönetiliyorsa (ch.via: 'app' = yeni @BistPusulaBot, env.TG_APP_TOKEN; yoksa eski sinyal botu cfg.tgTok) onunla gönderilir
async function pubTok(env, h, ch) { if (ch && ch.via === 'app') return env.TG_APP_TOKEN || ''; const cfg = await h.kvGet(env, 'cfg', null); return (cfg && cfg.tgTok) || ''; }
async function pubSend(env, h, ch, text, tag) {
  const tok = await pubTok(env, h, ch); if (!tok) return { ok: false, description: 'token yok' };
  return tgApi(tok, 'sendMessage', { chat_id: ch.id, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: kanalKb(tag, ch.user) });
}
// Telegram güncellemesi: bot bir kanalda yönetici oldu / çıkarıldı (tgbot.js çağırır)
export async function kanalSet(env, h, u, via = 'old') {
  const c = u && u.chat, nm = u && u.new_chat_member;
  if (!c || c.type !== 'channel' || !nm) return null;
  const old = await pubCh(env);
  if (nm.status === 'administrator' && nm.can_post_messages !== false) {
    const ch = { id: c.id, title: String(c.title || '').slice(0, 60), user: c.username || '', at: Date.now(), via };
    await metaSet(env, 'pubch', JSON.stringify(ch));
    if (!old || old.id !== ch.id) {
      const intro = '🧭 <b>BIST Pusula kanalına hoş geldin</b>\n\nHafta içi her gün:\n<blockquote>🌅 09:35 · Akşamdan beri gelen önemli KAP haberleri ve günün önemli verileri\n🌆 18:30 · Piyasa özeti ve Pusula\'nın günlük sinyal karnesi</blockquote>' +
        'Endeksin yönü, KAP haberleri ve hisse röntgeni için aşağıdaki düğmeyle Pusula\'yı aç. Ücretsizdir; fiyatlar 15 dakika gecikmelidir.' + NOTE;
      const r = await pubSend(env, h, ch, intro, 'giris');
      const tok = await pubTok(env, h, ch);
      if (r && r.ok && r.result && tok) await tgApi(tok, 'pinChatMessage', { chat_id: ch.id, message_id: r.result.message_id, disable_notification: true });
      await metaSet(env, 'pubch_res', new Date().toISOString() + ' ' + JSON.stringify(r).slice(0, 160));
    }
    return ch;
  }
  // v12.6: yalnız kanalı YÖNETEN bot çıkarılınca kayıt silinir (eski botu çıkarmak yeni botun kaydını bozmaz)
  if ((nm.status === 'left' || nm.status === 'kicked' || nm.status === 'member') && old && old.id === c.id && (old.via || 'old') === via) await env.BT.prepare("DELETE FROM meta WHERE k = 'pubch'").run();
  return null;
}
// v12.4b: TEK SEFERLİK KANAL PAYLAŞIMI — meta 'pub_once' = {"t": HTML metin, "tag": düğme etiketi} → kanala düğmeli gönderilir, başarıda silinir (sonuç 'pub_once_res').
export async function kanalOnce(env, h) {
  const v = await meta(env, 'pub_once'); if (!v) return null;
  const ch = await pubCh(env); if (!ch) return null;
  let o = null; try { o = JSON.parse(v); } catch (e) { o = { t: v }; }
  const tag = /^[a-z0-9]{1,16}$/.test(o.tag || '') ? o.tag : 'ozel';
  const r = await pubSend(env, h, ch, String(o.t || ''), tag);
  await metaSet(env, 'pub_once_res', new Date().toISOString() + ' ' + JSON.stringify(r).slice(0, 160));
  if (r && r.ok) await env.BT.prepare("DELETE FROM meta WHERE k = 'pub_once'").run();
  return { ok: !!(r && r.ok) };
}
// v12.5 (17.10, Fatih onayıyla) SEANS İÇİ ÖNEMLİ KAP — BIST 100 şirketinden önem 3 haber anında kanala; günde en çok 3 (meta 'pub_kap' {d, n}), çalışma başına 1.
// Yalnız haber (AL/hedef/stop YOK). Aday listesini kap.js kapPoll döndürür (pub).
export function kapPubText(r, esc) {
  const yon = r.yon > 0 ? '🟢 Olumlu' : r.yon < 0 ? '🔴 Olumsuz' : '⚪ Yönü belirsiz';
  const s0 = String(r.syms || '').split(',')[0], q = r.q;
  const sm = r.summ && r.summ !== r.subj ? String(r.summ).slice(0, 240) : '';
  const px = q && q.close ? '\nHisse şu an ' + Number(q.close).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL, bugün ' + (q.change >= 0 ? '+' : '−') + '%' + Math.abs(q.change).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + '.' : '';
  return '📰 <b>Son dakika KAP · ' + esc(s0) + '</b>   <i>' + hm(r.t) + '</i>\n' + yon + ' · ' + esc(KAP_AD[r.tip] || r.tip || 'bildirim') +
    '\n<blockquote>' + esc(String(r.subj || '').slice(0, 140)) + (sm ? '\n' + esc(sm) : '') + '</blockquote>' + px + NOTE;
}
export async function kanalKap(env, h, pub, now = Date.now()) {
  if (!pub || !pub.length) return null;
  const ch = await pubCh(env); if (!ch) return null;
  const day = trp(now).day;
  let c = { d: day, n: 0 }; try { const v = JSON.parse(await meta(env, 'pub_kap') || 'null'); if (v && v.d === day) c = v; } catch (e) {}
  if (c.n >= 3) return { n: 0, sinir: 1 };
  const r0 = pub.slice().sort((a, b) => (b.yon !== 0) - (a.yon !== 0) || a.t - b.t)[0];   // yönlü haber önce
  c.n++; await metaSet(env, 'pub_kap', JSON.stringify(c));
  const r = await pubSend(env, h, ch, kapPubText(r0, h.esc), 'kap');
  return { n: r && r.ok ? 1 : 0 };
}
// v12.5 PAZAR AKŞAMI 'HAFTAYA BAKIŞ' (19:55–21:00, meta 'pub_wk' = gün): BIST 100 haftalık (günlük mumlar), haftanın önem 3 KAP'ları (en çok 6), gelecek haftanın önemli verileri.
export function weekText(now, ix, kaps, ecal, esc) {
  const f2 = v => Math.abs(v).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const d0 = trp(now + 864e5).day, d4 = trp(now + 5 * 864e5).day;   // Pazartesi … Cuma
  const tr = ms => { const d = new Date(ms + TRMS); return d.getUTCDate() + ' ' + AY[d.getUTCMonth()]; };
  let t = '🧭 <b>Haftaya bakış · ' + tr(now + 864e5) + ' – ' + tr(now + 5 * 864e5) + '</b>';
  if (ix && ix.c > 0 && ix.p > 0) {
    const w = (ix.c / ix.p - 1) * 100;
    t += '\n\n' + (w >= 0 ? '📈' : '📉') + ' <b>Geçen hafta</b>\n<blockquote>BIST 100 haftayı ' + Math.round(ix.c).toLocaleString('tr-TR') + ' puanda, <b>%' + f2(w) + (w >= 0 ? ' yükselişle' : ' düşüşle') + '</b> kapattı.' +
      (ix.fri != null ? ' Cuma günü ' + (ix.fri >= 0 ? '%' + f2(ix.fri) + ' yükseldi' : '%' + f2(ix.fri) + ' düştü') + (ix.nu + ix.nd ? '; ' + ix.nu + ' hisse yükselirken ' + ix.nd + ' hisse düştü' : '') + '.' : '') + '</blockquote>';
  }
  if (kaps.length) t += '\n\n📰 <b>Haftanın öne çıkan KAP haberleri</b>\n<blockquote>' + kaps.map(r => (r.yon > 0 ? '🟢 ' : r.yon < 0 ? '🔴 ' : '⚪ ') + '<b>' + esc(String(r.syms || '').split(',')[0]) + '</b> · ' + esc(String(r.subj || '').slice(0, 80))).join('\n') + '</blockquote>';
  const ev = (ecal || []).filter(e => ecImp(e) && trp(e.t).day >= d0 && trp(e.t).day <= d4).slice(0, 8);
  if (ev.length) t += '\n\n🗓 <b>Bu hafta takvimde</b>\n<blockquote>' + ev.map(e => GUN[new Date(e.t + TRMS).getUTCDay()] + ' ' + hm(e.t) + ' · ' + (e.c === 'TR' ? '🇹🇷' : e.c === 'US' ? '🇺🇸' : esc(e.c)) + ' ' + esc(ecTitle(e)) +
    (e.p != null ? ' (önceki ' + e.p + (e.u === '%' ? '%' : '') + ')' : '')).join('\n') + '</blockquote>';
  return t + '\n\nHafta içi her sabah 09:35\'te önemli KAP haberleri, her akşam 18:30\'da piyasa özeti bu kanalda.' + NOTE;
}
export async function kanalWeek(env, h, now = Date.now()) {
  const p = trp(now); if (p.wd !== 0 || p.m < 1195 || p.m >= 1260) return null;
  if (await meta(env, 'pub_wk') === p.day) return null;
  const ch = await pubCh(env); if (!ch) return null;
  await metaSet(env, 'pub_wk', p.day);
  let ix = null;
  try {   // günlük mumlar: son kapanış ve bir önceki haftanın son kapanışı
    const got = await h.fetchBarsTV(env, ['BIST:XU100'], '1D', 12, 8000), st = got && got['BIST:XU100'];
    const B = st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
    const days = B.map(b => ({ d: trp(b[0] * 1000).day, c: b[4] })).filter(b => b.c > 0);
    const lastWeekStart = trp(now - 6 * 864e5).day;   // geçen Pazartesi
    const cur = days.filter(b => b.d >= lastWeekStart), prev = days.filter(b => b.d < lastWeekStart);
    if (cur.length && prev.length) ix = { c: cur[cur.length - 1].c, p: prev[prev.length - 1].c };
  } catch (e) {}
  try { const m = JSON.parse(await meta(env, 'mkt_close') || 'null'), x = m && (m.idx || []).find(i => i.s === 'XU100'); if (ix && x && trp(now - 2 * 864e5).day === m.d) Object.assign(ix, { fri: x.ch, nu: m.nu || 0, nd: m.nd || 0 }); } catch (e) {}
  const kaps = (await env.BT.prepare("SELECT t, syms, subj, tip, yon FROM kap INDEXED BY kap_t WHERE t >= ? AND onem >= 3 AND tip IN ('is', 'ihale', 'bedelsiz', 'temettu', 'birlesme', 'teklif', 'risk', 'ceza') ORDER BY t DESC LIMIT 6").bind(now - 6 * 864e5).all()).results || [];
  let ecal = []; try { ecal = JSON.parse(await meta(env, 'ecal') || '[]'); } catch (e) {}
  const r = await pubSend(env, h, ch, weekText(now, ix, kaps, ecal, h.esc), 'hafta');
  return { ok: !!(r && r.ok), err: r && !r.ok ? r.description : undefined };
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
    const tok = await pubTok(env, h, ch), c = tok ? await tgApi(tok, 'getChatMemberCount', { chat_id: ch.id }) : null;
    if (c && c.ok) { let H = []; try { H = JSON.parse(await meta(env, 'pub_hist') || '[]'); } catch (e) {} H = H.filter(x => x.d !== p.day).concat([{ d: p.day, n: c.result }]).slice(-60); await metaSet(env, 'pub_hist', JSON.stringify(H)); }
  } catch (e) {}
  return { ok: !!(r && r.ok), err: r && !r.ok ? r.description : undefined };
}
// v12.10 (18.10, Fatih: 'bağlantıları sen ekle') ADLI DAVET BAĞLANTILARI — her paylaşım yeri için ayrı kanal bağlantısı, kim nereden katıldı sayılır.
// İstek: meta 'pub_links_req' = JSON ["Borsacılar Cemiyeti", "Instagram", …] → kanalı yöneten bot createChatInviteLink (ad ≤32) → meta 'pub_links' {ad: url}; istek silinir, sonuç 'pub_links_res'.
// Katılım sayımı: webhook 'chat_member' (yalnız kayıtlı kanal) → meta 'pub_join' {ad: sayı}; davet bağlantısı yoksa 'Doğrudan / kanal adı'.
export async function kanalLinks(env, h) {
  const v = await meta(env, 'pub_links_req'); if (!v) return null;
  const ch = await pubCh(env); if (!ch) return null;
  await env.BT.prepare("DELETE FROM meta WHERE k = 'pub_links_req'").run();   // önce sil: hata olsa da her dakika denemesin
  let names = []; try { names = JSON.parse(v); } catch (e) {}
  names = (Array.isArray(names) ? names : []).map(x => String(x || '').trim().slice(0, 32)).filter(Boolean).slice(0, 10);
  const tok = await pubTok(env, h, ch); if (!tok || !names.length) { await metaSet(env, 'pub_links_res', new Date().toISOString() + ' ' + (tok ? 'ad yok' : 'token yok')); return { ok: false }; }
  let L = {}; try { L = JSON.parse(await meta(env, 'pub_links') || '{}') || {}; } catch (e) {}
  const res = [];
  for (const n of names) {
    if (L[n]) { res.push(n + ': zaten var'); continue; }
    const r = await tgApi(tok, 'createChatInviteLink', { chat_id: ch.id, name: n });
    if (r && r.ok && r.result && r.result.invite_link) { L[n] = r.result.invite_link; res.push(n + ': tamam'); }
    else res.push(n + ': ' + String(r && r.description || 'hata').slice(0, 80));
  }
  await metaSet(env, 'pub_links', JSON.stringify(L));
  await metaSet(env, 'pub_links_res', new Date().toISOString() + ' ' + res.join(' | '));
  return { ok: true, res };
}
export async function kanalJoin(env, cm) {
  if (!cm || !cm.chat || !cm.new_chat_member) return null;
  const ch = await pubCh(env); if (!ch || ch.id !== cm.chat.id) return null;
  const was = cm.old_chat_member && cm.old_chat_member.status, now = cm.new_chat_member.status;
  if (now !== 'member' || (was && was !== 'left' && was !== 'kicked')) return null;
  const n = String((cm.invite_link && (cm.invite_link.name || 'Adsız bağlantı')) || 'Doğrudan / kanal adı').slice(0, 32);
  let J = {}; try { J = JSON.parse(await meta(env, 'pub_join') || '{}') || {}; } catch (e) {}
  J[n] = (J[n] || 0) + 1;
  await metaSet(env, 'pub_join', JSON.stringify(J));
  return n;
}
