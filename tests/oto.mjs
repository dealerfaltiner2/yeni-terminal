// v14.4 İzleme 'Otomatik' listesi seçimi (otoPick)
import { otoPick } from '../worker/src/sig.js';
const r = otoPick([{ t: 1, src: 'algi', sym: 'A', dir: 'AL', px: 1, meta: '{"fc":0.9,"rv":3}' }, { t: 2, src: 'algi', sym: 'A', dir: 'AL', px: 1, meta: '{"fc":0.9,"rv":3}' },
  { t: 3, src: 'algi', sym: 'B', dir: 'AL', px: 1, meta: '{"fc":0.9,"rv":1}' }, { t: 4, src: 'firsat-B', sym: 'C', dir: 'SAT', px: 1 }, { t: 5, src: 'firsat-A', sym: 'D', dir: 'AL', px: 2 }, { t: 6, src: 'firsat-A', sym: 'E', dir: 'AL', px: null }]);
const got = JSON.stringify(r.map(x => x.sym + x.t)), want = '["D5","A1"]';
if (got !== want) { console.log('HATA otoPick', got); process.exit(1); }
console.log('✓ otoPick: güçlü Algı (fc≥0,8 ve rv≥2) + Fırsat AL, hisse başına ilk sinyal, yeni üstte');
