// v14.16 (25.10, Fatih: 'alt menüye Yapay zekâ seçtikleri; sistem verilerine göre çıkan hisseler, seans içinde yenilensin') — YALNIZ GÖRÜNÜM + SESSİZ ÖLÇÜM.
// Listeyi SİSTEMİN KENDİ VERİSİ seçer (yeni sinyal kuralı yok): bugünün karnede en iyi duran kaynakları + o anki hacim. Yapay zekâ yalnız 'neden listede' cümlesini yazar.
// Puan: seans içi geri alım 3 · Momentum 3 (tekrar −1) · Algı Telegram'a giden 2 / güçlü 1 · Fırsat A 1 · şu an hacimle yükseliyor 1. En az 2 puan, en az bir sinyal kaynağı.
// Elenir: tavana ya da tabana kilitli (±%9,5), Borsa tedbiri, ilk sinyalden −%1 düşmüş (stop) ya da +%3 koşmuş (geç). Listede olan YERİNDE KALIR (stop gelene kadar); boş yere en yüksek puanlı girer, en çok 8.
// Listeye giren her hisse karneye src 'aisec' (sessiz: Telegram/karne mesajı yok; Karne ekranı + bot yarışı). Giriş fiyatı = listeye girdiği andaki fiyat.
// Akış: Ana sunucu (yoksa ana cihaz) 10 dk'da bir POST /aisec-set {q: {SYM: [fiyat, değişim%, göreli hacim, işlem TL]}} → meta 'aisec'. Telefonlar GET /aisec (DATA).
// Dakikalık işe sorgu YOK. Yeni giren hisselerin notu Workers AI (aiyorum.js kotası ai_n ortak), yazamazsa düz cümle.
import { AI_MODEL, AI_MAX, aiBadSentences, aiClean, aiText } from './aiyorum.js';
import { sigAdd } from './sig.js';

