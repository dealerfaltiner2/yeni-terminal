// v12.2 (16.10 gece, Fatih: 'uygulamayı herkese açık hale getirelim') BOT KARŞILAMA
// Telegram bota gelen mesajları buraya (POST /tgbot, anahtarsız) gönderir; Telegram'ın 'secret_token' başlığı bot anahtarından türetilir (repoda sır yok).
// v12.4: 'my_chat_member' (bot bir kanalda yönetici oldu) → kanal.js kanalSet.
// Yalnız ÖZEL sohbet: '/start' ya da herhangi bir mesaj → kısa hoş geldin + '🧭 Pusula'yı aç' (web_app) düğmesi. Grup mesajlarına dokunulmaz.
// Webhook'u ana iş kendisi kurar (tgHookEnsure, meta 'tghook' = TGHOOK_V; sonuç meta 'tghook_res'). Yeniden kurmak için meta 'tghook'u sil.
import { kanalSet } from './kanal.js';
export const APP_URL = 'https://dealerfaltiner2.github.io/yeni-terminal/';
export const HOOK_URL = 'https://api.altinerpano.com/tgbot';
export const TGHOOK_V = '2';   // v12.4: kanala eklenme bildirimi (my_chat_member) de gelsin
export async function hookSecret(tok) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pusula-hook|' + tok));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}
export const WELCOME = '🧭 <b>BIST Pusula\'ya hoş geldin</b>\n\n' +
  'Borsa İstanbul için piyasa pusulası: endeksin yönü, önemli KAP haberleri, hisse röntgeni ve geçmiş sinyallerin karnesi tek ekranda.\n\n' +
  'Aşağıdaki düğmeye bas, Pusula Telegram\'ın içinde açılır. Fiyatlar 15 dakika gecikmelidir.\n\n<i>Bilgi amaçlıdır, yatırım tavsiyesi değildir.</i>';
export const welcomeKb = () => ({ inline_keyboard: [[{ text: '🧭 Pusula\'yı aç', web_app: { url: APP_URL } }]] });
let lastAns = new Map();   // aynı kişiye 20 sn içinde ikinci yanıt yok (seri mesaja karşı)
export async function tgBotUpdate(request, env, h) {
  const cfg = await h.kvGet(env, 'cfg', null);
  if (!cfg || !cfg.tgTok) return new Response('yok', { status: 503 });
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== await hookSecret(cfg.tgTok)) return new Response('yetkisiz', { status: 401 });
  let u = null; try { u = await request.json(); } catch (e) { return new Response('ok'); }
  if (u && u.my_chat_member) { try { if (env.BT) await kanalSet(env, h, u.my_chat_member); } catch (e) {} return new Response('ok'); }
  const m = u && u.message;
  if (!m || !m.chat || m.chat.type !== 'private' || !m.from || m.from.is_bot) return new Response('ok');
  const now = Date.now(), id = m.chat.id;
  if (now - (lastAns.get(id) || 0) < 20e3) return new Response('ok');
  if (lastAns.size > 500) lastAns = new Map();
  lastAns.set(id, now);
  try {
    await fetch('https://api.telegram.org/bot' + cfg.tgTok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: id, text: WELCOME, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: welcomeKb() }), signal: AbortSignal.timeout(8000) });
  } catch (e) {}
  return new Response('ok');
}
let hookOk = false;
export async function tgHookEnsure(env, h) {
  if (hookOk || !env.BT) return null;
  const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'tghook'").first();
  if (r && r.v === TGHOOK_V) { hookOk = true; return null; }
  const cfg = await h.kvGet(env, 'cfg', null);
  if (!cfg || !cfg.tgTok) return null;
  let j = null;
  try {
    j = await (await fetch('https://api.telegram.org/bot' + cfg.tgTok + '/setWebhook', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: HOOK_URL, secret_token: await hookSecret(cfg.tgTok), allowed_updates: ['message', 'my_chat_member'], drop_pending_updates: true }), signal: AbortSignal.timeout(8000) })).json();
  } catch (e) { j = { ok: false, description: String(e.message || e) }; }
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tghook_res', ?)").bind(new Date().toISOString() + ' ' + JSON.stringify(j).slice(0, 200)).run();
  if (j && j.ok) { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tghook', ?)").bind(TGHOOK_V).run(); hookOk = true; }
  return j;
}
