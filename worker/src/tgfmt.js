// v10.6 (14.10) Telegram mesaj düzeni — mesajın altındaki düğmeler (Grafik = TradingView, KAP'ta oku = bildirimin aslı).
export function tgKb(sym, kapIdx) {
  const r = [];
  if (kapIdx) r.push({ text: "📄 KAP'ta oku", url: 'https://www.kap.org.tr/tr/Bildirim/' + kapIdx });
  if (sym && /^[A-Z0-9]{2,8}$/.test(sym)) r.push({ text: '📈 Grafik', url: 'https://www.tradingview.com/chart/?symbol=BIST%3A' + sym });
  return r.length ? { inline_keyboard: [r] } : null;
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