export const AISEC_MAX = 8;
const TRMS = 3 * 3600e3;
const trDay = t => new Date(t + TRMS).toISOString().slice(0, 10);
const trMin = t => { const d = new Date(t + TRMS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const AISEC_K = {
  geri: { ad: 'Geri alım', uzun: 'şirket seans içinde kendi hissesini geri aldığını KAP\'a bildirdi' },
  mom: { ad: 'Momentum', uzun: 'Momentum taraması seçti (dün ve son 5 gün güçlü, sabah sakin)' },
  tk: { ad: 'Tekrar', uzun: 'Momentum bu hisseyi son günlerde de seçmişti' },
  algt: { ad: 'Güçlü Algı', uzun: 'Algı radarı güçlü ateşledi (alıcılar baskın, hacim normalin en az 2 katı, endeks artıdaydı)' },
  alg: { ad: 'Algı', uzun: 'Algı radarı ateşledi (alıcılar baskın)' },
  fa: { ad: 'Fırsat A', uzun: 'Fırsat taraması A notu verdi' },
  hac: { ad: 'Hacim', uzun: 'şu an normalin üstünde hacimle yükseliyor' }
};
const metaOf = r => { try { return typeof r.meta === 'string' ? JSON.parse(r.meta) || {} : r.meta || {}; } catch (e) { return {}; } };
const qOf = (q, s) => { const a = q && q[s]; return Array.isArray(a) && +a[0] > 0 ? { px: +a[0], ch: a[1] == null ? null : +a[1], rv: a[2] == null ? null : +a[2], vol: +a[3] || 0 } : null; };
export const isMover = x => !!x && x.vol >= 1e7 && x.ch != null && x.ch >= 3 && x.ch < 9.5 && (x.rv || 0) >= 1.5;

// Saf fonksiyon (test edilir). rows: bugünün sig satırları (t artan), q: anlık veri, prev: bugünkü önceki liste {list,out}, tb: Borsa tedbiri {SYM:…}
export function aisecPick(rows, q, prev, tb, now) {
  prev = prev || {}; tb = tb || {};
  const C = new Map();
  for (const r of rows || []) {
    if (r.dir && r.dir !== 'AL') continue;
    const m = metaOf(r); let k = null, w = 0;
    if (r.src === 'kap-geri') { if (m.g !== 1) continue; k = 'geri'; w = 3; }
    else if (r.src === 'momentum') { k = 'mom'; w = 3; }
    else if (r.src === 'algi') { if (m.tg === 1) { k = 'algt'; w = 2; } else if (+m.fc >= 0.8) { k = 'alg'; w = 1; } else continue; }
    else if (r.src === 'firsat-A') { k = 'fa'; w = 1; }
    else continue;
    const c = C.get(r.sym) || { s: r.sym, k: new Set(), w: {}, px0: null, t0: r.t };
    if (!(k in c.w)) c.w[k] = w;
    c.k.add(k); if (k === 'mom' && m.tk === 1) c.k.add('tk');
    if (c.px0 == null && r.px > 0) c.px0 = +r.px;
    C.set(r.sym, c);
  }
  const score = c => { let s = 0; for (const k of c.k) s += c.w[k] || 0; if (c.k.has('alg') && c.k.has('algt')) s -= 1; if (c.k.has('tk')) s -= 1; return s; };
  const out = (prev.out || []).slice(), outS = new Set(out.map(x => x.s)), list = [];
  const late = trMin(now) >= 1050;   // 17:30'dan sonra yeni giriş yok
  // 1) listede olanlar yerinde kalır; stop gelirse çıkar
  for (const e of prev.list || []) {
    const x = qOf(q, e.s), c = C.get(e.s);
    if (x && x.px <= e.px * 0.99) { out.push({ s: e.s, px: e.px, t: e.t, at: now, why: 'stop', p: +((x.px / e.px - 1) * 100).toFixed(2) }); outS.add(e.s); continue; }
    if (x && x.ch != null && x.ch <= -9.5) { out.push({ s: e.s, px: e.px, t: e.t, at: now, why: 'taban', p: +((x.px / e.px - 1) * 100).toFixed(2) }); outS.add(e.s); continue; }   // v14.20: tabana kilitli → çıkar
    const n = { ...e };
    if (c) { const ks = new Set([...(e.k || []).filter(k => k !== 'hac'), ...c.k]); if (isMover(x)) ks.add('hac'); n.k = [...ks]; n.sc = score({ k: ks, w: { ...c.w, hac: 1 } }); }
    if (x) { n.now = x.px; n.p = +((x.px / e.px - 1) * 100).toFixed(2); if (x.px >= e.px * 1.03) n.hit = 1; }
    list.push(n);
  }
  // 2) boş yer varsa yeni adaylar (puana göre)
  const have = new Set(list.map(e => e.s)), cand = [];
  if (!late) for (const c of C.values()) {
    if (have.has(c.s) || outS.has(c.s) || tb[c.s]) continue;
    const x = qOf(q, c.s); if (!x) continue;
    if (x.ch != null && (x.ch >= 9.5 || x.ch <= -9.5)) continue;        // tavana ya da tabana kilitli (v14.20: taban da)
    if (c.px0 && (x.px <= c.px0 * 0.99 || x.px >= c.px0 * 1.03)) continue; // sinyalden sonra stop ya da hedef çoktan geldi → geç
    if (isMover(x)) { c.k.add('hac'); c.w.hac = 1; }
    const sc = score(c); if (sc < 2) continue;
    cand.push({ s: c.s, sc, k: [...c.k], px: x.px, t: now, now: x.px, p: 0, t0: c.t0, ch: x.ch, rv: x.rv });
  }
  cand.sort((a, b) => b.sc - a.sc || a.t0 - b.t0);
  const neu = cand.slice(0, Math.max(0, AISEC_MAX - list.length));
  return { list: list.concat(neu), out: out.slice(-40), neu };
}

export function aisecPlain(e) {
  const L = (e.k || []).filter(k => k !== 'tk' && AISEC_K[k]).map(k => AISEC_K[k].uzun);
  let t = L.length ? L[0][0].toUpperCase() + L[0].slice(1) + (L.length > 1 ? '; ayrıca ' + L.slice(1).join(', ') : '') + '.' : 'Bugünün sinyallerinden seçildi.';
  if ((e.k || []).includes('tk')) t += ' Momentum bu hisseyi son günlerde de seçmişti, tekrar edenler daha zayıf.';
  return t;
}
const AISEC_SYS = [
  "Sen 'Pusula' adlı Borsa İstanbul terminalinin yorumcususun. Sistemin bugün listeye aldığı bir hisse için 'neden listede' sorusunu cevaplıyorsun.",
  'TEK cümle yaz, en çok 30 kelime. YALNIZ verilen bilgileri kullan, veride olmayan sayı, haber ya da olay UYDURMA.',
  'Al ya da sat tavsiyesi verme, fiyat tahmini yapma. Başlık, emoji, madde işareti, kalın yazı kullanma.',
  'Rakamları verideki gibi AYNEN rakamla yaz (örneğin +4,2% ya da 2,3 kat). Sayıyı yazıyla yazma. Sade Türkçe kullan.'
].join('\n');
const r2 = v => String(Math.round(v * 100) / 100).replace('.', ',');
export function aisecFacts(e) {
  const L = ['Hisse: ' + e.s, 'Listeye alınma nedenleri: ' + (e.k || []).filter(k => AISEC_K[k]).map(k => AISEC_K[k].uzun).join('; ')];
  if (e.ch != null) L.push('Bugünkü değişim: ' + (e.ch >= 0 ? '+' : '') + r2(e.ch) + '%');
  if (e.rv != null) L.push('Hacim normalin ' + r2(e.rv) + ' katı');
  return L;
}
async function aiNote(env, e) {
  if (!env.AI || typeof env.AI.run !== 'function') return null;
  const lines = aisecFacts(e);
  const r = await env.AI.run(AI_MODEL, { messages: [{ role: 'system', content: AISEC_SYS }, { role: 'user', content: lines.join('\n') }], max_tokens: 120, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } });
  let t = aiClean(aiText(r)).replace(/\n+/g, ' ');
  const chk = aiBadSentences(t, lines);
  if (chk.bad.length) t = chk.S.filter((_, i) => !chk.bad.includes(i)).join(' ').trim();
  if (t.length < 25) return null;
  if (t.length > 260) { const i = t.lastIndexOf('.', 260); t = t.slice(0, i > 60 ? i + 1 : 260); }
  return t;
}

let cache = { at: 0, v: null };
export async function aisecSet(request, env, json, now = Date.now()) {
  if (!env.BT) return json({ ok: false, error: 'D1 yok' }, 500);
  const txt = await request.text();
  if (txt.length > 80000) return json({ ok: false, error: 'çok büyük' }, 413);
  let b = null; try { b = JSON.parse(txt); } catch (e) { return json({ ok: false, error: 'geçersiz' }, 400); }
  const q = b && typeof b.q === 'object' && b.q ? b.q : {};
  const wd = new Date(now + TRMS).getUTCDay(), m = trMin(now), d = trDay(now);
  if (wd < 1 || wd > 5 || m < 600 || m >= 1085) return json({ ok: true, skip: 'seans dışı' });
  let prev = null; try { const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'aisec'").first(); prev = r ? JSON.parse(r.v) : null; } catch (e) {}
  if (prev && prev.d !== d) prev = null;
  if (prev && now - prev.at < 8 * 60e3 && !(b && b.force)) return json({ ok: true, skip: 'erken', at: prev.at });
  const d0 = Date.parse(d + 'T00:00:00Z') - TRMS;
  const rows = (await env.BT.prepare("SELECT t, src, sym, dir, px, meta FROM sig INDEXED BY sig_t WHERE t >= ? AND src IN ('algi','firsat-A','momentum','kap-geri') ORDER BY t ASC LIMIT 400").bind(d0).all()).results || [];
  let tb = {}; try { const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'tedbir'").first(); tb = r ? JSON.parse(r.v) || {} : {}; } catch (e) {}
  const P = aisecPick(rows, q, prev, tb, now);
  // notlar: yeni girenler (ve önceki çalışmada yapay zekâ yazamadıkları) — çalışmada en çok 4 model çağrısı, kota ai_n ortak
  let cnt = { d, n: 0 }; try { const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'ai_n'").first(); const v = r ? JSON.parse(r.v) : null; if (v && v.d === d) cnt = v; } catch (e) {}
  let calls = 0;
  for (const e of P.list) {
    if (e.note && e.ai) continue;
    if (!e.note) e.note = aisecPlain(e);
    if (calls < 4 && cnt.n < AI_MAX) { calls++; try { const t = await aiNote(env, e); if (t) { e.note = t; e.ai = 1; cnt.n++; } } catch (x) {} }
  }
  if (calls) { try { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('ai_n', ?)").bind(JSON.stringify(cnt)).run(); } catch (e) {} }
  for (const e of P.neu) await sigAdd(env, { src: 'aisec', sym: e.s, dir: 'AL', px: e.px, sc: e.sc, t: now, dev: 'aisec', meta: { k: e.k, ch: e.ch, rv: e.rv } });
  const v = { d, at: now, next: now + 10 * 60e3, list: P.list.map(({ t0, ...e }) => e), out: P.out };
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('aisec', ?)").bind(JSON.stringify(v)).run();
  cache = { at: now, v };
  return json({ ok: true, n: v.list.length, yeni: P.neu.length, ai: calls });
}
export async function aisecGet(env, json, anon) {
  if (anon) return json({ ok: true, list: [], out: [], uye: 1 });
  if (cache.v && Date.now() - cache.at < 20e3) return json({ ok: true, ...cache.v });
  let v = { d: '', at: 0, list: [], out: [] };
  if (env.BT) { try { const r = await env.BT.prepare("SELECT v FROM meta WHERE k = 'aisec'").first(); if (r) v = JSON.parse(r.v); } catch (e) {} }
  cache = { at: Date.now(), v };
  return json({ ok: true, ...v });
}
