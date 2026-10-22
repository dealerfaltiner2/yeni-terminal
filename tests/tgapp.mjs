globalThis.__PUSULA_PUBLIC = true;   // v14.7: bu testler herkese açık modu sınar (kapalı mod tgapp.mjs sonunda)
// Telegram mini uygulaması girişi: imza doğrulama (Telegram'ın belgelediği yöntemle üretilmiş örnek veriyle)
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const { tgInitCheck, tgChanGate, tgAuth } = await import(path.join(W, 'tgapp.js'));
const { tgKb } = await import(path.join(W, 'tgfmt.js'));
const res = []; const ok = (n, c, i) => { res.push(!!c); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
const TOK = '123456:TEST-token', now = Date.now();
const make = (tok, ad) => { const f = { auth_date: String(Math.floor(ad / 1000)), query_id: 'AAE1', user: JSON.stringify({ id: 42, first_name: 'Fatih' }), start_param: 'THYAO' };
  const dcs = Object.keys(f).sort().map(k => k + '=' + f[k]).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(tok).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...f, hash }).toString(); };
const u = await tgInitCheck(make(TOK, now - 60e3), TOK, now);
ok('doğru imza kabul edildi (kullanıcı 42)', u && u.id === 42, JSON.stringify(u));
ok('başka botun imzası reddedildi', (await tgInitCheck(make('999:other', now - 60e3), TOK, now)) === null);
ok('bozulmuş veri reddedildi', (await tgInitCheck(make(TOK, now - 60e3).replace('THYAO', 'ASELS'), TOK, now)) === null);
ok('24 saatten eski giriş reddedildi', (await tgInitCheck(make(TOK, now - 2 * 86400e3), TOK, now)) === null);
const k = tgKb('THYAO', 77);
ok('sunucu düğmeleri: önce Pusula\'da aç (startapp), altında KAP ve Grafik', /t\.me\/BistPusulaBot\?startapp=THYAO$/.test(k.inline_keyboard[0][0].url) && k.inline_keyboard[1].length === 2);
ok('hissesiz mesajda yalnız Pusula düğmesi', tgKb(null).inline_keyboard.length === 1 && /BistPusulaBot\?startapp$/.test(tgKb(null).inline_keyboard[0][0].url));

// v13.8 kanal kapısı
const envOf = ch => ({ ACCESS_KEY: 'K', TG_APP_TOKEN: 'APP', BT: { prepare: () => ({ first: async () => ch ? { v: JSON.stringify(ch) } : null }) } });
const CH = { id: -100123, title: 'BIST Pusula', user: 'bistpusulatr', via: 'app' };
let seen = '';
const fk = st => async url => { seen = url; if (st === 'x') throw new Error('ağ'); return { json: async () => ({ ok: true, result: { status: st } }) }; };
ok('kanal üyesi geçer', (await tgChanGate(envOf(CH), { tgTok: 'OLD' }, 42, fk('member'))) === null);
const g = await tgChanGate(envOf(CH), { tgTok: 'OLD' }, 42, fk('left'));
ok('kanala katılmamış kişi kapıya takılır, kanal bağlantısı döner, kontrol kanalı yöneten botla', g && g.url === 'https://t.me/bistpusulatr' && /botAPP\/getChatMember\?chat_id=-100123&user_id=42/.test(seen), JSON.stringify(g) + ' ' + seen);
ok('kanal kayıtlı değilse kapı açık', (await tgChanGate(envOf(null), { tgTok: 'OLD' }, 42, fk('left'))) === null);
ok('Telegram yanıt vermezse kapı açık', (await tgChanGate(envOf(CH), { tgTok: 'OLD' }, 42, fk('x'))) === null);
// tgAuth akışı: grup üyesi muaf, dışarıdan gelen kapıya takılır, kontrol modu kayıt yapmaz
const realFetch = globalThis.fetch;
const run = async (grpSt, gate, chk) => { let added = 0; globalThis.fetch = async () => ({ json: async () => ({ ok: true, result: { status: grpSt } }) });
  const req = { url: 'https://api.x/tgauth', text: async () => JSON.stringify({ d: make(TOK, Date.now() - 1000), dev: 'abcdefgh12', chk }) };
  const h = { json: (o) => o, kvGet: async () => ({ tgTok: TOK, chat: -1 }), ownerTok: async () => 'OWN', errAdd: async () => {}, uyeAdd: async () => { added++; }, devMember: async () => {}, chanGate: async () => gate };
  const r = await tgAuth(req, { ACCESS_KEY: 'K', BT: {} }, h); globalThis.fetch = realFetch; return { r, added }; };
