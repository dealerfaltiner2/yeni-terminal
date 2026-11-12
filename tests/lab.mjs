// v15.4 Araştırma laboratuvarı: hafta başları, sağlamlık tablosu, okuma, karar kaydı
import { weekStarts, labCalc, labRead, labRoute, LAB_MIN } from '../worker/src/lab.js';
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const now = Date.parse('2026-11-12T22:30:00Z');   // İstanbul 13.11 Cuma 01:30
const W = weekStarts(now, 5);
ok(JSON.stringify(W) === JSON.stringify(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']), 'hafta başları Pazartesi, İstanbul saatiyle: ' + W.join(' '));
ok(weekStarts(Date.parse('2026-11-08T21:30:00Z'), 1)[0] === '2026-11-09', 'Pazar gece yarısından sonra (İstanbul Pazartesi) yeni hafta');
const R = [
  { src: 'algi', d: '2026-10-13', up: 1, tg: 0, n: 10, s: 5 }, { src: 'algi', d: '2026-10-14', up: 0, tg: 1, n: 10, s: -5 },
  { src: 'firsat-B', d: '2026-10-13', up: 0, tg: 0, n: 12, s: -6 }, { src: 'firsat-B', d: '2026-10-20', up: 0, tg: 0, n: 12, s: -3 }, { src: 'firsat-B', d: '2026-10-27', up: 1, tg: 0, n: 12, s: -1 },
  { src: 'kap-ozel', d: '2026-11-03', up: 1, tg: 0, n: 4, s: 2 }, { src: 'kap-devre', d: '2026-11-03', up: 1, tg: 0, n: 40, s: 99 },
  { src: 'algi', d: '2026-10-01', up: 1, tg: 0, n: 99, s: 99 }
];
const rows = labCalc(R, W), g = k => rows.find(o => o.k === k);
ok(g('algi').w[0].n === 20 && g('algi').w[0].r === 0, 'Algı ilk hafta: 20 sinyal, ort. 0 (pencere dışındaki eski gün sayılmaz)');
ok(g('algitg').w[0].n === 10 && g('algitg').w[0].r === -0.5, 'Algı · Telegram yalnız tg=1 olanlar');
ok(g('algi').up.r === 0.5 && g('algi').dn.r === -0.5, 'borsa artı / eksi ayrımı');
ok(g('kap').w[3].n === 4 && g('kap').w[3].r === 0.5, 'diğer KAP: devre kesici hariç');
ok(!g('aisec'), 'verisi olmayan kaynak tabloda yok');
const okuma = labRead(rows);
ok(okuma.some(t => /Fırsat B\*\* ölçülen 3 haftanın hepsinde eksi/.test(t)), 'okuma: hep eksi olan kaynak yazılıyor');
ok(okuma[0].startsWith('Hiçbir kaynak'), 'okuma: her haftada artı olan yok');
ok(LAB_MIN === 10, 'hücre için en az 10 sinyal');
// karar kaydı
const M = { lab_rapor: JSON.stringify({ oneri: { id: 'o1', baslik: 'deneme' } }) };
const env = { BT: { prepare: q => ({ bind: (...a) => ({ first: async () => (M[a[0]] ? { v: M[a[0]] } : null), run: async () => { M[a[0]] = a[1]; } }) }) } };
const json = (o, st) => ({ o, st: st || 200 });
const req = b => ({ method: 'POST', text: async () => JSON.stringify(b) });
let r = await labRoute('lab-karar', req({ id: 'o1', karar: 'onay' }), env, json);
ok(r.o.ok && JSON.parse(M.lab_rapor).oneri.karar === 'onay', 'Onayla kaydediliyor');
r = await labRoute('lab-karar', req({ id: 'baska', karar: 'ret' }), env, json);
ok(!r.o.ok && r.st === 404 && JSON.parse(M.lab_rapor).oneri.karar === 'onay', 'eski önerinin düğmesi yeni öneriyi değiştirmez');
r = await labRoute('lab-karar', req({ id: 'o1', karar: 'sil' }), env, json);
ok(!r.o.ok && r.st === 400, 'bilinmeyen karar reddedilir');
r = await labRoute('lab', { method: 'GET' }, env, json, true);
ok(r.o.uye === 1 && !r.o.rows.length, 'üyeye boş');
process.exit(fail ? 1 : 0);
