// Pozisyon asistanı + bildirim şifrelemesi testleri (sunucu kodu, ağ yok)
import { posRoute, posWatch } from '../worker/src/pos.js';
import { encrypt } from '../worker/src/push.js';
import crypto from 'crypto';
let pass = 0, fail = 0; const ok = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '✓ ' : '✗ ') + n + (i ? ' — ' + i : '')); };
const meta = new Map();
const env = { BT: { prepare: q => ({ _q: q, _b: [], bind(...a) { return Object.assign(Object.create(this), { _b: a }); },
  async first() { const k = (this._q.match(/k = '([^']+)'/) || [])[1]; return meta.has(k) ? { v: meta.get(k) } : null; },
  async run() { const m = this._q.match(/VALUES \('([^']+)', \?\)/); if (m) meta.set(m[1], this._b[0]); return {}; } }) } };
const json = (o, st = 200) => ({ st, o });
const req = b => ({ method: 'POST', text: async () => JSON.stringify(b) });
let r = await posRoute(req({ op: 'add', id: 'p1', sym: 'THYAO', e: 100, sp: 98, tp: 103 }), env, json);
ok('pozisyon eklendi', r.o.ok && r.o.list.length === 1);
r = await posRoute(req({ op: 'add', id: 'p2', sym: 'ASELS', e: 50, sp: 51 }), env, json);
ok('stop girişin üstündeyse reddedilir', !r.o.ok);
const sent = []; let price = 101.2;
const h = { scanRaw: async () => ({ json: async () => ({ data: [{ s: 'BIST:THYAO', d: ['THYAO', price] }] }) }), kvGet: async () => ({}), esc: s => s,
  tgSend: async (c, m) => { sent.push(m); return { ok: true }; }, pushSend: async () => ({}) };
const real = Date.now; Date.now = () => Date.UTC(2026, 9, 5, 9, 0); // 12:00 TR, pazartesi
await posWatch(env, h); ok('+%1 → "stopu girişe çek" uyarısı', sent.length === 1 && /stopu giriş/i.test(sent[0]), sent[0]);
await posWatch(env, h); ok('aynı uyarı tekrar gelmez', sent.length === 1);
price = 103.1; await posWatch(env, h); ok('hedef gelince uyarı + izleme biter', sent.length === 2 && /hedef geldi/.test(sent[1]) && JSON.parse(meta.get('pos')).length === 0);
await posRoute(req({ op: 'add', id: 'p3', sym: 'THYAO', e: 100, sp: 98 }), env, json); price = 98.2;
await posWatch(env, h); ok('stopa %0,3 kala uyarı', /stopa çok yakın/.test(sent[2] || ''), sent[2]);
Date.now = () => Date.UTC(2026, 9, 5, 14, 46); price = 99; await posWatch(env, h); ok('17:46 kapanış hatırlatması', /Kapanışa 15 dakika/.test(sent[3] || ''), sent[3]);
Date.now = () => Date.UTC(2026, 9, 5, 15, 20); await posWatch(env, h); ok('18:20 sonrası liste temizlenir', JSON.parse(meta.get('pos')).length === 0);
Date.now = real;
// bildirim şifrelemesi: kendi çözücümüzle geri aç (RFC 8291)
const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
const enc = Buffer.from(await encrypt('merhaba', ua.getPublicKey().toString('base64url'), auth.toString('base64url')));
const salt = enc.subarray(0, 16), idl = enc[20], asPub = enc.subarray(21, 21 + idl), ct = enc.subarray(21 + idl);
const shared = ua.computeSecret(asPub), H = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
const ikm = H(H(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub, Buffer.from([1])]));
const prk = H(salt, ikm), cek = H(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16), nonce = H(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
const dc = crypto.createDecipheriv('aes-128-gcm', cek, nonce); dc.setAuthTag(ct.subarray(ct.length - 16));
const pt = Buffer.concat([dc.update(ct.subarray(0, ct.length - 16)), dc.final()]);
ok('iPhone bildirimi şifrelemesi çözülebiliyor', pt.subarray(0, pt.length - 1).toString() === 'merhaba' && pt[pt.length - 1] === 2);
console.log(`POZİSYON+BİLDİRİM: ${pass}/${pass + fail} geçti`); process.exit(fail ? 1 : 0);
