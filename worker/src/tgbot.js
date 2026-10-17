// v12.2 (16.10 gece, Fatih: 'uygulamayı herkese açık hale getirelim') BOT KARŞILAMA
// Telegram bota gelen mesajları buraya (POST /tgbot, anahtarsız) gönderir; Telegram'ın 'secret_token' başlığı bot anahtarından türetilir (repoda sır yok).
// v12.4: 'my_chat_member' (bot bir kanalda yönetici oldu) → kanal.js kanalSet.
// Yalnız ÖZEL sohbet: '/start' ya da herhangi bir mesaj → kısa hoş geldin + '🧭 Pusula'yı aç' (web_app) düğmesi. Grup mesajlarına dokunulmaz.
// Webhook'u ana iş kendisi kurar (tgHookEnsure, meta 'tghook' = TGHOOK_V; sonuç meta 'tghook_res'). Yeniden kurmak için meta 'tghook'u sil.
import { kanalSet, pubCh, shareLink, SHARE_TXT } from './kanal.js';
import { tgAppLink } from './tgapp.js';
export const APP_URL = 'https://dealerfaltiner2.github.io/yeni-terminal/';
export const HOOK_URL = 'https://api.altinerpano.com/tgbot';
export const TGHOOK_V = '2';   // v12.4: kanala eklenme bildirimi (my_chat_member) de gelsin
export async function hookSecret(tok) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pusula-hook|' + tok));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}
export const WELCOME = '🧭 <b>BIST Pusula\'ya hoş geldin</b>   <i>tamamen ücretsiz</i>\n\n' +
  'Borsa İstanbul için ücretsiz piyasa pusulası: endeksin yönü, önemli KAP haberleri, hisse röntgeni ve geçmiş sinyallerin karnesi tek ekranda.\n\n' +
  'Ücret yok, kayıt yok. Aşağıdaki düğmeye bas, Pusula Telegram\'ın içinde açılır. Fiyatlar 15 dakika gecikmelidir.\n\n<i>Bilgi amaçlıdır, yatırım tavsiyesi değildir.</i>';
// v12.9: karşılamada kişinin kendi davet bağlantısı (startapp=r_<no> → üye kaydında 'kim getirdi') ve kanal varsa '📢 Kanala katıl'
export const welcomeKb = (uid, chUser) => {
  const kb = [[{ text: '🧭 Pusula\'yı aç', web_app: { url: APP_URL } }]];
  if (/^\d{3,15}$/.test(String(uid || ''))) kb.push([{ text: '👥 Arkadaşını davet et', url: shareLink(tgAppLink('r_' + uid), SHARE_TXT) }]);
  if (/^[A-Za-z0-9_]{4,32}$/.test(chUser || '')) kb.push([{ text: '📢 Kanala katıl', url: 'https://t.me/' + chUser }]);
  return { inline_keyboard: kb };
};
let lastAns = new Map();   // aynı kişiye 20 sn içinde ikinci yanıt yok (seri mesaja karşı)
// v12.6: iki bot aynı adrese bağlı — yeni @BistPusulaBot (env.TG_APP_TOKEN, via 'app') ve eski sinyal botu (cfg.tgTok, via 'old'); imza başlığı hangisininse yanıt onunla
async function botOf(request, env, h) {
  const cfg = await h.kvGet(env, 'cfg', null), sec = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  for (const [via, tok] of [['app', env.TG_APP_TOKEN], ['old', cfg && cfg.tgTok]]) if (tok && sec === await hookSecret(tok)) return { via, tok };
  return null;
}
export async function tgBotUpdate(request, env, h) {
  const bot = await botOf(request, env, h);
  if (!bot) return new Response('yetkisiz', { status: 401 });
  let u = null; try { u = await request.json(); } catch (e) { return new Response('ok'); }
  if (u && u.my_chat_member) {
    const m = u.my_chat_member;
    // v12.4a: iz — son kanal/grup üyelik bildirimi (teşhis için) ve hata
    try { if (env.BT) await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tg_mcm', ?)").bind(new Date().toISOString() + ' ' + JSON.stringify({ t: m.chat && m.chat.type, id: m.chat && m.chat.id, ti: m.chat && m.chat.title, st: m.new_chat_member && m.new_chat_member.status, post: m.new_chat_member && m.new_chat_member.can_post_messages })).run(); } catch (e) {}
    try { if (env.BT) await kanalSet(env, h, m, bot.via); }
    catch (e) { try { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('pubch_res', ?)").bind(new Date().toISOString() + ' HATA ' + String(e && e.message || e).slice(0, 200)).run(); } catch (e2) {} }
    return new Response('ok');
  }
  const m = u && u.message;
  if (!m || !m.chat || m.chat.type !== 'private' || !m.from || m.from.is_bot) return new Response('ok');
  const now = Date.now(), id = m.chat.id;
  if (now - (lastAns.get(id) || 0) < 20e3) return new Response('ok');
  if (lastAns.size > 500) lastAns = new Map();
  lastAns.set(id, now);
  let chUser = ''; try { if (env.BT) { const ch = await pubCh(env); chUser = (ch && ch.user) || ''; } } catch (e) {}
  try {
    await fetch('https://api.telegram.org/bot' + bot.tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: id, text: WELCOME, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: welcomeKb(m.from.id, chUser) }), signal: AbortSignal.timeout(8000) });
  } catch (e) {}
  return new Response('ok');
}
let hookOk = false, hookApp = false;
// v12.6: yeni botun webhook'u (meta 'tghook_app' = '1', sonuç 'tghook_app_res')
async function hookAppEnsure(env) {
  if (hookApp || !env.BT || !env.TG_APP_TOKEN) return null;
  const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'tghook_app'").first();
  if (r && r.v === '1') { hookApp = true; return null; }
  let j = null;
  try {
    j = await (await fetch('https://api.telegram.org/bot' + env.TG_APP_TOKEN + '/setWebhook', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: HOOK_URL, secret_token: await hookSecret(env.TG_APP_TOKEN), allowed_updates: ['message', 'my_chat_member'], drop_pending_updates: true }), signal: AbortSignal.timeout(8000) })).json();
  } catch (e) { j = { ok: false, description: String(e.message || e) }; }
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tghook_app_res', ?)").bind(new Date().toISOString() + ' ' + JSON.stringify(j).slice(0, 200)).run();
  if (j && j.ok) { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('tghook_app', '1')").run(); hookApp = true; }
  return j;
}
export async function tgHookEnsure(env, h) {
  try { await hookAppEnsure(env); } catch (e) {}
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
