// v7.4 İŞ BİLGİSAYARI SİNYAL MOTORU — terminal "sunucu modu"nda (?bot=1) iş bilgisayarında sürekli çalışır.
// - Eşleştirme: ana cihaz /pair-create ile tek kullanımlık kod üretir (15 dk); Windows kurulumu /pair ile ayarları bir kez alır.
//   Kod 10 karakter (32 harfli alfabe → ~10^15 olasılık), kullanılınca silinir. Ayarlar repoya/koda yazılmaz.
// - Nabız: motor dakikada bir /hello?bot=1&own=… çağırır → meta 'bot_seen'. Herkesin hello yanıtında 'bot' (motor canlı mı) döner;
//   telefon, motor canlıyken aynı sinyalleri Telegram'a göndermez (çift bildirim olmasın).
// - Bekçi: seans içinde motor 5 dk ses vermezse Telegram uyarısı (bir kez), dönünce "yeniden çalışıyor".
import { errAdd } from './err.js';
const TRMS = 3 * 3600e3;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let seenCache = { at: 0, v: 0 }, lastWrite = 0;
const BOT_ALIVE_MS = 3 * 60e3;
export async function botSeen(env) {
  if (Date.now() - seenCache.at < 30e3) return seenCache.v;
  try { const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'bot_seen'").first(); seenCache = { at: Date.now(), v: r ? +r.v || 0 : 0 }; } catch (e) {}
  return seenCache.v;
}
export async function botAlive(env) { const v = await botSeen(env); return !!v && Date.now() - v < BOT_ALIVE_MS; }
export async function botBeat(env) {
  const now = Date.now();
  if (now - lastWrite < 45e3) return;
  lastWrite = now; seenCache = { at: now, v: now };
  try { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('bot_seen', ?)").bind(String(now)).run(); } catch (e) {}
}
// sahip: POST /pair-create  gövde {cfg:{...}} → {ok, code, exp}
export async function pairCreate(request, env, json) {
  let b = {};
  try { const t = await request.text(); if (t.length > 20000) return json({ ok: false, error: 'çok büyük' }, 413); b = JSON.parse(t || '{}'); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
  if (!b.cfg || typeof b.cfg !== 'object') return json({ ok: false, error: 'ayar yok' }, 400);
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  const code = [...rnd].map(x => ALPHA[x % 32]).join('');
  const exp = Date.now() + 15 * 60e3;
  await env.BT.prepare("DELETE FROM meta WHERE k LIKE 'pair:%' AND CAST(json_extract(v, '$.exp') AS INTEGER) < ?").bind(Date.now()).run();
  await env.BT.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind('pair:' + code, JSON.stringify({ exp, cfg: b.cfg })).run();
  return json({ ok: true, code: code.slice(0, 5) + '-' + code.slice(5), exp });
}
// anahtarsız: POST /pair  gövde {c:'ABCDE-FGHJK'} → {ok, cfg}  (tek kullanımlık)
export async function pairUse(request, env, json) {
  let b = {};
  try { b = JSON.parse((await request.text()) || '{}'); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
  const code = String(b.c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 10) return json({ ok: false, error: 'kod 10 karakter olmalı' }, 400);
  const r = await env.BT.prepare('SELECT v FROM meta WHERE k = ?').bind('pair:' + code).first();
  if (!r) { await errAdd(env, 'sunucu', 'hata', 'eşleştirme: geçersiz kod denendi', 'pair'); return json({ ok: false, error: 'kod geçersiz ya da kullanılmış' }, 404); }
  await env.BT.prepare('DELETE FROM meta WHERE k = ?').bind('pair:' + code).run();
  let v = {}; try { v = JSON.parse(r.v); } catch (e) {}
  if (!v.exp || Date.now() > v.exp) return json({ ok: false, error: 'kodun süresi doldu, telefondan yeni kod al' }, 410);
  await errAdd(env, 'sunucu', 'toparlama', 'iş bilgisayarı motoru eşleştirildi', 'pair');
  return json({ ok: true, cfg: v.cfg });
}
// cron: seans içinde motor sustuysa bir kez uyar, dönünce haber ver
export async function botWatch(env, tgSend, kvGet) {
  const d = new Date(Date.now() + TRMS), wd = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  const seen = await botSeen(env);
  if (!seen) return null;                                   // motor hiç kurulmadıysa sessiz
  const sess = wd >= 1 && wd <= 5 && m >= 605 && m < 1075;  // 10:05–17:55
  const a = await env.BT.prepare("SELECT v FROM meta WHERE k = 'bot_alert'").first();
  const quiet = Date.now() - seen > 5 * 60e3;
  if (sess && quiet && !a) {
    const cfg = await kvGet(env, 'cfg', null);
    const mins = Math.round((Date.now() - seen) / 60e3);
    const r = await tgSend(cfg, '⚠️ <b>İş bilgisayarındaki sinyal motoru ' + mins + ' dakikadır ses vermiyor.</b>\nAlgı ve Fırsat sinyalleri şu an yalnız telefonda terminal açıkken gelir. Bilgisayar kapanmış, oturum kapanmış ya da internet kesilmiş olabilir. (Sunucu radarı ve KAP etkilenmez.)');
    if (r && r.ok) await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('bot_alert', ?)").bind(String(Date.now())).run();
    await errAdd(env, 'sunucu', 'hata', 'iş bilgisayarı motoru sessiz', 'botWatch');
    return { uyari: true };
  }
  if (a && !quiet) {
    await env.BT.prepare("DELETE FROM meta WHERE k = 'bot_alert'").run();
    if (sess) { const cfg = await kvGet(env, 'cfg', null); await tgSend(cfg, '✅ İş bilgisayarındaki sinyal motoru yeniden çalışıyor.'); }
    return { geri: true };
  }
  return null;
}
