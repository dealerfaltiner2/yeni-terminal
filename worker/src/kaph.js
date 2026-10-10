// v9.5 (10.10) KAP GEÇMİŞİ TOPLAYICI — yalnız araştırma (sinyal/Telegram YOK).
// Amaç: (2) 'yeni iş ilişkisi / sipariş' haberlerinin TUTARI, (3) içeriden alım-satım bildirimlerinde ALIŞ mı SATIŞ mı,
// (3b) şirketin kendi pay geri alımları — geçmiş bir yıl için toplanır, sonra fiyatla karşılaştırılır.
// Yalnız seans DIŞINDA çalışır (hafta içi 09:30–18:30 hariç), çalışma başına ya 1 günlük liste ya da en çok 3 detay.
// D1 tablo kaph: idx, t (ms), d (gün), sym, kind ('is' | 'icerden' | 'geri'), subj, summ, txt (detayın düz metni), st (0 bekliyor, 1 tamam, -1 hata).
// Başlatma: meta 'kaph_day' = 'YYYY-MM-DD' (ilk gün). Bitince meta 'kaph_st' durum özetini tutar.
const TRMS = 3 * 3600e3;
const LIST_URL = 'https://www.kap.org.tr/tr/api/disclosure/members/byCriteria';
const DET_URL = 'https://www.kap.org.tr/tr/api/notification/attachment-detail/';
const H = UA => ({ Accept: 'application/json', Referer: 'https://www.kap.org.tr/tr/bildirim-sorgu', Origin: 'https://www.kap.org.tr', 'User-Agent': UA });
const RE_IS = /yeni iş ilişkisi|iş ilişkisi|sözleşme imza|sözleşmesi imza|sipariş|ihale(yi|sini)?.{0,15}kazan|ihalesini aldı|anlaşma imza|ihracat anlaşma/;
// Liste satırından tür (yalnız araştırılanlar; diğerleri null)
export function kaphKind(x) {
  const s = String(x.subject || '').toLocaleLowerCase('tr'), m = String(x.summary || '').toLocaleLowerCase('tr');
  if (/payların geri alınmasına/.test(s) || /geri alım/.test(m) && /pay/.test(s)) return 'geri';
  if (/pay alım satım bildirimi/.test(s) || /pay alım satım|pay alım\s*\/\s*satım/.test(m)) return 'icerden';
  if (RE_IS.test(s + ' | ' + m)) return 'is';
  return null;
}
// "15.10.2025 23:53:06" → ms
export function kaphTime(v) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):?(\d{2})?/.exec(String(v || ''));
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)) - TRMS : null;
}
// Detay yanıtından (JSON içinde HTML) düz metin: tüm metin alanları birleştirilir, etiketler atılır.
export function kaphText(raw) {
  let j; try { j = JSON.parse(raw); } catch (e) { j = raw; }
  const out = [];
  const walk = v => { if (typeof v === 'string') { if (v.length > 2) out.push(v); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(j);
  return out.join(' | ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim().slice(0, 12000);
}
const nextDay = d => new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
export async function kaphStep(env, UA, now = Date.now()) {
  if (!env.BT) return null;
  const tr = new Date(now + TRMS), wd = tr.getUTCDay(), m = tr.getUTCHours() * 60 + tr.getUTCMinutes();
  if (wd >= 1 && wd <= 5 && m >= 570 && m < 1110) return null;   // seans ve çevresi: dokunma
  const cur = await env.BT.prepare("SELECT v FROM meta WHERE k = 'kaph_day'").first();
  if (!cur) return null;   // başlatılmamış
  await env.BT.prepare('CREATE TABLE IF NOT EXISTS kaph (idx INTEGER PRIMARY KEY, t INTEGER, d TEXT, sym TEXT, kind TEXT, subj TEXT, summ TEXT, txt TEXT, st INTEGER DEFAULT 0)').run();
  const today = tr.toISOString().slice(0, 10);
  // 1) liste: dünden eski günler sırayla
  if (cur.v < today) {
    const r = await fetch(LIST_URL, { method: 'POST', headers: { ...H(UA), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDate: cur.v, toDate: cur.v, mkkMemberOidList: [], subjectList: [] }), signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('KAP liste HTTP ' + r.status);
    const L = await r.json();
    const rows = [];
    for (const x of (Array.isArray(L) ? L : [])) {
      const k = kaphKind(x); if (!k) continue;
      const idx = +x.disclosureIndex, t = kaphTime(x.publishDate); if (!idx || !t) continue;
      const sym = String(x.stockCodes || x.relatedStocks || '').toUpperCase().split(/[^A-Z0-9]+/).filter(s => /^[A-Z][A-Z0-9]{2,5}$/.test(s)).slice(0, 3).join(',');
      rows.push(env.BT.prepare('INSERT OR IGNORE INTO kaph (idx, t, d, sym, kind, subj, summ, st) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(idx, t, cur.v, sym, k, String(x.subject || '').slice(0, 120), String(x.summary || '').slice(0, 300), k === 'geri' ? 1 : 0));
    }
    rows.push(env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('kaph_day', ?)").bind(nextDay(cur.v)));
    await env.BT.batch(rows);
    return { gun: cur.v, satir: rows.length - 1 };
  }
  // 2) detay: bekleyenlerden en çok 3 (geri alımlarda detay gerekmez)
  const P = (await env.BT.prepare('SELECT idx FROM kaph WHERE st = 0 ORDER BY (kind = 'is') DESC, idx LIMIT 3').all()).results || [];
  if (!P.length) {
    const s = await env.BT.prepare("SELECT kind, count(*) n, sum(st = 1) ok FROM kaph GROUP BY kind").all();
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('kaph_st', ?)").bind(JSON.stringify({ bitti: new Date(now).toISOString(), ...Object.fromEntries((s.results || []).map(x => [x.kind, x.n + '/' + x.ok])) })).run();
    return { bitti: true };
  }
  let n = 0;
  for (const p of P) {
    let txt = null, st = -1;
    try {
      const r = await fetch(DET_URL + p.idx, { headers: H(UA), signal: AbortSignal.timeout(10000) });
      if (r.ok) { txt = kaphText(await r.text()); st = 1; n++; }
    } catch (e) {}
    await env.BT.prepare('UPDATE kaph SET txt = ?, st = ? WHERE idx = ?').bind(txt, st, p.idx).run();
  }
  return { detay: n };
}
