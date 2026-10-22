// v11.7 (16.10, Fatih: 'Pusula Telegram mini uygulaması') — t.me/FatihBistSinyal2026Bot/pusula
// /tgauth (anahtarsız, POST {d: initData}): Telegram'ın imzaladığı kimlik bilgisini bot anahtarıyla doğrular (HMAC-SHA256, 24 saat geçerli).
// Sinyal grubunun KURUCUSU → sahip kurulum metni (sunucu adresi + ana cihaz kodu); v12.0: diğer HERKES → üye (gecikmeli veri, üye listesine kayıt).
// v12.6 (17.10): uygulama yeni, aranabilir bota taşındı — @BistPusulaBot (ana mini uygulama: t.me/BistPusulaBot?startapp=…).
// Eski @FatihBistSinyal2026Bot sinyal grubunda kalır; eski bağlantılarla açılan uygulama da çalışır (iki anahtar denenir).
export const TG_APP = 'https://t.me/BistPusulaBot';
export const tgAppLink = p => TG_APP + '?startapp' + (p ? '=' + p : '');
const enc = new TextEncoder();
const hmac = async (key, data) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(data)));
export async function tgInitCheck(initData, botToken, now = Date.now(), maxAge = 86400) {
  if (!initData || !botToken) return null;
  const p = new URLSearchParams(String(initData)), hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const dcs = [...p.entries()].map(([k, v]) => k + '=' + v).sort().join('\n');
  const secret = await hmac('WebAppData', botToken);
  const calc = [...await hmac(secret, dcs)].map(b => b.toString(16).padStart(2, '0')).join('');
  if (calc !== hash) return null;
  const ad = +p.get('auth_date') * 1000;
  if (!(ad > 0) || now - ad > maxAge * 1000) return null;
  let user = null; try { user = JSON.parse(p.get('user') || 'null'); } catch (e) {}
  return user && user.id ? user : null;
}
// v13.8 (21.10, Fatih onayıyla: 'mecburi takip edenlere verelim, üye toplarız') KANAL KAPISI:
// sahip ve sinyal grubu üyesi dışındaki herkes Pusula'yı açmak için kanala (meta 'pubch') katılmış olmalı.
// Kontrol kanalı yöneten botla (pubch.via 'app' → TG_APP_TOKEN, yoksa eski bot) getChatMember. Kanal kayıtlı değilse ya da Telegram yanıt vermezse KAPI AÇIK (kimse dışarıda kalmasın).
export const chanJoined = st => st === 'member' || st === 'administrator' || st === 'creator' || st === 'restricted';
export async function tgChanGate(env, cfg, uid, fetchFn = fetch) {
  let ch = null; try { const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'pubch'").first(); if (m) ch = JSON.parse(m.v); } catch (e) {}
  if (!ch || !ch.id) return null;
  const tok = ch.via === 'app' ? (env.TG_APP_TOKEN || cfg.tgTok) : cfg.tgTok;
  try {
    const r = await fetchFn('https://api.telegram.org/bot' + tok + '/getChatMember?chat_id=' + encodeURIComponent(ch.id) + '&user_id=' + uid, { signal: AbortSignal.timeout(6000) });
    const j = await r.json(); if (!j || !j.ok || !j.result) return null;
    if (chanJoined(j.result.status)) return null;
  } catch (e) { return null; }
  return { url: ch.user ? 'https://t.me/' + ch.user : '', title: ch.title || 'BIST Pusula' };
}
// v14.7 (22.10 gece, Fatih: 'diğer botu kapatalım, yalnız 3 kişilik grubumuz kalsın' → 'Hepsini kapat'):
// HERKESE AÇIK SÜRÜM KAPALI — @BistPusulaBot yanıt vermez, kanala zamanlanmış paylaşım gitmez, grup dışındakiler Pusula'yı açamaz,
// eski üye cihazları (dev.ok = 2) veri alamaz. Grup üyeleri Telegram'dan girince cihazları onaylanır (canlı veri). Yeniden açmak: true yap.
export const PUBLIC_OPEN = false;
export const pubOpen = () => PUBLIC_OPEN || globalThis.__PUSULA_PUBLIC === true;   // testler açık modu da sınar
export const KAPALI_MSG = 'Pusula şu an yalnız özel grubumuza açık.';
export async function tgAuth(request, env, h) {
  // h = { json, kvGet, ownerTok, errAdd }
  let b = {}; try { b = JSON.parse((await request.text()) || '{}'); } catch (e) { return h.json({ ok: false, error: 'geçersiz istek' }, 400); }
  const cfg = await h.kvGet(env, 'cfg', null);
  if (!cfg || !cfg.tgTok || !cfg.chat) return h.json({ ok: false, error: 'Sunucuda Telegram ayarı yok' }, 500);
  let user = null;
  for (const tok of [env.TG_APP_TOKEN, cfg.tgTok].filter(Boolean)) { user = await tgInitCheck(b.d, tok); if (user) break; }
  if (!user) return h.json({ ok: false, error: 'Telegram kimliği doğrulanamadı. Pusula\'yı kapatıp yeniden aç.' }, 401);
  let st = '';
  try {
    const r = await fetch('https://api.telegram.org/bot' + cfg.tgTok + '/getChatMember?chat_id=' + encodeURIComponent(cfg.chat) + '&user_id=' + user.id, { signal: AbortSignal.timeout(8000) });
    const j = await r.json(); st = j && j.ok && j.result ? j.result.status : '';
  } catch (e) {}
  const host = new URL(request.url).host, base = 'wss://' + host + '/' + env.ACCESS_KEY;
  if (st === 'creator') {
    const own = await h.ownerTok(env);
    // sahibin bu cihazı kendiliğinden onaylı (yoksa ilk veri isteğinde 'ana cihazın onayını bekliyor' kalıyordu)
    const dev = String(b.dev || '').toLowerCase();
    if (/^[a-z0-9]{8,32}$/.test(dev) && h.devApprove) { try { await h.devApprove(env, dev); } catch (e) {} }
    try { await h.errAdd(env, 'sunucu', 'toparlama', 'Telegram mini uygulaması: sahip girişi', 'tgauth'); } catch (e) {}
    return h.json({ ok: true, owner: true, setup: 'PUSULA|' + base + '|' + (own || '') });
  }
  // v12.0 (16.10, Fatih: 'giren herkes üye olsun, amaç üye toplamak'): sahip dışındaki HERKES üye — üye listesine yazılır,
  // cihazı 'üye' (dev.ok = 2) olur: tüm ekranlar açık ama fiyatlar 15 dk gecikmeli (sahibin TradingView oturumu KULLANILMAZ).
  // Sahip, Ayarlar → bağlı cihazlar'dan bir üyeyi canlı veriye yükseltebilir (dev.ok = 1).
  const grup = st === 'administrator' || st === 'member' || st === 'restricted';
  if (!pubOpen()) {
    if (!grup) return h.json({ ok: false, kapali: 1, error: KAPALI_MSG }, 403);
    if (b.chk) return h.json({ ok: true, kanal: null });
    const dv = String(b.dev || '').toLowerCase();
    if (/^[a-z0-9]{8,32}$/.test(dv) && h.devApprove) { try { await h.devApprove(env, dv); } catch (e) {} }
    return h.json({ ok: true, owner: false, setup: 'PUSULA|' + base + '|' });
  }
  // v13.8 kanal kapısı (grup üyeleri muaf); b.chk = yalnız kontrol (uygulama her açılışta bir kez sorar, kayıt yapmaz)
  const gate = grup ? null : await (h.chanGate || tgChanGate)(env, cfg, user.id);
  if (gate) return h.json({ ok: false, kanal: gate, error: 'Pusula\'yı kullanmak için önce kanala katıl.' });
  if (b.chk) return h.json({ ok: true, kanal: null });
  // v12.4: nereden geldi? startapp=r_<davet eden no> (davet bağlantısı) ya da k_<etiket> (kanal mesajı) — yalnız ilk kayıtta yazılır
  let ref = ''; try { const sp = new URLSearchParams(String(b.d)).get('start_param') || ''; if (/^(r_\d{3,15}|k_[a-z0-9]{1,16})$/.test(sp) && sp !== 'r_' + user.id) ref = sp; } catch (e) {}
  try { if (h.uyeAdd) await h.uyeAdd(env, user, grup, ref); } catch (e) {}
  const dev = String(b.dev || '').toLowerCase();
  if (/^[a-z0-9]{8,32}$/.test(dev) && h.devMember) { try { await h.devMember(env, dev); } catch (e) {} }
  return h.json({ ok: true, owner: false, uye: true, setup: 'PUSULA|' + base + '|' });
}
