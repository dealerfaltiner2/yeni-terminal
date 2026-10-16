// v12.2 bot karşılama: imza başlığı, yalnız özel sohbet, web_app düğmesi
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker', 'src');
const { tgBotUpdate, hookSecret, tgHookEnsure, APP_URL } = await import(path.join(W, 'tgbot.js'));
const res = []; const ok = (n, c, i) => { res.push(!!c); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
const TOK = '123456:TEST-token', env = {}, h = { kvGet: async () => ({ tgTok: TOK, chat: '-100' }) };
const sent = []; globalThis.fetch = async (url, o) => { sent.push({ url: String(url), body: o && o.body ? JSON.parse(o.body) : null }); return new Response(JSON.stringify({ ok: true })); };
const sec = await hookSecret(TOK);
ok('gizli başlık sabit ve Telegram kurallarına uygun', sec === await hookSecret(TOK) && /^[0-9a-f]{48}$/.test(sec) && sec !== await hookSecret('9:x'));
const req = (body, s) => new Request('https://x/tgbot', { method: 'POST', headers: s ? { 'X-Telegram-Bot-Api-Secret-Token': s } : {}, body: JSON.stringify(body) });
const msg = (type, id, text) => ({ update_id: 1, message: { message_id: 1, chat: { id, type }, from: { id, is_bot: false, first_name: 'A' }, text } });
let r = await tgBotUpdate(req(msg('private', 5, '/start'), 'yanlis'), env, h);
ok('yanlış imzalı istek reddedildi, mesaj gitmedi', r.status === 401 && sent.length === 0);
r = await tgBotUpdate(req(msg('private', 5, '/start'), sec), env, h);
const m = sent[0] && sent[0].body;
ok('özel sohbette /start → hoş geldin + Pusula\'yı aç (web_app) düğmesi', r.status === 200 && m && m.chat_id === 5 && /hoş geldin/.test(m.text) && m.reply_markup.inline_keyboard[0][0].web_app.url === APP_URL, JSON.stringify(m && m.reply_markup));
ok('mesajda AL/hedef/stop yok, yatırım tavsiyesi notu var', !/hedef|stop|\bAL\b/i.test(m.text) && /yatırım tavsiyesi değildir/.test(m.text));
await tgBotUpdate(req(msg('private', 5, 'merhaba'), sec), env, h);
ok('aynı kişiye 20 sn içinde ikinci yanıt yok', sent.length === 1);
await tgBotUpdate(req(msg('supergroup', -100, '/start'), sec), env, h);
ok('grup mesajına yanıt yok', sent.length === 1);
// webhook kurulumu: meta yoksa bir kez setWebhook, sonra atlanır
const meta = {}; const D1 = { prepare: q => ({ bind: (...a) => ({ run: async () => { if (/INSERT/.test(q)) meta[/'(\w+)'/.exec(q)[1]] = a[0]; }, first: async () => null }), first: async () => (meta.tghook ? { v: meta.tghook } : null) }) };
sent.length = 0; await tgHookEnsure({ BT: D1 }, h); await tgHookEnsure({ BT: D1 }, h);
ok('webhook bir kez kuruldu (gizli başlıkla, yalnız mesajlar)', sent.length === 1 && /setWebhook$/.test(sent[0].url) && sent[0].body.secret_token === sec && sent[0].body.allowed_updates[0] === 'message' && meta.tghook === '1', JSON.stringify(sent.map(x => x.url)));
console.log('\nBOT KARŞILAMA: ' + res.filter(Boolean).length + '/' + res.length + ' geçti');
process.exit(res.every(Boolean) ? 0 : 1);