const G = { url: 'https://t.me/bistpusulatr', title: 'BIST Pusula' };
let t1 = await run('left', G); ok('grupta olmayan + kanalda olmayan → kapı, üye kaydı yapılmaz', t1.r.ok === false && t1.r.kanal && t1.added === 0, JSON.stringify(t1));
let t2 = await run('member', G); ok('sinyal grubu üyesi kapıdan muaf', t2.r.ok === true && t2.added === 1, JSON.stringify(t2));
let t3 = await run('left', null, 1); ok('kontrol modunda kanal üyesi: ok, kayıt yok', t3.r.ok === true && t3.r.kanal === null && t3.added === 0, JSON.stringify(t3));
let t4 = await run('creator', G); ok('sahip kapıdan muaf', t4.r.ok === true && t4.r.owner === true, JSON.stringify(t4).slice(0, 120));
// v14.7 KAPALI MOD (herkese açık sürüm kapalı): yalnız sahip ve sinyal grubu üyeleri girer; grup üyesinin cihazı onaylanır (canlı), üye kaydı yok
globalThis.__PUSULA_PUBLIC = false;
{ let appr = 0; const runK = async (grpSt, chk) => { let added = 0; appr = 0; globalThis.fetch = async () => ({ json: async () => ({ ok: true, result: { status: grpSt } }) });
    const req = { url: 'https://api.x/tgauth', text: async () => JSON.stringify({ d: make(TOK, Date.now() - 1000), dev: 'abcdefgh12', chk }) };
    const h = { json: (o) => o, kvGet: async () => ({ tgTok: TOK, chat: -1 }), ownerTok: async () => 'OWN', errAdd: async () => {}, uyeAdd: async () => { added++; }, devMember: async () => {}, devApprove: async () => { appr++; }, chanGate: async () => G };
    const r = await tgAuth(req, { ACCESS_KEY: 'K', BT: {} }, h); globalThis.fetch = realFetch; return { r, added, appr }; };
  const k1 = await runK('left'); ok('kapalı: grup dışından gelen giremez, kanal sorulmaz, kayıt yok', k1.r.ok === false && k1.r.kapali === 1 && !k1.r.kanal && k1.added === 0, JSON.stringify(k1));
  const k2 = await runK('member'); ok('kapalı: grup üyesi girer, cihazı onaylanır, üye kaydı yok', k2.r.ok === true && !k2.r.uye && k2.appr === 1 && k2.added === 0 && /^PUSULA\|/.test(k2.r.setup), JSON.stringify(k2));
  const k3 = await runK('left', 1); ok('kapalı: kontrol modunda da grup dışı reddedilir', k3.r.ok === false && k3.r.kapali === 1, JSON.stringify(k3));
  const k4 = await runK('creator'); ok('kapalı: sahip girer', k4.r.ok === true && k4.r.owner === true);
  const { tgBotUpdate, hookSecret } = await import(path.join(W, 'tgbot.js')); let sent = 0; globalThis.fetch = async () => { sent++; return { json: async () => ({ ok: true }) }; };
  const br = await tgBotUpdate(new Request('https://x/tgbot', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': await hookSecret(TOK) }, body: JSON.stringify({ message: { chat: { id: 5, type: 'private' }, from: { id: 5 }, text: '/start' } }) }), {}, { kvGet: async () => ({ tgTok: TOK }) });
  globalThis.fetch = realFetch; ok('kapalı: bot kimseye yanıt vermez', sent === 0 && br.status === 200, br.status + ' ' + sent); }
console.log('\nTELEGRAM UYGULAMASI: ' + res.filter(Boolean).length + '/' + res.length + ' geçti');
process.exit(res.every(Boolean) ? 0 : 1);
