// v14.16 Yapay zekâ seçtikleri: seçim kuralı (saf) + yaz/oku (D1 ve AI taklidi)
import { aisecPick, aisecPlain, aisecSet, aisecGet, isMover } from '../worker/src/aisec.js';
let bad = 0; const ok = (n, c, x) => { console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : ' — ' + JSON.stringify(x))); if (!c) bad++; };
const T = Date.parse('2026-10-26T08:00:00Z');   // Pazartesi 11:00
const R = (src, sym, px, meta, dt = 0) => ({ t: T - 3600e3 + dt, src, sym, dir: 'AL', px, meta: JSON.stringify(meta || {}) });
const rows = [
  R('kap-geri', 'GERI1', null, { g: 1 }), R('kap-geri', 'GERI0', null, {}),           // g yoksa (Telegram'a gitmeyen geri alım) sayılmaz
  R('momentum', 'MOM1', 10, { tk: 0 }), R('momentum', 'MOMT', 20, { tk: 1 }),
  R('algi', 'ALGT', 50, { tg: 1, fc: 0.9, rv: 2.5 }), R('algi', 'ALGZ', 30, { tg: 0, fc: 0.6 }), R('algi', 'ALGF', 40, { tg: 0, fc: 0.85 }),
  R('firsat-A', 'ALGF', 40, {}), R('firsat-A', 'FAONLY', 12, {}),
  R('momentum', 'TAVAN', 5, {}), R('momentum', 'TEDB', 5, {}), R('momentum', 'STOPD', 100, {}), R('momentum', 'KOSTU', 100, {})
];
const q = { GERI1: [8, 2, 1.2, 5e7], GERI0: [8, 2, 1, 5e7], MOM1: [10.05, 4, 2, 3e7], MOMT: [20, 1, 1, 3e7], ALGT: [50.2, 3, 2.4, 2e7], ALGZ: [30, 1, 1, 2e7], ALGF: [40, 1, 1, 2e7],
  FAONLY: [12, 1, 1, 1e7], TAVAN: [5.4, 9.9, 3, 9e7], TEDB: [5, 1, 1, 1e7], STOPD: [98.9, -1, 1, 1e7], KOSTU: [103.5, 5, 1, 1e7] };
const P = aisecPick(rows, q, null, { TEDB: [{ k: 'yip' }] }, T), S = P.list.map(e => e.s);
ok('geri alım (seans içi kart) ve Momentum 3 puanla en üstte', S[0] === 'GERI1' || S[0] === 'MOM1', S);
ok('Momentum + hacimle yükseliyor → 4 puan, Hacim etiketi', P.list.find(e => e.s === 'MOM1').sc === 4 && P.list.find(e => e.s === 'MOM1').k.includes('hac'), P.list.find(e => e.s === 'MOM1'));
ok('Telegram\'a gitmeyen geri alım, zayıf Algı, tek başına Fırsat A girmez', !S.includes('GERI0') && !S.includes('ALGZ') && !S.includes('FAONLY'), S);
ok('güçlü Algı + Fırsat A (1+1) girer', S.includes('ALGF') && P.list.find(e => e.s === 'ALGF').sc === 2, S);
ok('tekrar eden Momentum 2 puan, Tekrar etiketli', P.list.find(e => e.s === 'MOMT') && P.list.find(e => e.s === 'MOMT').k.includes('tk') && P.list.find(e => e.s === 'MOMT').sc === 2);
ok('tavana kilitli, tedbirli, sinyalden −%1 düşmüş ve +%3 koşmuş girmez', !['TAVAN', 'TEDB', 'STOPD', 'KOSTU'].some(s => S.includes(s)), S);
ok('giriş fiyatı listeye girdiği andaki fiyat', P.list.find(e => e.s === 'GERI1').px === 8 && P.neu.length === P.list.length);
// ikinci çalışma: listedekiler yerinde kalır, stop gelen çıkar, boş yere yenisi girer
const prev = { list: P.list, out: P.out };
const q2 = { ...q, MOM1: [9.9, 3, 2, 3e7], GERI1: [8.3, 5, 1.6, 5e7] };
const rows2 = rows.concat([R('momentum', 'YENI', 7, {}, 1800e3)]); q2.YENI = [7, 1, 1, 1e7];
const P2 = aisecPick(rows2, q2, prev, {}, T + 10 * 60e3), S2 = P2.list.map(e => e.s);
ok('stop (−%1) gelen listeden çıkar, çıkanlarda nedeni', !S2.includes('MOM1') && P2.out.some(x => x.s === 'MOM1' && x.why === 'stop'), P2.out);
ok('yeni aday boş yere girer, eski sıralama korunur', S2.includes('YENI') && S2.indexOf('GERI1') === S.indexOf('GERI1') - (S.indexOf('MOM1') < S.indexOf('GERI1') ? 1 : 0), S2);
ok('giriş fiyatından % ve hacim etiketi güncellenir', P2.list.find(e => e.s === 'GERI1').p === 3.75 && P2.list.find(e => e.s === 'GERI1').hit === 1, P2.list.find(e => e.s === 'GERI1'));
const P3 = aisecPick(rows2, q2, { list: P2.list, out: P2.out }, {}, T + 20 * 60e3);
ok('aynı gün çıkan hisse tekrar girmez', !P3.list.some(e => e.s === 'MOM1'));
// v14.20: tabana kilitli hisse girmez; listedeyken tabana kilitlenirse çıkar
const Pt = aisecPick([R('kap-geri', 'TBN', null, { g: 1 })], { TBN: [6.23, -9.97, 1, 2e7] }, null, {}, T);
ok('tabana kilitli hisse listeye girmez (HRKET vakası)', Pt.list.length === 0, Pt.list);
const Pt2 = aisecPick([R('kap-geri', 'TBN', null, { g: 1 })], { TBN: [6.2, -9.9, 1, 2e7] }, { list: [{ s: 'TBN', px: 6.23, t: T - 60e3, k: ['geri'], sc: 3 }], out: [] }, {}, T + 600e3);
ok('listedeyken tabana kilitlenen çıkar (neden: taban)', Pt2.list.length === 0 && Pt2.out.some(x => x.s === 'TBN' && x.why === 'taban'), Pt2);
const big = Array.from({ length: 12 }, (_, i) => R('momentum', 'M' + i, 10, {})), qb = Object.fromEntries(big.map(r => [r.sym, [10, 1, 1, 1e7]]));
ok('en çok 8 hisse', aisecPick(big, qb, null, {}, T).list.length === 8);
ok('17:30\'dan sonra yeni giriş yok', aisecPick(big, qb, null, {}, Date.parse('2026-10-26T14:45:00Z')).list.length === 0);
ok('hareket tanımı: ≥10 Mn TL, +%3…+%9,5, hacim ≥1,5 kat', isMover({ px: 1, ch: 4, rv: 1.6, vol: 2e7 }) && !isMover({ px: 1, ch: -4, rv: 2, vol: 2e7 }) && !isMover({ px: 1, ch: 4, rv: 1, vol: 2e7 }));
ok('düz cümle (yapay zekâ yoksa)', /^Momentum taraması seçti/.test(aisecPlain({ k: ['mom', 'hac'] })) && /ayrıca/.test(aisecPlain({ k: ['mom', 'hac'] })));
// yaz/oku

