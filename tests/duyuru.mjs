// v15.20 Duyurular — sunucu temizleme + yol
import { duyClean, duyuruRoute } from '../worker/src/duyuru.js';
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const L = duyClean([{ id: 'a', t: 1, baslik: 'Eski', tag: 'Yeni' }, { id: 'b', t: 5, baslik: 'Yeni', tag: 'xx', bloklar: [{ p: 'x' }, { li: ['1', '2'] }, { adim: [['bitti', 'A', 'a'], ['uydurma', 'B', 'b']] }, { kotu: 1 }, { not: 'n' }] }, { baslik: 'id yok' }, null]);
ok(L.length === 2 && L[0].id === 'b', 'id/başlık olmayanlar atılır, yeniden eskiye sıralı');
ok(L[0].tag === 'Bilgi' && L[1].tag === 'Yeni', 'bilinmeyen etiket → Bilgi');
ok(L[0].bloklar.length === 4 && L[0].bloklar[2].adim[1][0] === 'sonra', 'bilinmeyen blok atılır, adım durumu sınırlı');
ok(duyClean('x').length === 0 && duyClean([{ id: 'z', baslik: 'q'.repeat(500) }])[0].baslik.length === 120, 'uzunluk sınırı');
const env = { BT: { prepare: () => ({ first: async () => ({ v: JSON.stringify([{ id: 'k', t: 9, baslik: 'Sunucu duyurusu' }]) }) }) } };
const res = await duyuruRoute(env, o => o);
ok(res.ok && res.list.length === 1 && res.list[0].baslik === 'Sunucu duyurusu', '/duyuru meta satırını okur');
if (fail) { console.log(fail + ' kontrol BAŞARISIZ'); process.exit(1); }
console.log('duyuru: hepsi geçti');
