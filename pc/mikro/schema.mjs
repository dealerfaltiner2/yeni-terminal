// NormalizedMarketEvent — sağlayıcıdan bağımsız iç şema (v1).
// Sağlayıcıya özel her şey adapters/<ad>.mjs içinde kalır; motor yalnız bu şemayı görür.
//
// { v:1, src, sym, type: 'book'|'trade'|'quote'|'akd'|'status'|'hb', ts, rts, seq,
//   book:   { snap:true, bids:[[px,qty,orders|null]…], asks:[…] }            // tam görüntü (en iyi kademe önce)
//        |  { snap:false, side:'B'|'A', px, qty, op:'add'|'upd'|'del' }     // tek kademe değişikliği (qty = yeni toplam)
//   trade:  { px, qty, side:'B'|'S'|'U', buyer, seller, id }                 // side: agresör (B = alıcı vurdu), U = bilinmiyor
//   quote:  { last, bid, ask, high, low, vol, tavan, taban }
//   akd:    { asOf, rows:[{ kurum, alis, satis, net, ort }] }
//   status: { state:'pre'|'open'|'kapanis'|'halt'|'closed' }
//   hb:     { robotTs } }
// ts = borsa zamanı (ms, yoksa null), rts = bize geliş zamanı (ms, her zaman), seq = sembol başına sıra no (yoksa null)
export const TYPES = ['book', 'trade', 'quote', 'akd', 'status', 'hb'];
const num = x => typeof x === 'number' && isFinite(x);
const pos = x => num(x) && x > 0;
const lvlOk = l => Array.isArray(l) && pos(l[0]) && num(l[1]) && l[1] >= 0;

// Hata metni ya da '' döner. Motor hatalı olayı işlemez, sayacına yazar.
export function validateEvent(e) {
  if (!e || typeof e !== 'object') return 'nesne değil';
  if (e.v !== 1) return 'şema sürümü';
  if (!TYPES.includes(e.type)) return 'tür';
  if (!num(e.rts)) return 'rts';
  if (e.ts != null && !num(e.ts)) return 'ts';
  if (e.type === 'hb') return '';
  if (typeof e.sym !== 'string' || !/^[A-Z0-9.]{1,12}$/.test(e.sym)) return 'sembol';
  if (e.type === 'book') {
    const b = e.book; if (!b) return 'book yok';
    if (b.snap) { if (!Array.isArray(b.bids) || !Array.isArray(b.asks) || !b.bids.every(lvlOk) || !b.asks.every(lvlOk)) return 'book kademe'; return ''; }
    if (!['B', 'A'].includes(b.side) || !pos(b.px) || !num(b.qty) || b.qty < 0 || !['add', 'upd', 'del'].includes(b.op)) return 'book değişiklik';
    return '';
  }
  if (e.type === 'trade') { const t = e.trade; if (!t || !pos(t.px) || !pos(t.qty) || !['B', 'S', 'U'].includes(t.side)) return 'trade'; return ''; }
  if (e.type === 'quote') { if (!e.quote) return 'quote'; return ''; }
  if (e.type === 'status') { if (!e.status || !['pre', 'open', 'kapanis', 'halt', 'closed'].includes(e.status.state)) return 'status'; return ''; }
  if (e.type === 'akd') { if (!e.akd || !Array.isArray(e.akd.rows)) return 'akd'; return ''; }
  return '';
}