const M = {}, SIG = [];
const env = { AI: { run: async () => ({ response: 'Momentum taraması seçti ve hisse bugün +4% yükselirken hacim normalin 2 katı.' }) },
  BT: { batch: async () => [], prepare: qs => { const st = { a: [], bind(...a) { return { ...st, a }; },
    run: async function () { if (/INSERT OR REPLACE INTO meta/.test(qs)) { const k = /'(\w+)'/.exec(qs.split('VALUES')[1]); M[k ? k[1] : this.a[0]] = k ? this.a[0] : this.a[1]; } if (/INSERT INTO sig/.test(qs)) SIG.push(this.a); return { meta: {} }; },
    first: async () => { const k = /k = '(\w+)'/.exec(qs); return k && M[k[1]] ? { v: M[k[1]] } : null; },
    all: async () => ({ results: /FROM sig/.test(qs) ? rows : [] }) }; return st; } } };
const json = (o, st) => ({ o, st: st || 200 });
const w1 = await aisecSet({ text: async () => JSON.stringify({ q }) }, env, json, T);
const mv = JSON.parse(M.aisec || '{}');
ok('kaydedildi + karneye sessiz kayıt (src aisec)', w1.o.ok && mv.list.length === w1.o.n && SIG.length === w1.o.yeni && SIG.every(a => a[2] === 'aisec'), { w1, SIG: SIG.length });
ok('en çok 4 yapay zekâ notu, gerisi düz cümle; rakam doğrulanır', w1.o.ai === 4 && mv.list.filter(e => e.ai).length === 4 && mv.list.every(e => e.note && e.note.length > 20), mv.list.map(e => [e.s, e.ai, e.note]));
const w2 = await aisecSet({ text: async () => JSON.stringify({ q }) }, env, json, T + 60e3);
ok('8 dk dolmadan yeniden hesaplanmaz', w2.o.skip === 'erken');
ok('seans dışı atlanır', (await aisecSet({ text: async () => '{}' }, env, json, Date.parse('2026-10-25T08:00:00Z'))).o.skip === 'seans dışı');
const g = await aisecGet(env, json, false);
ok('okuma: aynı liste', g.o.ok && g.o.list.length === mv.list.length, g.o);
ok('üyeye boş', (await aisecGet(env, json, true)).o.list.length === 0);
if (bad) { console.log('AI SEÇTİKLERİ: ' + bad + ' HATA'); process.exit(1); } else console.log('AI SEÇTİKLERİ: hepsi geçti');
