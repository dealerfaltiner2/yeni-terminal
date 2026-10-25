// v10.6 (14.10) Telegram mesaj düzeni — mesajın altındaki düğmeler (Grafik = TradingView, KAP'ta oku = bildirimin aslı).
import { tgAppLink } from './tgapp.js';
// v11.7: ilk satır '🧭 Pusula'da aç' (Telegram içinde o hissenin röntgeni), altında KAP / Grafik
export function tgKb(sym, kapIdx) {
  const ok = sym && /^[A-Z0-9]{2,8}$/.test(sym), top = [{ text: "🧭 Pusula'da aç", url: tgAppLink(ok ? sym : '') }];
  const r = [];
  if (kapIdx) r.push({ text: "📄 KAP'ta oku", url: 'https://www.kap.org.tr/tr/Bildirim/' + kapIdx });
  if (sym && /^[A-Z0-9]{2,8}$/.test(sym)) r.push({ text: '📈 Grafik', url: 'https://www.tradingview.com/chart/?symbol=BIST%3A' + sym });
  return { inline_keyboard: r.length ? [top, r] : [top] };
}
// Telegram biçimi reddederse aynı mesaj düz metin gider (etiketler atılır)
export function tgPlain(t) {
  return String(t).replace(/<\/blockquote>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
export const tgPct = x => x == null || !isFinite(x) ? '-' : (x >= 0 ? '+' : '−') + '%' + Math.abs(x).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Rapor mesajları: '   ' ile başlayan alt satır grupları alıntı kutusuna (sol çizgili blok) dönüşür — karne ve haftalık rapor daha kolay taranır
export function tgQuote(msg) {
  const L = String(msg).split('\n'), out = [];
  for (let i = 0; i < L.length; i++) {
    if (/^ {3}\S/.test(L[i])) { const g = []; while (i < L.length && /^ {3}\S/.test(L[i])) g.push(L[i++].trim()); i--; out.push('<blockquote>' + g.join('\n') + '</blockquote>'); }
    else out.push(L[i]);
  }
  return out.join('\n').replace(/<\/blockquote>\n(?!\n)/g, '</blockquote>');
}
// v10.8 // Karne mesajının piyasa bölümü ('   ' ile başlayan satırlar tgQuote ile alıntı kutusuna döner)
export function mktBlock(v, esc) {
  if (!v || !v.idx || !v.idx.length) return '';
  const pct = x => (x >= 0 ? '+' : '−') + '%' + Math.abs(x).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const AD = { XU100: 'BIST 100', XU030: 'BIST 30', XBANK: 'Banka' };
  const x1 = v.idx.find(x => x.s === 'XU100') || v.idx[0], rest = v.idx.filter(x => x !== x1);
  let t = '\n\n🧭 <b>Piyasa</b>\n   ' + (AD[x1.s] || esc(x1.s)) + '   <code>' + Math.round(x1.c).toLocaleString('tr-TR') + '</code>   <b>' + pct(x1.ch) + '</b>';
  if (rest.length) t += '\n   ' + rest.map(x => (AD[x.s] || esc(x.s)) + ' ' + pct(x.ch)).join(' · ');
  if (x1.hi > x1.lo) { const p = (x1.c - x1.lo) / (x1.hi - x1.lo); t += '\n   ' + (p >= 0.8 ? 'Günü en yüksek seviyelere yakın kapattı.' : p <= 0.2 ? 'Günü en dipte kapattı, toparlanma olmadı.' : 'Günü gün içi aralığın ortasında kapattı.'); }
  // v14.12: BIST 100 ve tüm borsa ayrı satır (önceden yalnız tüm borsa sayısı BIST 100 satırının altında duruyordu → '600 hisse' karışıklığı)
  if (v.b100 && v.b100.n) t += '\n   BIST 100: ' + v.b100.nu + ' hisse yükseldi, ' + v.b100.nd + ' hisse düştü.';
  if (v.nu + v.nd) t += '\n   Tüm borsa: ' + v.nu + ' hisse yükseldi, ' + v.nd + ' hisse düştü.';
  if (v.up && v.up.length) t += '\n   🟢 ' + v.up.map(x => esc(x.s) + ' ' + pct(x.ch)).join(' · ');
  if (v.dn && v.dn.length) t += '\n   🔴 ' + v.dn.map(x => esc(x.s) + ' ' + pct(x.ch)).join(' · ');
  return t;
}
