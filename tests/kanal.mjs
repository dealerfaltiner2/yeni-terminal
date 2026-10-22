globalThis.__PUSULA_PUBLIC = true;   // v14.7: bu testler herkese açık modu sınar (kapalı mod tgapp.mjs sonunda)
// v12.4 herkese açık kanal + davet kaydı
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const K = await import(path.join(W, 'kanal.js'));
const { tgBotUpdate, hookSecret } = await import(path.join(W, 'tgbot.js'));
const { tgAuth } = await import(path.join(W, 'tgapp.js'));
const res = []; const ok = (n, c, i) => { res.push(!!c); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TOK = '123456:TEST-token', tr = s => Date.parse(s + '+03:00');
// --- saf metinler
ok('sabah başlangıcı: Pazartesi sabahı → Cuma 18:00', K.prevEve(tr('2026-10-19T09:40:00')) === tr('2026-10-16T18:00:00'));
ok('sabah başlangıcı: Salı sabahı → Pazartesi 18:00', K.prevEve(tr('2026-10-20T09:40:00')) === tr('2026-10-19T18:00:00'));
const am = K.amText(tr('2026-10-19T09:40:00'), [{ syms: 'THYAO', tip: 'is', yon: 1, summ: 'Yeni iş <ilişkisi>' }],
  [{ t: tr('2026-10-19T10:00:00'), c: 'TR', ti: 'Inflation Rate YoY', im: 1, f: 33.5, u: '%' }, { t: tr('2026-10-20T10:00:00'), c: 'TR', ti: 'GDP', im: 1 }], esc);
ok('sabah mesajı: KAP + bugünün verisi (yarınki yok), HTML kaçışlı, tavsiye notu', /THYAO/.test(am) && /Enflasyon \(yıllık\) · beklenti 33.5%/.test(am) && !/Büyüme/.test(am) && /&lt;ilişkisi&gt;/.test(am) && /yatırım tavsiyesi değildir/.test(am), am.slice(0, 200));
ok('sabah mesajında AL/hedef/stop yok', !/hedef|stop|\bAL\b/i.test(am));
const pm = K.pmText(tr('2026-10-19T18:40:00'), { d: '2026-10-19', idx: [{ s: 'XU100', c: 10850, ch: -1.2, hi: 11000, lo: 10800 }], up: [], dn: [], nu: 70, nd: 500 },
  [{ src: 'algi', o31: 1 }, { src: 'algi', o31: 2 }, { src: 'momentum', o31: 0 }, { src: 'sessiz', o31: 1 }, { src: 'radar', o31: 1 }], esc);
ok('akşam mesajı: piyasa + yalnız açık kaynakların karnesi (sessiz/radar yok)', /BIST 100/.test(pm) && /⚡ Algı: 2 sinyal · 1 hedef · 1 stop/.test(pm) && /Toplam: 3 sinyalin 1'i hedefe, 1'i stopa gitti, 1'i/.test(pm) && !/Sessiz|radar/i.test(pm), pm);
ok('düğme kanal etiketiyle Pusula\'yı açıyor', /t\.me\/BistPusulaBot\?startapp=k_am$/.test(K.kanalKb('am').inline_keyboard[0][0].url));
{ const kb = K.kanalKb('am', 'bistpusulatr').inline_keyboard, u = kb[1] && kb[1][0].url;
  ok('kanal mesajı: ikinci satır Arkadaşına gönder = kanal bağlantısını paylaşır', kb.length === 2 && /^https:\/\/t\.me\/share\/url\?url=https%3A%2F%2Ft\.me%2Fbistpusulatr&text=/.test(u) && /Arkadaşına gönder/.test(kb[1][0].text), u);
  ok('kanal adı yoksa paylaşım satırı yok', K.kanalKb('am', '').inline_keyboard.length === 1 && K.kanalKb('am', 'a b"<').inline_keyboard.length === 1); }
// --- D1 + Telegram taklidi
const meta = {}, sent = [];
const D1 = { prepare: q => { const mk = a => ({
  first: async () => { if (/FROM meta/.test(q)) { const k = a[0] ?? /k = '(\w+)'/.exec(q)[1]; return meta[k] != null ? { v: meta[k] } : null; } return null; },
  all: async () => /FROM kap/.test(q) ? { results: [{ syms: 'ASELS', tip: 'is', yon: 1, summ: 'sözleşme' }] } : /FROM sig/.test(q) ? { results: [{ src: 'firsat-A', o31: 1 }] } : { results: [] },
  run: async () => { if (/INSERT OR REPLACE INTO meta/.test(q)) { if (a.length === 2) meta[a[0]] = a[1]; else meta[/'(\w+)'/.exec(q)[1]] = a[0]; } if (/DELETE FROM meta/.test(q)) delete meta[/'(\w+)'/.exec(q)[1]]; return {}; } });
  return Object.assign(mk([]), { bind: (...a) => mk(a) }); } };
const env = { BT: D1 }, h = { kvGet: async () => ({ tgTok: TOK, chat: '-100' }), esc };
globalThis.fetch = async (url, o) => { const m = String(url).split('/').pop(), b = o && o.body ? JSON.parse(o.body) : {}; sent.push({ m, b, url: String(url) });
  if (m === 'getChatMember') return new Response(JSON.stringify({ ok: true, result: { status: 'left' } }));
  if (m === 'getChatMemberCount') return new Response(JSON.stringify({ ok: true, result: 42 }));
  return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } })); };
