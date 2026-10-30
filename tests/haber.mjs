// v14.19 Haber Merkezi: RSS okuma, tarih, TCMB kuralı, yapay zekâ doğrulaması, Telegram kuralı, uçtan uca (D1 taklidi)
import { rssItems, rssTime, tcmbClass, habParse, habWantTg, habMsg, spkClean, haberPoll, haberFromKap, haberRoute, isSpkBulten, isBistDuyuru, itemId, HABER_TG_MAX } from '../worker/src/haber.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 1) RSS okuma
const xml = `<?xml version="1.0"?><rss><channel><title>TCMB</title>
<item><title><![CDATA[Faiz Oranlarına İlişkin Basın Duyurusu (2026-45)]]></title><link>https://www.tcmb.gov.tr/a1</link><pubDate>22 Eki 2026 14:00:00</pubDate></item>
<item><title>Merkez &amp; Bankası &lt;b&gt;forum&lt;/b&gt;</title><link>https://www.tcmb.gov.tr/a2</link><guid>g2</guid><pubDate>Thu, 22 Oct 2026 11:00:00 +0300</pubDate><description><![CDATA[<p>Kısa <b>özet</b></p>]]></description></item>
</channel></rss>`;
const it = rssItems(xml);
ok('RSS: iki haber, CDATA ve HTML temizlenir', it.length === 2 && it[0].title.startsWith('Faiz Oranlarına') && it[1].title === 'Merkez & Bankası forum' && it[1].desc === 'Kısa özet' && it[1].guid === 'g2', it);
ok('tarih: Türkçe ay, saat dilimi yok → TR saati', rssTime('22 Eki 2026 14:00:00') === Date.UTC(2026, 9, 22, 11, 0, 0));
ok('tarih: RFC (+0300)', rssTime('Thu, 22 Oct 2026 11:00:00 +0300') === Date.UTC(2026, 9, 22, 8, 0, 0));
ok('tarih: okunamaz → null', rssTime('dün akşam') === null && rssTime('') === null);
ok('kimlik: aynı haber aynı kimlik', itemId('tcmb', it[0]) === itemId('tcmb', { link: 'https://www.tcmb.gov.tr/a1', title: 'x' }));

// 2) TCMB kuralı
ok('TCMB: faiz kararı 3, PPK özeti 2, likidite 2, forum 1', tcmbClass('tcmb', 'Faiz Oranlarına İlişkin Basın Duyurusu') === 3 && tcmbClass('tcmb', 'Para Politikası Kurulu Toplantı Özeti') === 2 &&
  tcmbClass('tcmb', 'Türk Lirası Likidite Yönetimine İlişkin') === 2 && tcmbClass('tcmb', 'İstanbul Ekonomi Forumu') === 1 && tcmbClass('ppk', 'Karar') === 3);

// 3) Yapay zekâ yanıtı doğrulama
const known = new Set(['THYAO', 'ASELS', 'TUPRS']);
const src = 'THY 2026 yılında 15 yeni uçak alacak — Türk Hava Yolları filo';
let a = habParse('Tamam: {"onem":3,"yon":1,"hisse":["THYAO","UYDURMA","asels"],"not":"THY 15 yeni uçakla filosunu büyütüyor."}', src, known);
ok('AI: bilinmeyen kod atılır, küçük harf düzeltilir, rakam haberde var', a && a.onem === 3 && a.yon === 1 && a.hisse.join() === 'THYAO,ASELS' && a.not.includes('15'), a);
a = habParse('{"onem":7,"yon":-5,"hisse":"THYAO","not":"Hisse 300 liraya çıkabilir."}', src, known);
ok('AI: aralık dışı kırpılır, haberde olmayan rakam → not silinir', a && a.onem === 3 && a.yon === -1 && a.hisse.length === 0 && a.not === '', a);
ok('AI: JSON yoksa null', habParse('bilmiyorum', src, known) === null);
a = habParse('{"onem":2,"yon":1,"hisse":[],"not":"Hisseyi al önerisi veriyorum."}', src, known);
ok('AI: al/sat önerisi cümlesi silinir', a && a.not === '', a);

// 4) Telegram kuralı
const now = Date.UTC(2026, 9, 26, 11, 0, 0); // 14:00 TR
const R = (o) => Object.assign({ onem: 3, t: now - 60e3 }, o);
ok('Telegram: önem 3, taze → gider', habWantTg(R({}), now, 0));
ok('Telegram: önem 2 gitmez', !habWantTg(R({ onem: 2 }), now, 0));
ok('Telegram: 31 dk önceki gitmez', !habWantTg(R({ t: now - 31 * 60e3 }), now, 0));
ok('Telegram: ilk açılıştaki eski haber gitmez', !habWantTg(R({ first: true }), now, 0));
ok('Telegram: günlük sınır', !habWantTg(R({}), now, HABER_TG_MAX));
ok('Telegram: gece 02:00 gitmez', !habWantTg(R({ t: Date.UTC(2026, 9, 25, 23, 0) }), Date.UTC(2026, 9, 25, 23, 1), 0));
const msg = habMsg({ src: 'aa', t: now, title: 'Vergi <değişikliği>', txt: 'Bankaları etkiler', syms: 'AKBNK', yon: -1 }, esc);
ok('mesaj: kaynak, kaçışlı başlık, hisse, AL/SAT yok, uyarı', msg.includes('Anadolu Ajansı') && msg.includes('&lt;değişikliği&gt;') && msg.includes('AKBNK') && msg.includes('🔴') && !/hedef|stop/i.test(msg) && msg.includes('al/sat önerisi değildir'), msg);

