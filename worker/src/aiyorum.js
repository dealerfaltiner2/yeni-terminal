// v14.13 (25.10, Fatih: 'bir AI modeli grafiği yorumlasın') PUSULA YORUMU — Cloudflare Workers AI (ücretsiz kota: 10.000 birim/gün; Gemma 4 ≈ 25–50 birim/yorum).
// Model resme bakmaz: terminalin HESAPLADIĞI sayıları alır (göstergeler, seviyeler, hacim, aralık, endeks, notlar) → 4–5 cümle sade Türkçe.
// Kurallar: yalnız verilen veriye dayan, sayı/haber/hedef fiyat uydurma, al-sat tavsiyesi ve fiyat tahmini yok. Sinyal kuralı DEĞİŞMEZ (yalnız yorum).
// POST /aiyorum (DATA yolu, cihaz onayı; üyeye/anonime kapalı) {s, tf, f:{...}} → {ok, txt, at, cached}. Önbellek: hisse+zaman dilimi 15 dk (çalışma örneği belleği).
// Günlük sınır meta 'ai_n' {d, n} (AI_MAX). Hata → {ok:false, err}. Model değiştirmek: AI_MODEL.
export const AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const AI_MAX = 300;
const CACHE = new Map();
const TTL = 15 * 60e3;

export const AI_SYS = [
  "Sen 'Pusula' adlı bir Borsa İstanbul terminalinin teknik analiz yorumcususun. Kullanıcı gün içi (scalp) işlem yapıyor.",
  'YALNIZ sana verilen verilere dayan. Veride olmayan hiçbir sayı, haber, hedef fiyat ya da olay UYDURMA. Bir bilgi yoksa ondan hiç bahsetme.',
  'Kesin fiyat tahmini yapma, "al" ya da "sat" tavsiyesi verme. "Yükselir/düşer" yerine "şu seviyenin üstünde kalırsa…, altına inerse…" gibi koşullu yaz.',
  'Sade, akıcı Türkçe yaz. En çok 5 cümle. Başlık, madde işareti, emoji, kalın yazı KULLANMA. Kısaltma yerine düz kelime kullan (örneğin "günün ortalama fiyatı").',
  'Sıra: 1) genel görünüm ve trend, 2) fiyatın destek ve direnç seviyelerine göre yeri (rakamlarıyla), 3) hacim ve momentum, 4) dikkat edilmesi gereken risk ya da izlenecek tetikleyici.'
].join('\n');

const num = v => (v == null || !isFinite(+v) ? null : +v);
const r2 = v => { v = num(v); return v == null ? null : Math.round(v * 100) / 100; };
// Terminalden gelen alanları güvenli, kısa satırlara çevir (bilinmeyen alan alınmaz; metinler kırpılır)
export function aiFactLines(s, tf, f) {
  f = f || {};
  const L = [];
  const p = (k, v) => { if (v != null && v !== '') L.push(k + ': ' + v); };
  const pc = v => { v = r2(v); return v == null ? null : (v >= 0 ? '+' : '') + v + '%'; };
  p('Hisse', s); p('Grafik zaman dilimi', tf);
  p('Son fiyat', r2(f.px)); p('Bugünkü değişim', pc(f.ch)); p('BIST 100 bugün', pc(f.idx));
  p('Pusula notu (A en güçlü, C zayıf)', f.grade && /^[ABC]$/.test(f.grade) ? f.grade : null);
  p('15 dakikalık ortalamalar (EMA 20/50/200) sıralaması', f.stk === 1 ? 'yukarı sıralı (yükseliş düzeni)' : f.stk === -1 ? 'aşağı sıralı (düşüş düzeni)' : f.stk === 0 ? 'karışık' : null);
  ['e9', 'e21', 'e20', 'e50', 'e200'].forEach(k => p('15 dk EMA ' + k.slice(1) + ' (fiyata göre)', f[k] != null ? (r2(f[k]) + ' — fiyat ' + (f.px >= f[k] ? 'üstünde' : 'altında')) : null));
  p('Günün ortalama fiyatı (VWAP)', f.vwap != null ? r2(f.vwap) + ' — fiyat ' + (f.px >= f.vwap ? 'üstünde' : 'altında') : null);
  p('Yoğun işlem bölgesi (dünkü hacim profili)', f.poc != null ? 'orta ' + r2(f.poc) + (f.vah != null ? ', üst ' + r2(f.vah) : '') + (f.val != null ? ', alt ' + r2(f.val) : '') : null);
  p('Yakın destek', r2(f.sup)); p('Yakın direnç', f.res != null ? r2(f.res) : (f.px != null ? 'yakın direnç yok (zirvede)' : null));
  p('Pivot (günlük)', f.piv && f.piv.p != null ? 'P ' + r2(f.piv.p) + ', D1 ' + r2(f.piv.r1) + ', S1 ' + r2(f.piv.s1) : null);
  p('RSI 14 (15 dk)', r2(f.rsi)); p('Stoch RSI K/D (15 dk)', f.sk != null ? Math.round(f.sk) + ' / ' + Math.round(f.sd) : null);
  p('MACD (15 dk)', f.macd == null ? null : f.macd > 0 ? 'sinyal çizgisinin üstünde' : 'sinyal çizgisinin altında');
  p('Supertrend (15 dk)', f.st === 1 ? 'yukarı' : f.st === -1 ? 'aşağı' : null);
  p('Hacim (normale göre, kat)', r2(f.vr)); p('Göreli hacim (günlük)', r2(f.rv));
  p('Ortalama mum boyu (ATR, fiyata göre)', f.atrp != null ? r2(f.atrp) + '%' : null);
  p('Bugünkü aralık', f.dlo != null && f.dhi != null ? r2(f.dlo) + ' – ' + r2(f.dhi) : null);
  p('Son 1 yıl aralığı', f.ylo != null && f.yhi != null ? r2(f.ylo) + ' – ' + r2(f.yhi) : null);
  p('Günlük grafikte EMA 20/50/200', f.de20 != null ? 'fiyat EMA 20 ' + (f.px >= f.de20 ? 'üstünde' : 'altında') + (f.de50 != null ? ', EMA 50 ' + (f.px >= f.de50 ? 'üstünde' : 'altında') : '') + (f.de200 != null ? ', EMA 200 ' + (f.px >= f.de200 ? 'üstünde' : 'altında') : '') : null);
  p('Son 5 gün getiri', pc(f.d5)); p('Son 20 gün getiri', pc(f.d20));
  p('Kurulumlar', Array.isArray(f.kur) ? f.kur.filter(x => typeof x === 'string').slice(0, 5).map(x => x.slice(0, 60)).join(', ') || null : null);
  p('Notlar', Array.isArray(f.not) ? f.not.filter(x => typeof x === 'string').slice(0, 4).map(x => x.slice(0, 140)).join(' | ') || null : null);
  return L;
}