const sec = await hookSecret(TOK);
const upd = st => new Request('https://x/tgbot', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': sec }, body: JSON.stringify({ update_id: 2, my_chat_member: { chat: { id: -1009, type: 'channel', title: 'BIST Pusula', username: 'bistpusula' }, from: { id: 5 }, new_chat_member: { status: st, can_post_messages: true } } }) });
await tgBotUpdate(upd('administrator'), env, h);
ok('bot kanala yönetici olunca kanal kaydedildi, tanıtım mesajı gitti ve sabitlendi', JSON.parse(meta.pubch || '{}').id === -1009 && sent.some(x => x.m === 'sendMessage' && x.b.chat_id === -1009 && /hoş geldin/.test(x.b.text)) && sent.some(x => x.m === 'pinChatMessage'), JSON.stringify(sent.map(x => x.m)));
sent.length = 0; await tgBotUpdate(upd('administrator'), env, h);
ok('aynı kanal yeniden bildirilince tanıtım tekrar gitmedi', sent.length === 0);
// sabah: pencere dışında hiçbir şey, pencerede bir kez
sent.length = 0;
ok('sabah 09:20 → mesaj yok', (await K.kanalAm(env, h, tr('2026-10-19T09:20:00'))) === null && !sent.length);
const a1 = await K.kanalAm(env, h, tr('2026-10-19T09:36:00')), a2 = await K.kanalAm(env, h, tr('2026-10-19T09:37:00'));
ok('sabah 09:36 bir kez gönderildi (09:37 tekrar yok), kanal etiketli düğme', a1 && a1.ok && a2 === null && sent.filter(x => x.m === 'sendMessage').length === 1 && /k_am/.test(JSON.stringify(sent[0].b.reply_markup)), JSON.stringify(a1));
ok('Cumartesi sabah mesajı yok', (await K.kanalAm(env, h, tr('2026-10-17T09:40:00'))) === null);
// akşam: karne bitmeden bekler, bitince gönderir + abone sayısı
sent.length = 0; meta.mkt_close = JSON.stringify({ d: '2026-10-19', idx: [{ s: 'XU100', c: 10850, ch: 0.5 }], nu: 1, nd: 1 });
ok('akşam: karne ölçümü bitmeden (18:40) bekliyor', (await K.kanalPm(env, h, tr('2026-10-19T18:40:00'))) === null && !sent.length);
meta.sigsum = '2026-10-19';
const p1 = await K.kanalPm(env, h, tr('2026-10-19T18:41:00'));
ok('akşam: karne bitince gönderildi, abone sayısı kaydedildi', p1 && p1.ok && /Fırsat A: 1 sinyal · 1 hedef/.test(sent.find(x => x.m === 'sendMessage').b.text) && JSON.parse(meta.pub_hist)[0].n === 42, JSON.stringify(p1));
ok('akşam ikinci kez gitmez', (await K.kanalPm(env, h, tr('2026-10-19T18:50:00'))) === null);
sent.length = 0; meta.pub_once = JSON.stringify({ t: '🧭 <b>Haftaya bakış</b>', tag: 'hafta' });
const o1 = await K.kanalOnce(env, h), o2 = await K.kanalOnce(env, h);
ok('tek seferlik paylaşım kanala düğmeli gitti, sonra silindi', o1 && o1.ok && o2 === null && meta.pub_once == null && /k_hafta/.test(JSON.stringify(sent[0].b.reply_markup)) && sent[0].b.chat_id === -1009, JSON.stringify(o1));
sent.length = 0; meta.pub_once = JSON.stringify({ photos: ['https://x/1.jpg', 'https://x/2.jpg'], t: '🔭 <b>Keşfet</b>', bt: 'Aç', tag: 'kesif' });
{ const oa = await K.kanalOnce(env, h); ok('albüm paylaşımı: önce sendMediaGroup (altyazı ilk fotoğrafta), sonra düğmeli mesaj', oa && oa.ok && sent[0].m === 'sendMediaGroup' && sent[0].b.media.length === 2 && sent[0].b.media[0].caption && !sent[0].b.media[1].caption && sent[1] && sent[1].m === 'sendMessage' && /k_kesif/.test(JSON.stringify(sent[1].b.reply_markup)), JSON.stringify(sent.map(x => x.m))); }
// v12.5 seans içi KAP + Pazar haftaya bakış
const kp = K.kapPubText({ t: tr('2026-10-19T11:05:00'), syms: 'THYAO,PGSUS', tip: 'is', yon: 1, subj: 'Yeni sözleşme <x>', summ: 'Tutar 100 milyon', q: { close: 312.5, change: 1.24 } }, esc);
ok('anlık KAP mesajı: sembol, saat, olumlu, fiyat; AL/hedef/stop yok', /Son dakika KAP · THYAO/.test(kp) && /11:05/.test(kp) && /🟢 Olumlu/.test(kp) && /312,50 TL, bugün \+%1,24/.test(kp) && /&lt;x&gt;/.test(kp) && !/hedef|stop|\bAL\b/i.test(kp), kp);
sent.length = 0; delete meta.pub_kap;
const P = [{ idx: 1, t: 1, syms: 'AAA', tip: 'is', yon: 0, subj: 'a' }, { idx: 2, t: 2, syms: 'BBB', tip: 'is', yon: 1, subj: 'b' }];
for (let i = 0; i < 5; i++) await K.kanalKap(env, h, P, tr('2026-10-19T11:00:00'));
ok('anlık KAP: çalışma başına 1, günde en çok 3; yönlü haber önce', sent.length === 3 && /BBB/.test(sent[0].b.text) && /k_kap/.test(JSON.stringify(sent[0].b.reply_markup)), sent.length + ' ' + (sent[0] && sent[0].b.text.slice(0, 40)));
const wk = K.weekText(tr('2026-10-18T20:00:00'), { c: 11721.7, p: 12266, fri: -2.89, nu: 70, nd: 549 }, [{ syms: 'CGCAM', subj: 'Cam siparişi', yon: 1 }],
  [{ t: tr('2026-10-22T14:00:00'), c: 'TR', ti: 'TCMB Interest Rate Decision', im: 0, p: 37, u: '%' }, { t: tr('2026-10-25T10:00:00'), c: 'TR', ti: 'Inflation Rate YoY', im: 1 }], esc);
ok('haftaya bakış: tarih aralığı, haftalık düşüş, Cuma, KAP, takvim (hafta dışı yok)', /19 Ekim – 23 Ekim/.test(wk) && /%4,4 düşüşle/.test(wk) && /Cuma günü %2,9 düştü; 70 hisse/.test(wk) && /CGCAM/.test(wk) && /Perşembe 14:00 · 🇹🇷 Faiz kararı \(önceki 37%\)/.test(wk) && !/Enflasyon/.test(wk), wk);
sent.length = 0;
const fakeBars = { fetchBarsTV: async () => ({ 'BIST:XU100': { m: new Map([[1, [Date.parse('2026-10-09T07:00:00Z') / 1000, 0, 0, 0, 12266, 1]], [2, [Date.parse('2026-10-16T07:00:00Z') / 1000, 0, 0, 0, 11721.7, 1]]]) } }) };
ok('haftaya bakış: Cumartesi yok', (await K.kanalWeek(env, { ...h, ...fakeBars }, tr('2026-10-17T20:00:00'))) === null);
meta.mkt_close = JSON.stringify({ d: '2026-10-16', idx: [{ s: 'XU100', c: 11721.7, ch: -2.89 }], nu: 70, nd: 549 });
const w1 = await K.kanalWeek(env, { ...h, ...fakeBars }, tr('2026-10-18T19:56:00')), w2 = await K.kanalWeek(env, { ...h, ...fakeBars }, tr('2026-10-18T20:10:00'));
ok('haftaya bakış: Pazar 19:56 bir kez, mumlardan haftalık değişim', w1 && w1.ok && w2 === null && sent.length === 1 && /%4,4 düşüşle/.test(sent[0].b.text) && /k_hafta/.test(JSON.stringify(sent[0].b.reply_markup)), JSON.stringify(w1) + ' ' + (sent[0] && sent[0].b.text.slice(0, 160)));
await tgBotUpdate(upd('left'), env, h);
ok('bot kanaldan çıkarılınca kanal kaydı silindi', meta.pubch == null);
// --- davet kaydı (tgauth start_param)
const make = (sp, uid) => { const f = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE1', user: JSON.stringify({ id: uid, first_name: 'Ali' }), start_param: sp };
  const dcs = Object.keys(f).sort().map(k => k + '=' + f[k]).join('\n'); const s2 = createHmac('sha256', 'WebAppData').update(TOK).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', s2).update(dcs).digest('hex') }).toString(); };
const got = []; const ha = { json: (o, s) => new Response(JSON.stringify(o), { status: s || 200 }), kvGet: h.kvGet, ownerTok: async () => 'own', errAdd: async () => {}, devApprove: async () => {}, devMember: async () => {}, uyeAdd: async (e, u, g, ref) => got.push([u.id, ref]) };
const au = async (sp, uid) => tgAuth(new Request('https://api.x/tgauth', { method: 'POST', body: JSON.stringify({ d: make(sp, uid), dev: 'abcdef12' }) }), { ACCESS_KEY: 'k' }, ha);
await au('r_555666777', 111222333); await au('k_am', 111222334); await au('THYAO', 111222335); await au('r_111222336', 111222336);
ok('davet/kanal kaynağı kaydedildi; hisse bağlantısı ve kendini davet sayılmadı', JSON.stringify(got) === JSON.stringify([[111222333, 'r_555666777'], [111222334, 'k_am'], [111222335, ''], [111222336, '']]), JSON.stringify(got));
// v12.6 yeni bot (@BistPusulaBot, env.TG_APP_TOKEN) — eski botla birlikte
const NEW = '999:NEW-token', envN = { BT: D1, TG_APP_TOKEN: NEW }, secN = await hookSecret(NEW);
const updN = (st, s) => new Request('https://x/tgbot', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': s }, body: JSON.stringify({ update_id: 3, my_chat_member: { chat: { id: -1009, type: 'channel', title: 'BIST Pusula', username: 'bistpusulatr' }, from: { id: 5 }, new_chat_member: { status: st, can_post_messages: true } } }) });
sent.length = 0; await tgBotUpdate(updN('administrator', secN), envN, h);
ok('yeni bot kanala yönetici olunca kanal yeni bota geçti', JSON.parse(meta.pubch || '{}').via === 'app', meta.pubch);
await tgBotUpdate(updN('left', sec), envN, h);
ok('eski botu kanaldan çıkarmak yeni botun kaydını silmedi', meta.pubch && JSON.parse(meta.pubch).via === 'app');
sent.length = 0; meta.pub_once = JSON.stringify({ t: 'x', tag: 'a' }); await K.kanalOnce(envN, h);
ok('kanal mesajı yeni botun anahtarıyla gidiyor', sent.length === 1 && /bot999:NEW-token\/sendMessage$/.test(sent[0].url || ''), JSON.stringify(sent.map(x => x.url)));
sent.length = 0;
const pmN = new Request('https://x/tgbot', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secN }, body: JSON.stringify({ update_id: 4, message: { message_id: 1, chat: { id: 77, type: 'private' }, from: { id: 77, is_bot: false }, text: '/start' } }) });
await tgBotUpdate(pmN, envN, h);
ok('yeni bota yazana hoş geldin yeni botun anahtarıyla gidiyor', sent.length === 1 && /bot999:NEW-token\/sendMessage$/.test(sent[0].url || ''));
const mk2 = (tok, uid) => { const f = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE1', user: JSON.stringify({ id: uid, first_name: 'Ayşe' }) };
  const dcs = Object.keys(f).sort().map(k => k + '=' + f[k]).join('\n'); const s2 = createHmac('sha256', 'WebAppData').update(tok).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', s2).update(dcs).digest('hex') }).toString(); };
got.length = 0;
const rN = await tgAuth(new Request('https://api.x/tgauth', { method: 'POST', body: JSON.stringify({ d: mk2(NEW, 4242), dev: 'abcdef12' }) }), { ACCESS_KEY: 'k', TG_APP_TOKEN: NEW }, ha);
const rO = await tgAuth(new Request('https://api.x/tgauth', { method: 'POST', body: JSON.stringify({ d: mk2(TOK, 4343), dev: 'abcdef12' }) }), { ACCESS_KEY: 'k', TG_APP_TOKEN: NEW }, ha);
ok('uygulama girişi: yeni botun ve eski botun imzası ikisi de kabul', rN.status === 200 && rO.status === 200 && got.length === 2, rN.status + ' ' + rO.status);
// v12.10 adlı davet bağlantıları + katılım sayımı (kanal yeni botta: pubch via 'app', id -1009)
{ const of = globalThis.fetch; let n = 0;
  globalThis.fetch = async (url, o) => { if (/createChatInviteLink$/.test(String(url))) { const b = JSON.parse(o.body); sent.push({ m: 'link', b, url: String(url) });
      return new Response(JSON.stringify(b.name === 'Bozuk' ? { ok: false, description: 'Bad Request: not enough rights' } : { ok: true, result: { invite_link: 'https://t.me/+abc' + (++n), name: b.name } })); } return of(url, o); };
  sent.length = 0;
  ok('istek yokken bağlantı işi bir şey yapmıyor', (await K.kanalLinks(envN, h)) === null && sent.length === 0);
  meta.pub_links_req = JSON.stringify(['Borsacılar Cemiyeti', 'Instagram', 'Bozuk']);
  const l1 = await K.kanalLinks(envN, h), L = JSON.parse(meta.pub_links || '{}');
  ok('adlı bağlantılar yeni botla açıldı, kaydedildi, istek silindi, hata sonuçta yazılı', l1 && l1.ok && L['Borsacılar Cemiyeti'] === 'https://t.me/+abc1' && L.Instagram === 'https://t.me/+abc2' && !L.Bozuk && meta.pub_links_req == null && /Bozuk: Bad Request/.test(meta.pub_links_res) && sent.every(x => /bot999:NEW-token/.test(x.url)) && sent[0].b.chat_id === -1009, meta.pub_links_res);
  sent.length = 0; meta.pub_links_req = JSON.stringify(['Instagram', 'WhatsApp']); await K.kanalLinks(envN, h);
  ok('var olan bağlantı yeniden açılmıyor, yenisi ekleniyor', sent.length === 1 && sent[0].b.name === 'WhatsApp' && Object.keys(JSON.parse(meta.pub_links)).length === 3, meta.pub_links_res);
  globalThis.fetch = of;
  const cm = (st, old, link, chat = -1009) => new Request('https://x/tgbot', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secN }, body: JSON.stringify({ update_id: 9, chat_member: { chat: { id: chat, type: 'channel' }, from: { id: 1 }, old_chat_member: { status: old }, new_chat_member: { status: st }, ...(link ? { invite_link: { invite_link: 'https://t.me/+x', name: link } } : {}) } }) });
  sent.length = 0;
  await tgBotUpdate(cm('member', 'left', 'Instagram'), envN, h); await tgBotUpdate(cm('member', 'left', 'Instagram'), envN, h); await tgBotUpdate(cm('member', 'left', null), envN, h);
  await tgBotUpdate(cm('left', 'member', 'Instagram'), envN, h); await tgBotUpdate(cm('member', 'left', 'Instagram', -555), envN, h);
  const J = JSON.parse(meta.pub_join || '{}');
  ok('katılım: bağlantı adına göre sayıldı, doğrudan ayrı; ayrılan ve başka sohbet sayılmadı, mesaj gitmedi', J.Instagram === 2 && J['Doğrudan / kanal adı'] === 1 && Object.keys(J).length === 2 && sent.length === 0, meta.pub_join); }
console.log('\nKANAL + DAVET: ' + res.filter(Boolean).length + '/' + res.length + ' geçti');
process.exit(res.every(Boolean) ? 0 : 1);
