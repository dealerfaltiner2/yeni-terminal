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
ok('düğme kanal etiketiyle Pusula\'yı açıyor', /pusula\?startapp=k_am$/.test(K.kanalKb('am').inline_keyboard[0][0].url));
// --- D1 + Telegram taklidi
const meta = {}, sent = [];
const D1 = { prepare: q => { const mk = a => ({
  first: async () => { if (/FROM meta/.test(q)) { const k = a[0] ?? /k = '(\w+)'/.exec(q)[1]; return meta[k] != null ? { v: meta[k] } : null; } return null; },
  all: async () => /FROM kap/.test(q) ? { results: [{ syms: 'ASELS', tip: 'is', yon: 1, summ: 'sözleşme' }] } : /FROM sig/.test(q) ? { results: [{ src: 'firsat-A', o31: 1 }] } : { results: [] },
  run: async () => { if (/INSERT OR REPLACE INTO meta/.test(q)) { if (a.length === 2) meta[a[0]] = a[1]; else meta[/'(\w+)'/.exec(q)[1]] = a[0]; } if (/DELETE FROM meta/.test(q)) delete meta[/'(\w+)'/.exec(q)[1]]; return {}; } });
  return Object.assign(mk([]), { bind: (...a) => mk(a) }); } };
const env = { BT: D1 }, h = { kvGet: async () => ({ tgTok: TOK, chat: '-100' }), esc };
globalThis.fetch = async (url, o) => { const m = String(url).split('/').pop(), b = o && o.body ? JSON.parse(o.body) : {}; sent.push({ m, b });
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
console.log('\nKANAL + DAVET: ' + res.filter(Boolean).length + '/' + res.length + ' geçti');
process.exit(res.every(Boolean) ? 0 : 1);