export function aiClean(t) {
  t = String(t || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\*\*|__|#+\s*/g, '').replace(/^\s*[-•*]\s+/gm, '').replace(/\n{2,}/g, '\n').trim();
  if (t.length > 900) { const i = t.lastIndexOf('.', 900); t = t.slice(0, i > 400 ? i + 1 : 900); }
  return t;
}
export function aiText(r) {
  if (!r) return '';
  if (typeof r === 'string') return r;
  return r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.output_text || (r.result && r.result.response) || '';
}

export async function aiComment(env, s, tf, f) {
  if (!env.AI || typeof env.AI.run !== 'function') return { ok: false, err: 'AI bağlantısı yok' };
  const lines = aiFactLines(s, tf, f);
  if (lines.length < 5) return { ok: false, err: 'yorum için yeterli veri yok' };
  const r = await env.AI.run(AI_MODEL, {
    messages: [{ role: 'system', content: AI_SYS }, { role: 'user', content: 'Aşağıdaki verilere göre bu hissenin grafiğini yorumla:\n' + lines.join('\n') }],
    max_tokens: 500, temperature: 0.3, chat_template_kwargs: { enable_thinking: false }
  });
  const txt = aiClean(aiText(r));
  if (txt.length < 40) return { ok: false, err: 'model boş yanıt verdi' };
  return { ok: true, txt, at: Date.now() };
}

export async function aiYorumRoute(request, env, json, anon, now = Date.now()) {
  if (anon) return json({ ok: false, err: 'Bu sürümde yok' }, 403);
  if (request.method !== 'POST') return json({ ok: false, err: 'POST gerekli' }, 405);
  const raw = await request.text();
  if (raw.length > 8000) return json({ ok: false, err: 'çok büyük' }, 413);
  let b = null; try { b = JSON.parse(raw); } catch (e) { return json({ ok: false, err: 'geçersiz' }, 400); }
  const s = String((b && b.s) || '').toUpperCase(), tf = String((b && b.tf) || '').slice(0, 8);
  if (!/^[A-Z0-9]{2,12}$/.test(s)) return json({ ok: false, err: 'hisse kodu geçersiz' }, 400);
  const key = s + ':' + tf, c = CACHE.get(key);
  if (c && now - c.at < TTL && !(b && b.yeni)) return json({ ...c, cached: true });
  if (c && b && b.yeni && now - c.at < 60e3) return json({ ...c, cached: true });   // 'yenile' en çok dakikada bir
  const day = new Date(now + 3 * 3600e3).toISOString().slice(0, 10);
  let cnt = { d: day, n: 0 };
  try { const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'ai_n'").first(); const v = m ? JSON.parse(m.v) : null; if (v && v.d === day) cnt = v; } catch (e) {}
  if (cnt.n >= AI_MAX) return json({ ok: false, err: 'Bugünkü yorum hakkı doldu, yarın yenilenir' });
  let out;
  try { out = await aiComment(env, s, tf, b.f); } catch (e) { out = { ok: false, err: 'model yanıt vermedi (' + String(e && e.message || e).slice(0, 60) + ')' }; }
  if (out.ok) {
    out.at = now; CACHE.set(key, out); if (CACHE.size > 200) CACHE.delete(CACHE.keys().next().value);
    cnt.n++; try { await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('ai_n', ?)").bind(JSON.stringify(cnt)).run(); } catch (e) {}
  }
  return json(out);
}
