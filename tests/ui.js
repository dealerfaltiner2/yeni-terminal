// Terminal arayüz testi (Playwright). Çıkış kodu 0 = hepsi geçti. Ekran görüntüleri tests/out/ içine.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), glob = d => { try { return fs.readdirSync(d) } catch (e) { return [] } };
const { install } = require('./mock');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const exe = (() => { const b = '/opt/pw-browsers'; const c = glob(b).filter(x => /^chromium-\d+$/.test(x)).sort().pop(); const p = c && path.join(b, c, 'chrome-linux', 'chrome'); return p && fs.existsSync(p) ? p : undefined; })();
const results = []; const ok = (name, cond, info) => { results.push({ name, ok: !!cond, info: info || '' }); console.log((cond ? '✓ ' : '✗ ') + name + (info ? ' — ' + info : '')); };
const TABS = ['now', 'op', 'algi', 'chart', 'watch', 'live', 'lab', 'brief', 'reg', 'mov', 'heat', 'kap', 'cal', 'alarm', 'jr', 'perf', 'risk', 'port', 'crypto', 'set'];
async function page(b, opt) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const hits = await install(p, opt);
  if (opt.proxy) await p.addInitScript(() => localStorage.setItem('tvproxy', JSON.stringify('wss://x.test/k')));
  await p.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const T = (f, arg) => Promise.race([p.evaluate(f, arg), new Promise(r => setTimeout(() => r('__DONMA__'), 6000))]);
  return { p, errs, hits, T };
}
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  try {
    // 1) sunucu adresi yokken
    { const { p, errs, T } = await page(b, { proxy: false }); await p.waitForTimeout(2500);
      ok('açılış (sunucusuz) donmuyor', (await T(() => S.tab)) !== '__DONMA__');
      ok('ilk sekme Şimdi', (await T(() => S.tab)) === 'now');
      await T(() => showTab('lab')); await p.waitForTimeout(1500);
      ok('Karne sunucusuz donmuyor', (await T(() => 1)) === 1);
      ok('sunucusuz sayfa hatası yok', !errs.length, errs.slice(0, 3).join(' | ')); await p.close(); }
    // 2) sunucu hata verirken
    { const { p, errs, T } = await page(b, { proxy: true, fail: true }); await p.waitForTimeout(2500);
      for (const t of ['now', 'lab', 'kap']) { await T(t => showTab(t), t); await p.waitForTimeout(800); }
      ok('sunucu hata verirken donmuyor', (await T(() => 1)) === 1);
      ok('sunucu hatasında Karne mesajı', /alınamadı/.test(await T(() => document.getElementById('labbody').innerText)));
      ok('sunucu hatasında sayfa hatası yok', !errs.length, errs.slice(0, 3).join(' | ')); await p.close(); }
    // 3) sahte veriyle tam gezinti
    { const { p, errs, hits, T } = await page(b, { proxy: true }); await p.waitForTimeout(4000);
      await T(async () => { try { await loadUniverse(); } catch (e) {} });
      ok('piyasa verisi yüklendi', (await T(() => (S.uni || []).length)) > 10);
      for (const t of TABS) {
        const e0 = errs.length; const r = await T(t => { showTab(t); return 1; }, t); await p.waitForTimeout(600);
        const on = await T(t => { const e = document.getElementById('t-' + t); return !!(e && e.classList.contains('on')); }, t);
        ok('sekme ' + t, r === 1 && on === true && errs.length === e0, errs.slice(e0).join(' | '));
        await p.screenshot({ path: path.join(OUT, 'sekme_' + t + '.png') });
      }
      const bad = await T(() => { const b = []; for (const k of Object.keys(IC)) { try { infoOpen(k); if (document.getElementById('infobody').innerText.length < 60) b.push(k); } catch (e) { b.push(k + ':' + e.message); } } infoClose(); return b; });
      ok('bilgi kartlarının hepsi açılıyor', Array.isArray(bad) && !bad.length, String(bad));
      await T(() => sigToast({ src: 'algi', sym: 'ASELS', dir: 'AL', label: 'TEST', why: ['a'], entry: 10, stop: 9.9, tgt: 10.2 }));
      await p.waitForTimeout(600);
      ok('bildirim kartı görünüyor', await T(() => document.getElementById('sigtoast').classList.contains('on')));
      await T(() => document.querySelector('#sigtoast .stb button:last-child').click()); await p.waitForTimeout(500);
      ok('bildirimden günlüğe eklendi', await T(() => S.jr.some(j => j.s === 'ASELS' && j.k === 'algi')));
      // hata defteri + ekran koruması
      await T(() => { const o = window.renderReg; let once = 0; window.renderReg = renderReg = function () { if (!once++) throw new Error('test-ekran-hatasi'); return o.apply(this, arguments); }; });
      await T(() => { setTimeout(() => { throw new Error('test-sayfa-hatasi'); }, 0); showTab('reg'); });
      await p.waitForTimeout(5000);
      const ms = hits.errlog.map(x => x.k + ':' + x.m);
      ok('hata deftere gönderildi', ms.some(m => /test-sayfa-hatasi/.test(m)), ms.join(' | '));
      ok('hatalı ekran yeniden çizildi', ms.some(m => /toparlama:ekran yeniden çizildi/.test(m)), ms.join(' | '));
      const real = errs.filter(e => !/test-/.test(e));
      ok('gezintide sayfa hatası yok', !real.length, real.slice(0, 3).join(' | '));
      await p.close(); }
  } catch (e) { ok('test çalıştırma', false, e.message); }
  await b.close();
  const f = results.filter(r => !r.ok);
  fs.writeFileSync(path.join(OUT, 'ui_sonuc.json'), JSON.stringify(results, null, 1));
  console.log('\nUI: ' + (results.length - f.length) + '/' + results.length + ' geçti');
  process.exit(f.length ? 1 : 0);
})();
