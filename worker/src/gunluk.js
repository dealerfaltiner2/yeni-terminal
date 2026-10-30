// v14.26 (31.10 gece, Fatih: 'gerçekten işe yarayan bir şey bul, atladığın bir şey var') ÇOK YILLIK GÜNLÜK MUM ARŞİVİ — yalnız araştırma, sinyal YOK.
// Şimdiye kadarki araştırmaların hepsi 14 aylık veriyle (gün içi). Çok günlük/haftalık tutma stratejileri (trend, göreli güç, 52 hafta zirvesi, endeks zamanlaması)
// birkaç yıllık veri ister. Ana iş seans dışında, meta 'gunluk_q' (JSON kod listesi; 'BIST:' öneki yoksa eklenir) varken dakikada 1 kod:
// TradingView 1D en çok 2600 mum → D1 tablo gunluk (sym PK, n, data = 'gün,açılış,yüksek,düşük,kapanış,hacim;…', gün = 1970'ten beri gün sayısı).
// Kod ÖNCE kuyruktan çıkar (kesilirse tekrar denenmez). Kuyruk bitince meta silinir, durum meta 'gunluk_st'.
export const GUNLUK_N = 2600;
export function gunlukPack(bars) {
  const r = v => Math.round(v * 10000) / 10000;
  return bars.map(b => [Math.floor(b[0] / 86400), r(b[1]), r(b[2]), r(b[3]), r(b[4]), Math.round(b[5] || 0)].join(',')).join(';');
}
export async function gunlukStep(env, fetchBarsTV) {
  if (!env.BT) return null;
  const m = await env.BT.prepare("SELECT v FROM meta WHERE k = 'gunluk_q'").first();
  if (!m) return null;
  let q = []; try { q = JSON.parse(m.v) || []; } catch (e) { q = []; }
  if (!q.length) {
    await env.BT.prepare("DELETE FROM meta WHERE k = 'gunluk_q'").run();
    await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('gunluk_st', ?)").bind(JSON.stringify({ bitti: Date.now() })).run();
    return { bitti: 1 };
  }
  await env.BT.prepare('CREATE TABLE IF NOT EXISTS gunluk (sym TEXT PRIMARY KEY, n INTEGER, at INTEGER, data TEXT)').run();
  const raw = String(q.shift());
  await env.BT.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('gunluk_q', ?)").bind(JSON.stringify(q)).run();
  const key = raw.includes(':') ? raw : 'BIST:' + raw, sym = raw.includes(':') ? raw.split(':').pop() : raw;
  const st = (await fetchBarsTV(env, [key], '1D', GUNLUK_N, 15000))[key];
  const bars = st ? [...st.m.values()].filter(v => v && v.length >= 5).sort((a, b) => a[0] - b[0]) : [];
  if (!bars.length) return { sym, n: 0, kalan: q.length, err: st && st.err ? String(st.err).slice(0, 80) : 'mum yok' };
  await env.BT.prepare('INSERT OR REPLACE INTO gunluk (sym, n, at, data) VALUES (?,?,?,?)').bind(sym, bars.length, Date.now(), gunlukPack(bars)).run();
  return { sym, n: bars.length, kalan: q.length };
}
