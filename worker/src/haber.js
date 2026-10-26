// v14.19 (26.10, Fatih onayıyla: 'haber merkezini kur — hiçbir önemli haberi kaçırmayalım, Algı'nın işleyişi değişmesin')
// HABER MERKEZİ — borsayı ilgilendiren resmî ve hızlı kaynaklar tek yerde:
//   • TCMB basın duyuruları + PPK kararları (resmî RSS)        → kural ile önem (faiz kararı = 3)
//   • Anadolu Ajansı ekonomi (RSS)                               → anahtar kelime süzgeci + Workers AI (önem, yön, ilgili BIST 100 hissesi, tek cümle)
//   • SPK haftalık bülteni + Borsa İstanbul duyuruları (KAP'tan; kap.js 'hab' satırları)
// D1 tablo 'haber' (haber_t indeksi). Telegram: yalnız önem 3, TAZE (≤30 dk), 07:00–23:30, günde en çok HABER_TG_MAX (meta 'haber_tg').
// AL/SAT, hedef/stop YOK — bilgi mesajı. Algı'ya yalnız NOT olarak girer (terminal haberNote); Algı kuralı DEĞİŞMEZ.
// Çalışma: karne zamanlayıcısı ('1-59/2', tek dakikalar) — her 2 dk. Okuma: meta 'haber_seen' (1 satır), yazma yalnız yeni haberde.
import { AI_MODEL, aiText } from './aiyorum.js';
import { kaphText } from './kaph.js';
const TRMS = 3 * 3600e3;
export const HABER_TG_MAX = 8;
export const FEEDS = [
  { k: 'ppk', url: 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Bottom+Menu/Diger/RSS/PPK+Kararlari' },
  { k: 'tcmb', url: 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Bottom+Menu/Diger/RSS/Basin+Duyurulari' },
  { k: 'aa', url: 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi' },
];
export const SRC_AD = { ppk: 'TCMB · faiz kararı', tcmb: 'TCMB', aa: 'Anadolu Ajansı', spk: 'SPK', bist: 'Borsa İstanbul', kap: 'KAP' };
const DET_URL = 'https://www.kap.org.tr/tr/api/notification/attachment-detail/';
const trParts = ms => { const d = new Date(ms + TRMS); return { wd: d.getUTCDay(), m: d.getUTCHours() * 60 + d.getUTCMinutes(), day: d.toISOString().slice(0, 10) }; };

/* ---------- RSS okuma (saf) ---------- */
const decEnt = s => String(s || '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const strip = s => decEnt(String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export function rssItems(xml) {
  const out = [], re = /<(item|entry)\b[\s\S]*?<\/\1>/gi; let m;
  const tag = (s, n) => { const r = new RegExp('<' + n + '\\b[^>]*>([\\s\\S]*?)</' + n + '>', 'i').exec(s); return r ? r[1] : ''; };
  while ((m = re.exec(String(xml || ''))) && out.length < 60) {
    const s = m[0];
    let link = strip(tag(s, 'link'));
    if (!link) { const h = /<link\b[^>]*href="([^"]+)"/i.exec(s); if (h) link = decEnt(h[1]); }
    const it = { title: strip(tag(s, 'title')).slice(0, 300), link: link.slice(0, 400), guid: strip(tag(s, 'guid')).slice(0, 400),
      date: strip(tag(s, 'pubDate') || tag(s, 'dc:date') || tag(s, 'published') || tag(s, 'updated')), desc: strip(tag(s, 'description') || tag(s, 'summary')).slice(0, 600) };
    if (it.title) out.push(it);
  }
  return out;
}
const AY = { oca: 0, şub: 1, sub: 1, mar: 2, nis: 3, may: 4, haz: 5, tem: 6, ağu: 7, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11 };
// RSS tarihi → ms. Saat dilimi yazmıyorsa TR saati sayılır. Türkçe ay kısaltmaları da okunur.
export function rssTime(s) {
  s = String(s || '').trim(); if (!s) return null;
  const tr = /(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]{3})[A-Za-zÇĞİÖŞÜçğıöşü]*\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (tr) { const k = tr[2].toLocaleLowerCase('tr'); if (k in AY && !/[+-]\d{4}|GMT|UTC|\bZ\b/.test(s)) return Date.UTC(+tr[3], AY[k], +tr[1], +tr[4], +tr[5], +(tr[6] || 0)) - TRMS; }
  const t = Date.parse(s);
  if (isNaN(t)) return null;
  return /[+-]\d{2}:?\d{2}\b|GMT|UTC|UT\b|Z$/.test(s) ? t : t - TRMS;
}
const hash = s => { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
export const itemId = (src, it) => src + ':' + hash(it.guid || it.link || it.title);

/* ---------- sınıflandırma ---------- */
// TCMB: kural (başlık)
export function tcmbClass(src, title) {
  const t = String(title || '').toLocaleLowerCase('tr');
  if (src === 'ppk' || /faiz oranlarına ilişkin|para politikası kurulu|ppk/.test(t)) return /özet/.test(t) ? 2 : 3;
  if (/zorunlu karşılık|makroihtiyati|likidite|enflasyon raporu|rezerv|kur|döviz|munzam/.test(t)) return 2;
  return 1;
}
// Anadolu Ajansı: borsayla ilgili olabilecekler (süzgeç). Süzgeçten geçmeyen kaydedilmez.
export const AA_KW = /borsa|bist|hisse|faiz|merkez bankası|tcmb|enflasyon|dolar|döviz|\bkur\b|euro|altın|petrol|brent|doğal ?gaz|vergi|kdv|ötv|harç|asgari ücret|bütçe|cari açık|büyüme|ihracat|ithalat|spk|halka arz|temettü|bedelsiz|kredi notu|moody|fitch|s&p|\bfed\b|ecb|savaş|ateşkes|saldırı|deprem|seçim|yaptırım|gümrük|tarife|zam|holding|bankası|sözleşme|ihale|satın al|sipariş|anlaşma|yatırım|fabrika|üretim|birleşme|konkordato|iflas|kripto|tahvil|hazine|eurobond|cds|swap|rezerv|işsizlik|sanayi üretimi|imf|dünya bankası|opec/i;
export const HAB_SYS = 'Sen Borsa İstanbul için çalışan dikkatli bir haber editörüsün. Sana bir haberin başlığı ve kısa özeti verilecek. ' +
  'YALNIZ şu biçimde JSON döndür, başka hiçbir şey yazma: {"onem":0,"yon":0,"hisse":[],"not":""}. ' +
  'onem: 3 = bütün borsayı ya da büyük bir şirketi hemen etkileyebilecek haber (faiz kararı, vergi/harç değişikliği, savaş/ateşkes, büyük yaptırım, kredi notu, büyük şirketin çok önemli anlaşması); ' +
  '2 = bir sektörü ya da belirli bir şirketi etkileyebilir; 1 = genel ekonomi bilgisi; 0 = borsayla ilgisiz. Emin değilsen düşük ver. ' +
  'yon: borsa ya da ilgili hisse için olumlu 1, olumsuz -1, belirsiz 0. ' +
  'hisse: haberde ADI AÇIKÇA GEÇEN Borsa İstanbul şirketlerinin işlem kodları (ör. THYAO, ASELS); emin değilsen boş liste. ' +
  'not: haberin borsa için ne anlama geldiğini anlatan tek kısa Türkçe cümle; haberde olmayan rakam yazma, al/sat tavsiyesi ve fiyat tahmini verme.';
const numsIn = s => (String(s).match(/\d+(?:[.,]\d+)*/g) || []);
// Yapay zekâ yanıtını doğrula: önem/yön aralıkta, hisse kodu bilinen listede, cümledeki her rakam haberde geçiyor
export function habParse(txt, src, known) {
  const m = /\{[\s\S]*\}/.exec(String(txt || '')); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch (e) { return null; }
  const onem = Math.max(0, Math.min(3, Math.round(+j.onem || 0))), yon = Math.max(-1, Math.min(1, Math.round(+j.yon || 0)));
  const hisse = (Array.isArray(j.hisse) ? j.hisse : []).map(x => String(x).toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(x => known.has(x)).slice(0, 3);
  let not = String(j.not || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  if (not && numsIn(not).some(n => !String(src).includes(n))) not = '';
  if (/\b(al|sat)\b.{0,12}(öner|tavsiye)|hedef fiyat/i.test(not)) not = '';
  return { onem, yon, hisse, not };
}
async function habAI(env, it, known) {
  if (!env.AI || typeof env.AI.run !== 'function') return null;
  const src = it.title + ' — ' + it.desc;
  const r = await env.AI.run(AI_MODEL, { messages: [{ role: 'system', content: HAB_SYS }, { role: 'user', content: 'Başlık: ' + it.title + '\nÖzet: ' + (it.desc || '-') }],
    max_tokens: 220, temperature: 0.1, chat_template_kwargs: { enable_thinking: false } });
  return habParse(aiText(r), src, known);
}

/* ---------- Telegram ---------- */
export function habMsg(r, esc) {
  const hm = new Date(r.t + TRMS).toISOString().slice(11, 16);
  const yon = r.yon > 0 ? '🟢 olumlu' : r.yon < 0 ? '🔴 olumsuz' : '⚪ yönü belirsiz';
  const syms = String(r.syms || '').split(',').filter(Boolean);
  return '📰 <b>HABER · ' + esc(SRC_AD[r.src] || r.src) + '</b>   <i>' + yon + '</i>\n<blockquote><b>' + esc(r.title) + '</b>' + (r.txt ? '\n' + esc(r.txt) : '') + '</blockquote>' +
    (syms.length ? 'İlgili hisse: <b>' + esc(syms.join(', ')) + '</b>\n' : 'Genel piyasa haberi\n') + 'saat ' + hm + ' · bilgi amaçlıdır, al/sat önerisi değildir';
}
const habKb = r => r.url && /^https:\/\//.test(r.url) ? { inline_keyboard: [[{ text: '🔗 Haberi aç', url: r.url }]] } : null;
// Telegram'a gider mi? (saf) — önem 3, taze, pencere içinde, günlük sınır altında
export function habWantTg(r, now, cnt) {
  if (!(r.onem >= 3) || r.first) return false;
  if (now - r.t > 30 * 60e3 || r.t - now > 10 * 60e3) return false;
  const p = trParts(now); if (p.m < 420 || p.m >= 1410) return false;
  return cnt < HABER_TG_MAX;
}

/* ---------- D1 ---------- */
let ready = false;
export async function habEnsure(env) {
  if (ready) return;
  await env.BT.batch([
    env.BT.prepare('CREATE TABLE IF NOT EXISTS haber (id TEXT PRIMARY KEY, t INTEGER, src TEXT, title TEXT, txt TEXT, syms TEXT, yon INTEGER, onem INTEGER, url TEXT, sent INTEGER DEFAULT 0)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS haber_t ON haber(t)')
  ]);
  ready = true;
}
const metaGet = async (env, k) => { try { const r = await env.BT.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; } catch (e) { return null; } };
const metaSet = (env, k, v) => env.BT.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind(k, JSON.stringify(v)).run();
async function knownSyms(env) {
  const L = await metaGet(env, 'idx_list');
  return new Set([...((L && L.x100) || []), ...((L && L.x30) || [])].map(x => String(x).toUpperCase()));
}
// satırları ekle + gerekenleri Telegram'a gönder (yalnız GERÇEKTEN yeni eklenenler)
async function habSave(env, h, rows, now) {
  if (!rows.length) return { yeni: 0, tg: 0 };
  await habEnsure(env);
  const ins = env.BT.prepare('INSERT OR IGNORE INTO haber (id,t,src,title,txt,syms,yon,onem,url,sent) VALUES (?,?,?,?,?,?,?,?,?,?)');
  let tgc = await metaGet(env, 'haber_tg'); const day = trParts(now).day; if (!tgc || tgc.d !== day) tgc = { d: day, n: 0 };
  let cfg = null, sent = 0, yeni = 0;
  const res = await env.BT.batch(rows.map(r => ins.bind(r.id, r.t, r.src, r.title, r.txt || '', r.syms || '', r.yon || 0, r.onem || 0, r.url || '', 2)));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; if (!(res[i] && res[i].meta && res[i].meta.changes)) continue; yeni++;
    if (!habWantTg(r, now, tgc.n)) continue;
    if (!cfg) { cfg = await h.kvGet(env, 'cfg', null); }
    if (!cfg || (cfg.opt && cfg.opt.haber === 0)) break;
    const t = await h.tgSend(cfg, habMsg(r, h.esc), habKb(r));
    if (t && t.ok) { sent++; tgc.n++; try { await env.BT.prepare('UPDATE haber SET sent = 1 WHERE id = ?').bind(r.id).run(); } catch (e) {} }
  }
  if (sent) await metaSet(env, 'haber_tg', tgc);
  return { yeni, tg: sent };
}

/* ---------- RSS kaynakları (her 2 dk) ---------- */
export async function haberPoll(env, h, now = Date.now(), fetchFn = fetch) {
  if (!env.BT) return null;
  const seen0 = await metaGet(env, 'haber_seen') || {}, ST = Object.assign({}, seen0), err = {};
  let changed = false; const cand = [];
  for (const F of FEEDS) {
    let xml;
    try {
      const r = await fetchFn(F.url, { headers: { 'User-Agent': h.UA || 'Mozilla/5.0', Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      xml = await r.text();
    } catch (e) { err[F.k] = String(e && e.message || e).slice(0, 80); continue; }
    const items = rssItems(xml);
    if (!items.length) { err[F.k] = 'boş yanıt'; continue; }
    const first = !Array.isArray(ST[F.k]), seen = new Set(ST[F.k] || []);
    const fresh = items.filter(it => !seen.has(itemId(F.k, it)));
    if (first || fresh.length) { ST[F.k] = [...new Set([...items.map(it => itemId(F.k, it)), ...(ST[F.k] || [])])].slice(0, 150); changed = true; }
    for (const it of fresh.slice(0, 15)) {
      const t = rssTime(it.date) || now;
      if (now - t > 3 * 86400e3) continue;
      cand.push({ src: F.k, it, t: Math.min(t, now), first });
    }
  }
  // sınıflandır
  const rows = []; let known = null, ai = 0;
  for (const c of cand) {
    const base = { id: itemId(c.src, c.it), t: c.t, src: c.src, title: c.it.title, txt: '', syms: '', yon: 0, onem: 1, url: c.it.link || '', first: c.first };
    if (c.src === 'ppk' || c.src === 'tcmb') { base.onem = tcmbClass(c.src, c.it.title); rows.push(base); continue; }
    if (!AA_KW.test(c.it.title + ' ' + c.it.desc)) continue;
    base.txt = c.it.desc.slice(0, 300);
    if (!c.first && ai < 3 && now - c.t <= 6 * 3600e3) {
      ai++;
      try { if (!known) known = await knownSyms(env); const a = await habAI(env, c.it, known);
        if (a) { if (a.onem === 0) continue; Object.assign(base, { onem: a.onem, yon: a.yon, syms: a.hisse.join(','), txt: a.not || base.txt }); } } catch (e) { err.ai = String(e && e.message || e).slice(0, 80); }
    }
    rows.push(base);
  }
  const sv = await habSave(env, h, rows, now);
  if (changed) await metaSet(env, 'haber_seen', ST);
  await metaSet(env, 'haber_st', { at: now, aday: cand.length, yeni: sv.yeni, tg: sv.tg, ai, err });
  return { aday: cand.length, ...sv, err };
}

/* ---------- KAP'tan gelen resmî duyurular (SPK bülteni, Borsa İstanbul) ---------- */
export const isSpkBulten = r => /SERMAYE PİYASASI KURULU|SERMAYE PIYASASI KURULU/i.test(r.title || '') && /bülten/i.test(r.subj || '');
export const isBistDuyuru = r => /^BORSA İSTANBUL A\.Ş|^BORSA ISTANBUL A\.S/i.test(String(r.title || '').trim());
export const HAB_SPK_SYS = 'Sen Borsa İstanbul yatırımcıları için SPK bültenlerini özetleyen dikkatli bir editörsün. Sana bültenin düz metni verilecek. ' +
  'Borsa yatırımcısı için EN ÖNEMLİ en çok 3 maddeyi (işlem yasakları, tedbirler, onaylanan sermaye artırımları ve halka arzlar) her biri tek kısa Türkçe cümle olacak şekilde, başında "• " ile yaz. ' +
  'Yalnız metinde geçen şirket adlarını ve rakamları kullan; metinde olmayan hiçbir şey ekleme; al/sat tavsiyesi verme.';
async function spkSummary(env, h, idx, fetchFn) {
  let txt = '';
  try { const r = await fetchFn(DET_URL + idx, { headers: { Accept: 'application/json', Referer: 'https://www.kap.org.tr/tr/bildirim-sorgu', Origin: 'https://www.kap.org.tr', 'User-Agent': h.UA || 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (r.ok) txt = kaphText(await r.text()); } catch (e) {}
  if (txt.length < 200 || !env.AI || typeof env.AI.run !== 'function') return '';
  try {
    const r = await env.AI.run(AI_MODEL, { messages: [{ role: 'system', content: HAB_SPK_SYS }, { role: 'user', content: txt.slice(0, 9000) }], max_tokens: 300, temperature: 0.1, chat_template_kwargs: { enable_thinking: false } });
    return spkClean(aiText(r), txt);
  } catch (e) { return ''; }
}
// madde madde; rakamı metinde olmayan madde atılır (saf)
export function spkClean(out, src) {
  return String(out || '').replace(/<think>[\s\S]*?<\/think>/g, '').split('\n').map(x => x.replace(/^\s*[-*•]\s*/, '').trim()).filter(x => x.length >= 15 && x.length <= 260)
    .filter(x => numsIn(x).every(n => String(src).includes(n))).slice(0, 3).map(x => '• ' + x).join('\n');
}
export async function haberFromKap(env, h, kaps, now = Date.now(), fetchFn = fetch) {
  if (!env.BT || !kaps || !kaps.length) return null;
  const rows = [];
  for (const k of kaps.slice(0, 6)) {
    const url = 'https://www.kap.org.tr/tr/Bildirim/' + k.idx;
    if (isSpkBulten(k)) {
      const sum = now - k.t <= 30 * 60e3 ? await spkSummary(env, h, k.idx, fetchFn) : '';
      rows.push({ id: 'spk:' + k.idx, t: k.t, src: 'spk', title: 'SPK haftalık bülteni yayımlandı', txt: sum || 'İşlem yasakları, tedbirler, sermaye artırımı ve halka arz onayları bu bültende. Ayrıntı için bülteni aç.', syms: '', yon: 0, onem: 3, url });
    } else if (isBistDuyuru(k)) {
      const subj = String(k.subj || 'Borsa İstanbul duyurusu').slice(0, 200), sm = k.summ && k.summ !== k.subj ? String(k.summ).slice(0, 300) : '';
      rows.push({ id: 'bist:' + k.idx, t: k.t, src: 'bist', title: subj, txt: sm, syms: k.syms || '', yon: 0, onem: k.syms ? 2 : 1, url });
    }
  }
  return habSave(env, h, rows, now);
}

/* ---------- /haber (terminal) ---------- */
// Haber Merkezi akışı: haber tablosu + KAP'taki önemli şirket haberleri (önem ≥ 2; devre kesici ve içeriden alım-satım hariç). Üyeye boş.
let HC = { at: 0, v: null };
export async function haberRoute(env, json, anon) {
  if (anon) return json({ ok: true, list: [] });
  if (!env.BT) return json({ ok: false, error: 'D1 yok' }, 500);
  if (HC.v && Date.now() - HC.at < 30e3) return json(HC.v);
  await habEnsure(env);
  const lo = Date.now() - 3 * 86400e3;
  const hs = (await env.BT.prepare('SELECT id,t,src,title,txt,syms,yon,onem,url FROM haber INDEXED BY haber_t WHERE t >= ? AND onem >= 1 ORDER BY t DESC LIMIT 80').bind(lo).all()).results || [];
  let ks = [];
  try { ks = (await env.BT.prepare("SELECT idx,t,syms,title,subj,summ,tip,yon,onem FROM kap INDEXED BY kap_t WHERE t >= ? AND onem >= 2 AND tip NOT IN ('devre','icerden') ORDER BY t DESC LIMIT 80").bind(lo).all()).results || []; } catch (e) {}
  const list = hs.map(r => ({ id: r.id, t: r.t, src: r.src, ad: SRC_AD[r.src] || r.src, title: r.title, txt: r.txt, syms: r.syms, yon: r.yon, onem: r.onem, url: r.url }))
    .concat(ks.filter(k => k.syms && !isBistDuyuru(k)).map(k => ({ id: 'kap:' + k.idx, t: k.t, src: 'kap', ad: 'KAP', tip: k.tip, title: k.subj, txt: k.summ && k.summ !== k.subj ? String(k.summ).slice(0, 300) : '', syms: k.syms, yon: k.yon, onem: k.onem, url: 'https://www.kap.org.tr/tr/Bildirim/' + k.idx })))
    .sort((a, b) => b.t - a.t).slice(0, 120);
  const st = await metaGet(env, 'haber_st');
  HC = { at: Date.now(), v: { ok: true, at: Date.now(), list, st: st ? { at: st.at, err: st.err } : null } };
  return json(HC.v);
}
