// v11.7 (16.10, Fatih: 'Pusula Telegram mini uygulaması') — t.me/FatihBistSinyal2026Bot/pusula
// /tgauth (anahtarsız, POST {d: initData}): Telegram'ın imzaladığı kimlik bilgisini bot anahtarıyla doğrular (HMAC-SHA256, 24 saat geçerli).
// Sinyal grubunun KURUCUSU → sahip kurulum metni (sunucu adresi + ana cihaz kodu); v12.0: diğer HERKES → üye (gecikmeli veri, üye listesine kayıt).
export const TG_APP = 'https://t.me/FatihBistSinyal2026Bot/pusula';
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
export async function tgAuth(request, env, h) {
  // h = { json, kvGet, ownerTok, errAdd }
  let b = {}; try { b = JSON.parse((await request.text()) || '{}'); } catch (e) { return h.json({ ok: false, error: 'geçersiz istek' }, 400); }
  const cfg = await h.kvGet(env, 'cfg', null);
  if (!cfg || !cfg.tgTok || !cfg.chat) return h.json({ ok: false, error: 'Sunucuda Telegram ayarı yok' }, 500);
  const user = await tgInitCheck(b.d, cfg.tgTok);
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
  try { if (h.uyeAdd) await h.uyeAdd(env, user, grup); } catch (e) {}
  const dev = String(b.dev || '').toLowerCase();
  if (/^[a-z0-9]{8,32}$/.test(dev) && h.devMember) { try { await h.devMember(env, dev); } catch (e) {} }
  return h.json({ ok: true, owner: false, uye: true, setup: 'PUSULA|' + base + '|' });
}