// 5) SPK özeti temizliği
ok('SPK: rakamı metinde olmayan madde atılır, en çok 3', spkClean('• ABC AŞ hakkında 6 ay işlem yasağı getirildi.\n- XYZ AŞ 500 milyon TL bedelli onayı aldı.\n• Kısa\n• DEF AŞ halka arzı onaylandı ve 99 lot.', 'ABC AŞ 6 ay işlem yasağı XYZ AŞ 500 milyon TL DEF AŞ halka arz')
  === '• ABC AŞ hakkında 6 ay işlem yasağı getirildi.\n• XYZ AŞ 500 milyon TL bedelli onayı aldı.');
ok('KAP satırı tanıma', isSpkBulten({ title: 'SERMAYE PİYASASI KURULU', subj: 'SPK Bülteni' }) && isBistDuyuru({ title: 'BORSA İSTANBUL A.Ş.' }) && !isBistDuyuru({ title: 'BORSA İSTANBUL BISTECH DEVRE KESİCİ UYGULAMASI' }) && !isSpkBulten({ title: 'X A.Ş.', subj: 'SPK Bülteni hakkında' }));

// 6) Uçtan uca (D1 + Telegram + AI taklidi)
function mkEnv(aiOut) {
  const meta = { idx_list: JSON.stringify({ x100: ['THYAO', 'ASELS', 'AKBNK'], x30: ['THYAO'] }) }, haber = new Map(), kap = [];
  const stmt = q => {
    const S = { a: [], bind(...a) { const n = stmt(q); n.a = a; return n; },
      async first() { if (/FROM meta/.test(q)) { const v = meta[S.a[0] ?? (/'(\w+)'/.exec(q) || [])[1]]; return v != null ? { v } : null; } return null; },
      async run() { if (/INSERT OR REPLACE INTO meta/.test(q)) meta[S.a[0]] = S.a[1]; if (/UPDATE haber SET sent = 1/.test(q)) { const r = haber.get(S.a[0]); if (r) r.sent = 1; } if (/INSERT OR IGNORE INTO haber/.test(q)) { if (haber.has(S.a[0])) return { meta: { changes: 0 } }; const [id, t, src, title, txt, syms, yon, onem, url, sent] = S.a; haber.set(id, { id, t, src, title, txt, syms, yon, onem, url, sent }); return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; },
      async all() { if (/FROM haber/.test(q)) return { results: [...haber.values()].filter(r => r.t >= S.a[0] && r.onem >= 1).sort((x, y) => y.t - x.t) }; if (/FROM kap/.test(q)) return { results: kap }; return { results: [] }; } };
    return S;
  };
  const env = { BT: { prepare: stmt, batch: async L => Promise.all(L.map(s => s.run())) }, AI: { run: async () => ({ response: aiOut }) } };
  return { env, meta, haber, kap };
}
const sent = [];
const h = { UA: 'test', esc, kvGet: async () => ({ tgTok: 'x', chat: 'y', opt: {} }), tgSend: async (cfg, t, kb) => { sent.push({ t, kb }); return { ok: true }; } };
const T0 = Date.UTC(2026, 9, 26, 11, 0, 0);   // 14:00 TR
const feed = (items) => `<rss><channel>${items.map(x => `<item><title>${x[0]}</title><link>${x[1]}</link><pubDate>${new Date(x[2]).toUTCString()}</pubDate><description>${x[3] || ''}</description></item>`).join('')}</channel></rss>`;
let FEED = { ppk: feed([['Eski PPK kararı', 'https://t/p0', T0 - 86400e3]]), tcmb: feed([['Eski duyuru', 'https://t/t0', T0 - 86400e3]]), aa: feed([['Borsa güne yükselişle başladı', 'https://aa/1', T0 - 3600e3, 'BIST 100 endeksi']]) };
const fetchFn = async (u) => { const k = /PPK/.test(u) ? 'ppk' : /Basin/.test(u) ? 'tcmb' : /aa\.com/.test(u) ? 'aa' : 'x'; if (FEED[k] == null) return { ok: false, status: 503 }; return { ok: true, text: async () => FEED[k] }; };
const E = mkEnv('{"onem":3,"yon":1,"hisse":["THYAO"],"not":"THY için olumlu bir gelişme."}');
let r = await haberPoll(E.env, h, T0, fetchFn);
ok('ilk çalışma: eski haberler kaydedilir ama Telegram yok', r.yeni === 3 && sent.length === 0 && E.haber.size === 3, { r, n: E.haber.size });
r = await haberPoll(E.env, h, T0 + 60e3, fetchFn);
ok('ikinci çalışma: yeni haber yok → hiçbir şey', r.yeni === 0 && sent.length === 0, r);
FEED.ppk = feed([['Faiz Oranlarına İlişkin Basın Duyurusu', 'https://t/p1', T0 + 90e3], ['Eski PPK kararı', 'https://t/p0', T0 - 86400e3]]);
FEED.aa = feed([['THY yeni uçak siparişi verdi', 'https://aa/2', T0 + 60e3, 'Türk Hava Yolları sipariş'], ['Futbolda derbi heyecanı', 'https://aa/3', T0 + 60e3, 'maç'], ['Borsa güne yükselişle başladı', 'https://aa/1', T0 - 3600e3]]);
FEED.tcmb = null;   // kaynak çökerse diğerleri sürer
r = await haberPoll(E.env, h, T0 + 120e3, fetchFn);
const thy = [...E.haber.values()].find(x => x.title.startsWith('THY'));
ok('faiz kararı + AA önemli haber Telegram\'a; maç haberi kaydedilmez; çöken kaynak hata olarak yazılır', sent.length === 2 && sent.some(s => s.t.includes('faiz kararı')) && thy && thy.syms === 'THYAO' && thy.onem === 3 &&
  ![...E.haber.values()].some(x => /derbi/.test(x.title)) && r.err.tcmb && sent[0].kb && sent[0].kb.inline_keyboard[0][0].url.startsWith('https://'), { r, sent: sent.map(s => s.t.slice(0, 60)) });
ok('durum kaydı (meta haber_st) ve günlük sayaç', JSON.parse(E.meta.haber_st).tg === 2 && JSON.parse(E.meta.haber_tg).n === 2);
// SPK bülteni + Borsa duyurusu (KAP'tan)
const spkFetch = async u => ({ ok: true, text: async () => JSON.stringify({ html: '<p>' + 'ABC AŞ hakkında 6 ay işlem yasağı getirilmiştir. XYZ AŞ 500 milyon TL bedelli sermaye artırımı onaylandı. '.repeat(4) + '</p>' }) });
const E2 = mkEnv('• ABC AŞ hakkında 6 ay işlem yasağı getirildi.\n• XYZ AŞ 500 milyon TL bedelli onayı aldı.\n• Uydurma 777 madde.');
sent.length = 0;
r = await haberFromKap(E2.env, h, [{ idx: 11, t: T0, syms: '', title: 'SERMAYE PİYASASI KURULU', subj: 'SPK Bülteni', summ: '' }, { idx: 12, t: T0, syms: 'USAK', title: 'BORSA İSTANBUL A.Ş.', subj: 'Borsa İstanbul A.Ş. Duyurusu', summ: 'Pay işlem görmeye başlayacak' }], T0 + 60e3, spkFetch);
const spk = E2.haber.get('spk:11'), bist = E2.haber.get('bist:12');
ok('SPK bülteni: özet (uydurma madde atılır) + Telegram; Borsa duyurusu hisseye bağlı, Telegram yok', r.yeni === 2 && sent.length === 1 && spk.txt.includes('işlem yasağı') && !spk.txt.includes('777') && bist.syms === 'USAK' && bist.onem === 2 && bist.sent === 2, { r, spk, bist, n: sent.length });
// /haber
E2.kap.push({ idx: 99, t: T0, syms: 'ASELS', title: 'ASELSAN', subj: 'Yeni İş İlişkisi', summ: 'Sözleşme', tip: 'is', yon: 1, onem: 3 }, { idx: 98, t: T0, syms: 'USAK', title: 'BORSA İSTANBUL A.Ş.', subj: 'Borsa duyurusu', summ: '', tip: 'kisit', yon: -1, onem: 2 });
const json = (o, st) => ({ o, st: st || 200 });
const _now = Date.now; Date.now = () => T0 + 3600e3;   // 31.10: rota son 3 günü verir → test saati sabit (eskiden tarih ilerleyince düşüyordu)
const L = (await haberRoute(E2.env, json, false)).o; Date.now = _now;
ok('/haber: haber + KAP birleşik, Borsa duyurusu iki kez çıkmaz, yeniden eskiye', L.ok && L.list.length === 3 && L.list.some(x => x.id === 'kap:99' && x.ad === 'KAP') && !L.list.some(x => x.id === 'kap:98'), L.list.map(x => x.id));
ok('/haber: üyeye boş', (await haberRoute(E2.env, json, true)).o.list.length === 0);
if (bad) { console.log('HABER MERKEZİ: ' + bad + ' HATA'); process.exit(1); } else console.log('HABER MERKEZİ: hepsi geçti');
