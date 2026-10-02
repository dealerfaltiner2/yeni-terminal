// v8.2 iPHONE BİLDİRİMLERİ (Web Push, RFC 8291 aes128gcm + VAPID RFC 8292) — dış kütüphane yok, yalnız WebCrypto.
// Anahtar: D1 meta 'vapid' = özel JWK (d,x,y) — repoda YOK. Abonelikler: D1 tablo push (ep PK, p256dh, auth, dev, cats, t).
// cats: virgüllü kategori listesi (algi, momentum, firsat, kap, poz, tavan, rapor). Boşsa hepsi.
const te = new TextEncoder();
const b64u = b => { let s = ''; const a = new Uint8Array(b); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const ub64 = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const cat = (...a) => { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const hmac = async (key, data) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data));

// Şifreleme (test edilebilir olsun diye tuz ve geçici anahtar dışarıdan verilebilir)
export async function encrypt(payload, p256dh, auth, opt = {}) {
  const ua = ub64(p256dh), au = ub64(auth);
  const eph = opt.eph || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(au, shared);
  const ikm = (await hmac(prkKey, cat(te.encode('WebPush: info\0'), ua, asPub, new Uint8Array([1])))).slice(0, 32);
  const salt = opt.salt || crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
export async function vapidKeys(env) {
  const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'vapid'").first();
  if (r) return JSON.parse(r.v);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const v = { jwk, pub };
  await env.BT.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('vapid', ?)").bind(JSON.stringify(v)).run();
  const again = await env.BT.prepare("SELECT v FROM meta WHERE k = 'vapid'").first();
  return again ? JSON.parse(again.v) : v;
}
export async function vapidAuth(v, endpoint) {
  const aud = new URL(endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:pusula@altinerpano.com' })));
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + p));
  return 'vapid t=' + h + '.' + p + '.' + b64u(sig) + ', k=' + v.pub;
}
export async function pushEnsure(env) {
  await env.BT.prepare('CREATE TABLE IF NOT EXISTS push (ep TEXT PRIMARY KEY, p256dh TEXT, auth TEXT, dev TEXT, cats TEXT, t INTEGER, fail INTEGER DEFAULT 0)').run();
}
// Gönder: msg = {title, body, url, tag, cat}. Aboneliği silinmiş (404/410) cihazlar tablodan çıkarılır.
export async function pushSend(env, msg, max = 6) {
  if (!env.BT) return { ok: false };
  await pushEnsure(env);
  const subs = (await env.BT.prepare('SELECT ep, p256dh, auth, cats FROM push LIMIT 10').all()).results || [];
  if (!subs.length) return { ok: true, n: 0 };
  const v = await vapidKeys(env);
  const body = JSON.stringify({ title: msg.title || 'BIST Pusula', body: msg.body || '', url: msg.url || './', tag: msg.tag || '' });
  let n = 0, err = '';
  for (const s of subs.slice(0, max)) {
    if (msg.cat && s.cats && !String(s.cats).split(',').includes(msg.cat)) continue;
    try {
      const enc = await encrypt(body, s.p256dh, s.auth);
      const r = await fetch(s.ep, { method: 'POST', headers: { Authorization: await vapidAuth(v, s.ep), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '900', Urgency: 'high' }, body: enc, signal: AbortSignal.timeout(6000) });
      if (r.status === 404 || r.status === 410) await env.BT.prepare('DELETE FROM push WHERE ep = ?').bind(s.ep).run();
      else if (!r.ok) err = 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 80);
      else n++;
    } catch (e) { err = String(e && e.message || e).slice(0, 100); }
  }
  if (err) try { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('push_err', ?)").bind(new Date().toISOString() + ' ' + err).run(); } catch (e) {}
  return { ok: true, n, err };
}
// Yollar
export async function pushRoute(sub, request, env, url, json) {
  await pushEnsure(env);
  if (sub === 'push-key') return json({ ok: true, key: (await vapidKeys(env)).pub });
  if (sub === 'push-sub' && request.method === 'POST') {
    let b; try { b = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
    const ep = String(b.endpoint || ''), k = b.keys || {};
    if (!/^https:\/\//.test(ep) || !k.p256dh || !k.auth) return json({ ok: false, error: 'abonelik eksik' }, 400);
    const cats = Array.isArray(b.cats) ? b.cats.filter(x => /^[a-z]{2,10}$/.test(x)).join(',') : '';
    await env.BT.prepare('INSERT OR REPLACE INTO push (ep, p256dh, auth, dev, cats, t, fail) VALUES (?, ?, ?, ?, ?, ?, 0)').bind(ep, String(k.p256dh), String(k.auth), String(url.searchParams.get('dev') || '').slice(0, 32), cats, Date.now()).run();
    return json({ ok: true });
  }
  if (sub === 'push-off' && request.method === 'POST') {
    let b = {}; try { b = JSON.parse(await request.text()); } catch (e) {}
    await env.BT.prepare('DELETE FROM push WHERE ep = ?').bind(String(b.endpoint || '')).run();
    return json({ ok: true });
  }
  if (sub === 'push-send' && request.method === 'POST') {
    let b = {}; try { b = JSON.parse(await request.text()); } catch (e) {}
    return json(await pushSend(env, { title: String(b.title || '').slice(0, 80), body: String(b.body || '').slice(0, 300), url: String(b.url || './').slice(0, 200), tag: String(b.tag || '').slice(0, 40), cat: String(b.cat || '').slice(0, 10) }));
  }
  return json({ ok: false, error: 'bilinmeyen' }, 404);
}
