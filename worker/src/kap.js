import { tgKb, tgPct } from './tgfmt.js';
// v5.8 KAP HABER — KAP'ın kendi JSON API'si (tek istekte günün TÜM bildirimleri), dakikada bir.
// Her bildirim: sınıflandır (tür, yön, önem) → D1 'kap' tablosu → önemliyse Telegram → Sinyal Karnesi'ne (src 'kap-<tür>')
// yazılır; seans sonrası tepkisi ölçülür. Gece gelen önemliler 09:30'da tek mesajda özetlenir.
import { sigAdd, trDay } from './sig.js';
import { tedbirAdd } from './tedbir.js';
const TRMS = 3 * 3600e3;
const KAP_URL = 'https://www.kap.org.tr/tr/api/disclosure/members/byCriteria';
const trParts = ms => { const d = new Date(ms + TRMS); return { wd: d.getUTCDay(), m: d.getUTCHours() * 60 + d.getUTCMinutes(), day: d.toISOString().slice(0, 10) }; };
// KAP tarihi "29.09.2026 09:08:44" (TR saati) → ms
export function kapTime(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):?(\d{2})?/.exec(String(s || ''));
  if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)) - TRMS;
}
// Sınıflandırma — sıra önemli (ilk eşleşen kazanır). yon: 1 olumlu, -1 olumsuz, 0 belirsiz; onem: 0 yok say … 3 çok önemli
const RULES = [
  ['yok', 0, 0, /sorumluluk beyan|faaliyet rapor|genel kurul|borçlanma arac|kupon ödeme|itfa|esas sözleşme|kurumsal yönetim|sürdürülebilirlik|komite|bağımsız denetim|genel bilgi formu|ihraç belgesi|varlık kiralama|yatırım fonu|portföy dağılım|izahname|fiyat istikrar/],
  ['risk', -1, 3, /konkordato|iflas|haciz|işlem yasağı|suç duyurusu|tedbir karar/],
  ['kisit', -1, 2, /brüt takas|tek fiyat|kredili işlem.{0,20}(kapsam dışı|yasak)|açığa satış.{0,20}yasak|işlem sırası.{0,20}(durdur|kapat)/],
  ['ceza', -1, 2, /idari para cezası|\bceza\b|cezası|\bdava\b|davası|soruşturma|vergi inceleme/],
  ['devre', 0, 1, /devre kesici/],
  ['bedelsiz', 1, 3, /bedelsiz/],
  ['bedelli', -1, 2, /bedelli/],
  ['tahsisli', 0, 2, /tahsisli|sermaye artırım/],
  ['teklif', 1, 3, /pay satın alma teklifi|zorunlu pay alım|çağrı yoluyla/],
  ['birlesme', 0, 2, /birleşme|devralma|bölünme|hisse devri|pay devri|kontrol değişikliği|ortaklık yapısı/],
  ['geri', 1, 2, /geri alım/],
  ['is', 1, 3, /yeni iş ilişkisi|iş ilişkisi|sözleşme imza|sözleşmesi imza|sipariş|ihale(yi|sini)?.{0,15}kazan|ihalesini aldı|anlaşma imza|ihracat anlaşma/],
  ['ihale', 0, 2, /ihale/],
  ['tesvik', 1, 2, /teşvik/],
  ['temettu', 1, 1, /kar payı|kâr payı|temettü/],
  ['bilanco', 0, 2, /finansal rapor|finansal tablo|bilanço/],
  ['not', 0, 1, /derecelendirme/],
  ['icerden', 0, 1, /pay alım satım bildirimi/],
  ['yatirim', 1, 1, /yatırım|kapasite artır|tesis|üretime başla|lisans/],
  ['varlik', 0, 1, /maddi duran varlık|gayrimenkul|arsa|taşınmaz|iştirak/],
];
export const KAP_AD = { risk: 'risk (konkordato/haciz/tedbir)', kisit: 'işlem kısıtı', ceza: 'ceza/dava', devre: 'devre kesici', bedelsiz: 'bedelsiz', bedelli: 'bedelli sermaye art.', tahsisli: 'tahsisli/sermaye art.', teklif: 'pay alım teklifi', birlesme: 'birleşme/devir', geri: 'geri alım', is: 'yeni iş/sözleşme', ihale: 'ihale', tesvik: 'teşvik', temettu: 'temettü', bilanco: 'bilanço', not: 'kredi notu', icerden: 'içeriden alım-satım', yatirim: 'yatırım', varlik: 'varlık alım/satım', ozel: 'özel durum', diger: 'diğer' };
export function kapClassify(x) {
  const txt = ((x.subject || '') + ' | ' + (x.summary || '')).toLocaleLowerCase('tr');
  for (const [tip, yon, onem, re] of RULES) if (re.test(txt)) return { tip, yon, onem };
  if (x.disclosureClass === 'FR') return { tip: 'bilanco', yon: 0, onem: 2 };
  if (x.disclosureType === 'ODA' || x.disclosureClass === 'ODA') return { tip: 'ozel', yon: 0, onem: 1 };
  return { tip: 'diger', yon: 0, onem: 0 };
}
export const kapSyms = x => [...new Set(String(x.relatedStocks || x.stockCodes || '').toUpperCase().split(/[^A-Z0-9]+/).filter(s => /^[A-Z][A-Z0-9]{2,5}$/.test(s)))].slice(0, 3);
// Haber hangi seans anında "işlenebilir"? Seans içi → o an; seans öncesi → bugün 09:59; seans sonrası/hafta sonu → sonraki iş günü 09:59
export function kapEntry(ms) {
  const p = trParts(ms);
  if (p.wd >= 1 && p.wd <= 5 && p.m >= 600 && p.m < 1080) return ms;
  let d = new Date(Date.UTC(+p.day.slice(0, 4), +p.day.slice(5, 7) - 1, +p.day.slice(8, 10)));
  if (!(p.wd >= 1 && p.wd <= 5 && p.m < 600)) d = new Date(d.getTime() + 86400e3);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + 86400e3);
  return d.getTime() + 9 * 3600e3 + 59 * 60e3 - TRMS; // 09:59 TR
}
// 12.10: İŞLEMCİ — akşam günün listesi büyüyünce (≈400 bildirim) her dakikaki TAM JSON ayrıştırma 10 ms sınırını aşıyordu; iş KAP adımında
// iz bırakmadan kesildi, kap_last ilerlemedi → her dakika aynı yük, karne/tavan/rapor da çalışmadı. Artık yalnız numaralar taranır,
// yalnız YENİ bildirimlerin nesneleri tek tek ayrıştırılır. Biçim beklenenden farklıysa (iç içe nesne, metinde süslü parantez) null → eski tam ayrıştırma.
export function kapFresh(raw, last, lim = 40) {
  const re = /"disclosureIndex"\s*:\s*"?(\d+)/g, hits = [], seen = new Set(); let m, any = false;
  while ((m = re.exec(raw))) { any = true; const n = +m[1]; if (n > last && !seen.has(n)) { seen.add(n); hits.push([n, m.index]); } }
  if (!any) return null;
  hits.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [n, p] of hits.slice(0, lim)) {
    const a = raw.lastIndexOf('{', p), b = raw.indexOf('}', p);
    if (a < 0 || b < 0) return null;
    let o; try { o = JSON.parse(raw.slice(a, b + 1)); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || +o.disclosureIndex !== n) return null;
    out.push(o);
  }
  return out;
}
const KAPC = { len: -1, from: '', empty: false };   // son KAP yanıtının uzunluğu (değişmediyse ayrıştırma atlanır)
let ready = false;
async function kapEnsure(env) {
  if (ready) return;
  await env.BT.batch([
    env.BT.prepare('CREATE TABLE IF NOT EXISTS kap (idx INTEGER PRIMARY KEY, t INTEGER, syms TEXT, title TEXT, subj TEXT, summ TEXT, tip TEXT, yon INTEGER, onem INTEGER, sent INTEGER DEFAULT 0)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS kap_t ON kap(t)'),
    env.BT.prepare('CREATE INDEX IF NOT EXISTS kap_sent ON kap(sent)')
  ]);
  ready = true;
}
// v10.6 (14.10): tek tip başlık, haber metni alıntı kutusunda, fiyat kopyalanır; bağlantı yerine altta 'KAP'ta oku' + 'Grafik' düğmeleri
function kapMsg(r, esc, q) {
  const yon = r.yon > 0 ? '🟢 olumlu' : r.yon < 0 ? '🔴 olumsuz' : '⚪ yönü belirsiz';
  const hm = new Date(r.t + TRMS).toISOString().slice(11, 16);
  const subj = String(r.subj || '').slice(0, 120), sm = r.summ && r.summ !== r.subj ? String(r.summ).slice(0, 220) : '';
  const px = q && q.close ? 'Hisse <code>' + Number(q.close).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</code>  bugün ' + tgPct(q.change) + ' · ' : '';
  return '📰 <b>KAP · ' + esc(r.syms) + '</b>   <i>' + yon + ' · ' + esc(KAP_AD[r.tip] || r.tip) + '</i>\n<blockquote>' + (sm ? '<b>' + esc(subj) + '</b>\n' + esc(sm) : esc(subj)) + '</blockquote>' + px + 'saat ' + hm;
}
// Telegram kuralı: önem 3 → her hisse; önem 2 (yönlü ya da bilanço) → XU100 + izleme listesi; izleme listesi → önem ≥ 1
function wantTg(r, big, watch) {
  if (r.tip === 'icerden') return false; // 03.10 (Fatih onayı): içeriden alım-satım haberleri karnede %44 → yalnız karneye yazılır
  const syms = String(r.syms).split(',');
  if (syms.some(s => watch.has(s)) && r.onem >= 2) return true; // v8.8: izleme listesinde de yalnız önemli (≥2)
  if (r.onem >= 3) return true;
  // v8.8 (Fatih: 'sadece önemli bildirimler'): BIST 100'deki önem-2 haberler artık Telegram'a gitmez (karneye yazılır)
  return false;
}
export async function kapPoll(env, h) {
  // h = { UA, tgSend, kvGet, esc, scanRaw }
  if (!env.BT) return null;
  await kapEnsure(env);
  const now = Date.now(), p = trParts(now);
  // 01.10: gece yarısından sonraki ilk 15 dk dünü de iste (23:59'da yayımlanan / birikmiş bildirim kaçmasın)
  const from = p.m < 15 ? trParts(now - 86400e3).day : p.day;
  const r = await fetch(KAP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: 'https://www.kap.org.tr/tr/bildirim-sorgu', Origin: 'https://www.kap.org.tr', 'User-Agent': h.UA },
    body: JSON.stringify({ fromDate: from, toDate: p.day, mkkMemberOidList: [], subjectList: [] }), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('KAP HTTP ' + r.status);
  // 01.10: İŞLEMCİ — günün tüm listesi her dakika ayrıştırılıyordu (akşamları ~1 MB). Yanıt bir öncekiyle aynı uzunluktaysa yeni bildirim yoktur → ayrıştırma atlanır.
  const raw = await r.text();
  if (KAPC.len === raw.length && KAPC.from === from && KAPC.empty) return { yeni: 0 };
  const lastRow = await env.BT.prepare("SELECT v FROM meta WHERE k = 'kap_last'").first();
  let last = lastRow ? +lastRow.v : 0;
  // en eskiden başla, çalışma başına en fazla 40 (ücretsiz plan istek sınırı) — birikmiş varsa sonraki dakikalarda devam
  let fresh = kapFresh(raw, last, 40);
  if (fresh === null) {
    let arr; try { arr = JSON.parse(raw); } catch (e) { throw new Error('KAP yanıtı okunamadı'); }
    if (!Array.isArray(arr)) throw new Error('KAP yanıtı dizi değil');
    fresh = arr.filter(x => +x.disclosureIndex > last).sort((a, b) => a.disclosureIndex - b.disclosureIndex).slice(0, 40);
  }
  KAPC.len = raw.length; KAPC.from = from; KAPC.empty = false;
  if (!fresh.length) { KAPC.empty = true; return { yeni: 0 }; }
  const cfg = await h.kvGet(env, 'cfg', null);
  const opt = (cfg && cfg.opt) || {};
  const watch = new Set((cfg && cfg.watch) || []);
  const bigRow = await env.BT.prepare("SELECT v FROM meta WHERE k = 'xu100'").first();
  const big = new Set(bigRow ? JSON.parse(bigRow.v) : []);
  const rows = [];
  for (const x of fresh) {
    const syms = kapSyms(x);
    const c = kapClassify(x);
    const t = kapTime(x.publishDate) || now;
    rows.push({ idx: +x.disclosureIndex, t, syms: syms.join(','), title: String(x.kapTitle || '').slice(0, 120), subj: String(x.subject || '').slice(0, 200), summ: String(x.summary || '').slice(0, 400), ...c });
  }
  const ins = env.BT.prepare('INSERT OR IGNORE INTO kap (idx,t,syms,title,subj,summ,tip,yon,onem,sent) VALUES (?,?,?,?,?,?,?,?,?,?)');
  // Telegram penceresi: önem 3 → 07:00–23:00 her gün; diğerleri → hafta içi 08:00–22:00. Pencere dışı önemliler sabah 09:30 özetinde.
  const tgOn = cfg && opt.kap !== 0;
  const toSend = [];
  for (const r0 of rows) {
    if (now - r0.t > 15 * 60e3) { r0.sent = 2; continue; } // yalnız TAZE haber anında gider (ilk açılışta eski haber seli olmasın)
    const inWin = r0.onem >= 3 ? (p.m >= 420 && p.m < 1380) : (p.wd >= 1 && p.wd <= 5 && p.m >= 480 && p.m < 1320);
    r0.sent = tgOn && r0.syms && wantTg(r0, big, watch) ? (inWin ? 1 : 0) : 2; // 2 = gönderilmeyecek, 0 = sabah özetine
    if (r0.sent === 1) toSend.push(r0);
  }
  // 01.10: ÇÖKMEYE DAYANIKLI — önce satırlar eklenir; yalnız GERÇEKTEN yeni eklenen satırlar karneye ve Telegram'a gider (çift kayıt olmaz).
  const isNew = new Set();
  for (let k = 0; k < rows.length; k += 40) {
    const part = rows.slice(k, k + 40);
    const res = await env.BT.batch(part.map(r0 => ins.bind(r0.idx, r0.t, r0.syms, r0.title, r0.subj, r0.summ, r0.tip, r0.yon, r0.onem, r0.sent)));
    part.forEach((r0, i) => { if (res[i] && res[i].meta && res[i].meta.changes) isNew.add(r0.idx); });
  }
  last = Math.max(last, ...rows.map(r0 => r0.idx));
  // 12.10: kap_last HEMEN yazılır — eklenmiş satırlar (INSERT OR IGNORE) yeniden denemede zaten 'yeni' sayılmıyordu; sonda yazmak yalnız
  // çalışma kesildiğinde aynı 40 bildirimin her dakika yeniden işlenmesine (takılmaya) yol açıyordu.
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('kap_last', ?)").bind(String(last)).run();
  // v10.0: yeni Borsa tedbiri haberleri → meta 'tedbir' (yalnız 'kisit' satırı geldiğinde 1 okuma + 1 yazma)
  try { await tedbirAdd(env, rows.filter(x => isNew.has(x.idx)), now); } catch (e) {}
  // Karne: önem ≥ 1 olan her hisse haberi ölçülsün (ilk çalışmada da — sadece Telegram atlanır)
  for (const r0 of rows.filter(x => isNew.has(x.idx))) {
    if (r0.onem < 1 || !r0.syms || r0.tip === 'devre') continue; // devre kesici haber değil, hareketin sonucu → karneye yazılmaz
    const te = kapEntry(r0.t);
    for (const s of r0.syms.split(',').slice(0, 2)) await sigAdd(env, { src: 'kap-' + r0.tip, sym: s, dir: 'AL', px: null, sc: r0.onem, t: te, meta: { idx: r0.idx, yon: r0.yon, pub: r0.t } });
  }
  // Seans içindeyse fiyatı ekle (tek tarama isteği)
  let Q = {};
  const inSess = p.wd >= 1 && p.wd <= 5 && p.m >= 600 && p.m < 1090;
  if (toSend.length && inSess && h.scanRaw) {
    try {
      const tick = [...new Set(toSend.flatMap(r0 => r0.syms.split(',')))].slice(0, 20).map(s => 'BIST:' + s);
      const rr = await h.scanRaw(env, JSON.stringify({ symbols: { tickers: tick }, columns: ['name', 'close', 'change'] }));
      const j = await rr.json(); (j.data || []).forEach(d => { Q[String(d.s).split(':').pop()] = { close: d.d[1], change: d.d[2] }; });
    } catch (e) {}
  }
  let sent = 0;
  let pn = 0;
  for (const r0 of toSend.filter(x => isNew.has(x.idx)).slice(0, 8)) { const q = Q[r0.syms.split(',')[0]]; const t = await h.tgSend(cfg, kapMsg(r0, h.esc, q), tgKb(r0.syms.split(',')[0], r0.idx)); if (t && t.ok) sent++;
    // v8.2: iPhone bildirimi (çalışma başına en çok 2 — işlemci sınırı)
    if (h.pushSend && pn < 2) { pn++; try { const s0 = r0.syms.split(',')[0]; await h.pushSend(env, { cat: 'kap', title: '📰 KAP · ' + s0 + ' · ' + (KAP_AD[r0.tip] || r0.tip), body: String(r0.subj || '') + (r0.summ ? ' — ' + r0.summ : '') + (q && q.close ? ' · ' + q.close + ' (' + (q.change >= 0 ? '+' : '') + (+q.change).toFixed(2) + '%)' : ''), url: './?s=' + s0, tag: 'kap' + r0.idx }, 2); } catch (e) {} } }
  return { yeni: rows.length, telegram: sent };
}
// Sabah 09:30 (hafta içi): gece biriken önemli KAP'lar tek mesajda
export async function kapMorning(env, h) {
  if (!env.BT) return null;
  await kapEnsure(env);
  const p = trParts(Date.now());
  if (!(p.wd >= 1 && p.wd <= 5 && p.m >= 570 && p.m < 600)) return null;
  const rs = (await env.BT.prepare('SELECT idx,t,syms,subj,summ,tip,yon,onem FROM kap WHERE sent = 0 ORDER BY onem DESC, idx DESC LIMIT 25').all()).results || [];
  if (!rs.length) return null;
  const cfg = await h.kvGet(env, 'cfg', null);
  const lines = rs.map(r => (r.yon > 0 ? '🟢' : r.yon < 0 ? '🔴' : '⚪') + ' <b>' + h.esc(r.syms) + '</b> · ' + h.esc(KAP_AD[r.tip] || r.tip) + ' · <i>' + new Date(r.t + TRMS).toISOString().slice(5, 16).replace('T', ' ').replace(/^(\d\d)-(\d\d)/, '$2.$1') + '</i>\n<blockquote>' + h.esc(String(r.summ || r.subj).slice(0, 110)) + '</blockquote>');
  // 01.10: Telegram tek mesajda en çok 4096 karakter → ~3500'lük parçalar; yalnız GİDEN satırlar 'gönderildi' işaretlenir
  const parts = []; let cur = '🌅 <b>Gece gelen önemli KAP haberleri</b>   <i>' + rs.length + ' haber</i>\n', curIdx = [];
  rs.forEach((r, i) => { if (cur.length + lines[i].length > 3500 && curIdx.length) { parts.push([cur, curIdx]); cur = ''; curIdx = []; } cur += '\n' + lines[i]; curIdx.push(r.idx); });
  if (curIdx.length) parts.push([cur, curIdx]);
  let ok = 0;
  for (const [txt, ids] of parts) {
    const t = await h.tgSend(cfg, txt);
    if (t && t.ok) { ok += ids.length; await env.BT.prepare('UPDATE kap SET sent = 1 WHERE idx IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).run(); }
    else break;
  }
  return { ozet: ok };
}
// Terminal listesi: /kap?f=onemli|hepsi&s=SYM
export async function kapList(env, url, json) {
  if (!env.BT) return json({ ok: false, error: 'D1 yok' }, 500);
  await kapEnsure(env);
  const f = url.searchParams.get('f') || 'onemli';
  const S = String(url.searchParams.get('s') || '').toUpperCase().split(',').map(x => x.replace(/[^A-Z0-9]/g, '')).filter(x => x.length >= 3).slice(0, 30);
  // 01.10: 'INDEXED BY kap_t' — yoksa SQLite birincil anahtardan geriye tüm tabloyu tarıyordu (takip filtresinde okuma sınırı riski)
  let q = 'SELECT idx,t,syms,title,subj,summ,tip,yon,onem FROM kap INDEXED BY kap_t WHERE t >= ? AND onem >= ?', b = [Date.now() - 7 * 86400e3, f === 'hepsi' ? 1 : 2];
  if (S.length) { q += ' AND (' + S.map(() => "(',' || syms || ',') LIKE ?").join(' OR ') + ')'; S.forEach(x => b.push('%,' + x + ',%')); }
  q += ' ORDER BY idx DESC LIMIT 60';
  const rs = (await env.BT.prepare(q).bind(...b).all()).results || [];
  // ölçülmüş tepkiler (Sinyal Karnesi) — haber numarasına göre
  let res = {};
  if (rs.length) {
    const lo = rs[rs.length - 1].t - 86400e3;
    const ss = (await env.BT.prepare("SELECT sym, meta, o31 o10, r15, r60, rc, mfe, pre FROM sig WHERE src LIKE 'kap-%' AND done = 1 AND err IS NULL AND t >= ? LIMIT 400").bind(lo).all()).results || [];
    ss.forEach(x => { try { const m = JSON.parse(x.meta || '{}'); if (m.idx) res[m.idx + '|' + x.sym] = { o10: x.o10, r15: x.r15, r60: x.r60, rc: x.rc, mfe: x.mfe, pre: x.pre }; } catch (e) {} });
  }
  return json({ ok: true, list: rs.map(r => Object.assign(r, { ad: KAP_AD[r.tip] || r.tip, olcum: res[r.idx + '|' + String(r.syms).split(',')[0]] || null })) });
}
