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
  if (opt.owner) await p.addInitScript(() => { localStorage.setItem('ownTok', JSON.stringify('sahipkodu')); localStorage.setItem('ownClaimed', '1'); localStorage.setItem('tgTok', JSON.stringify('1:x')); localStorage.setItem('tgChat', JSON.stringify('1')); });
  await p.goto(FILE + (opt.qs || ''), { waitUntil: 'domcontentloaded', timeout: 20000 });
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
      await T(() => { NOWK.t = 0; window.nowSess = () => ({ open: true, pre: false, m: 840, wd: 3, wk: true }); nowKapLoad(); });
      await p.waitForTimeout(1500); await T(() => { showTab('now'); renderNow(); });
      ok('KAP metnindeki HTML çalıştırılmadı (Şimdi)', await T(() => !window.__XSS && !document.querySelector('#nowbody img') && /<img/.test(document.getElementById('nowbody').innerText)));
      await T(() => showTab('kap')); await p.waitForTimeout(1200);
      ok('KAP metnindeki HTML çalıştırılmadı (KAP Haber)', await T(() => !window.__XSS && !document.querySelector('#kapbody img')));
      const bad = await T(() => { const b = []; for (const k of Object.keys(IC)) { try { infoOpen(k); if (document.getElementById('infobody').innerText.length < 60) b.push(k); } catch (e) { b.push(k + ':' + e.message); } } infoClose(); return b; });
      ok('bilgi kartlarının hepsi açılıyor', Array.isArray(bad) && !bad.length, String(bad));
      await T(() => sigToast({ src: 'algi', sym: 'ASELS', dir: 'AL', label: 'TEST', why: ['a'], entry: 10, stop: 9.9, tgt: 10.2 }));
      await p.waitForTimeout(600);
      ok('bildirim kartı görünüyor', await T(() => document.getElementById('sigtoast').classList.contains('on')));
      await T(() => document.querySelector('#sigtoast .stb button:last-child').click()); await p.waitForTimeout(500);
      ok('bildirimdeki "Aldım" lot penceresini açıyor', await T(() => document.getElementById('aldim').classList.contains('on')));
      await T(() => document.querySelector('#aldim .g.pri').click()); await p.waitForTimeout(700);
      ok('Aldım → günlüğe eklendi', await T(() => S.jr.some(j => j.s === 'ASELS' && j.k === 'algi' && j.posId)));
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
    // 4) iş bilgisayarı motoru (sunucu modu)
    { const { p, errs, hits, T } = await page(b, { proxy: true, owner: true, qs: '?bot=1' }); await p.waitForTimeout(6000);
      ok('motor modu açıldı', await T(() => window.BOTMODE === true && S.autoOn === 1));
      ok('motor nabız veriyor (sunucuya bot=1 + sahip kodu)', hits.urls.some(u => /\/hello\?.*bot=1.*own=sahipkodu|\/hello\?.*own=sahipkodu.*bot=1/.test(u)), hits.urls.filter(u => u.includes('hello')).slice(0, 2).join(' | '));
      const b1 = await T(() => BOT.beat); await p.waitForTimeout(5500); const b2 = await T(() => BOT.beat);
      ok('motor kalp atışı güncelleniyor (Windows bekçisi için)', b2 > b1);
      ok('motor modunda Algı açık', await T(() => !!(S.algi && S.algi.cfg && S.algi.cfg.on)));
      ok('motor modunda sayfa hatası yok', !errs.length, errs.slice(0, 2).join(' | ')); await p.close(); }
    // 4b) şirket ağı kütüphane adreslerini engellerse motor yine çalışmalı
    { const { p, errs, T } = await page(b, { proxy: true, owner: true, qs: '?bot=1', nolib: true }); await p.waitForTimeout(6000);
      ok('kütüphaneler engelliyken motor açılıyor', await T(() => window.BOTMODE === true && window.LC_STUB === 1 && typeof BOT === 'object'));
      const b1 = await T(() => BOT.beat); await p.waitForTimeout(5500);
      ok('kütüphaneler engelliyken kalp atışı sürüyor', (await T(() => BOT.beat)) > b1);
      for (const t of ['now', 'op', 'algi', 'chart']) await T(t => showTab(t), t);
      await p.waitForTimeout(800);
      ok('kütüphaneler engelliyken sayfa hatası yok', !errs.length, errs.slice(0, 3).join(' | ')); await p.close(); }
    // 5) telefon: motor canlıyken Telegram'a göndermez, otomatik taramayı motora bırakır
    { const { p, errs, T } = await page(b, { proxy: true, owner: true, bot: true }); await p.waitForTimeout(4000);
      await T(() => devHello()); await p.waitForTimeout(800);
      ok('telefon motorun çalıştığını biliyor', await T(() => S.botAlive === true));
      const n = await T(async () => { let c = 0; const o = window.loadUniverse; window.loadUniverse = loadUniverse = async () => { c++; }; S.autoOn = 1; await autoRun(false); window.loadUniverse = loadUniverse = o; return c; });
      ok('motor canlıyken telefon otomatik tarama yapmıyor', n === 0, 'tarama=' + n);
      await T(() => { showTab('now'); renderNow(); });
      ok('Şimdi ekranında motor durumu görünüyor', /İş bilgisayarı motoru: çalışıyor/.test(await T(() => document.getElementById('nowbody').innerText)));
      const ec = await T(() => { const n = Date.now(); ECAL.list = [{ t: n + 20 * 60e3, c: 'US', ti: 'Non Farm Payrolls', im: 1, f: 120, p: 142, u: 'K' }, { t: n + 3 * 3600e3, c: 'TR', ti: 'Interest Rate Decision', im: 1, f: 39.5, p: 40.5, u: '%' }]; ECAL.t = n;
        const k = Object.keys(S.umap)[0]; S.umap[k].earnings_release_next_date = Math.floor(n / 1000) + 86400; renderNow(); const tx = document.getElementById('nowbody').innerText;
        return { cal: /Tarım dışı istihdam/.test(tx) && /Faiz kararı/.test(tx), warn: !!document.querySelector('#nowbody .nwarn'), notes: sigNotes(k).join('|'), msg: /⚠️/.test(sigNoteTxt(k)) }; });
      ok('ekonomik takvim kartı Türkçe görünüyor', ec.cal);
      const su = await T(() => { let got = null; const o = window.cloudLoad; window.cloudLoad = cloudLoad = a => { got = a; }; const old = LS.get('ownTok', ''); setupFromText('PUSULA|wss://x.test/k|kod123'); const r = { got, own: LS.get('ownTok', '') }; LS.set('ownTok', old); window.cloudLoad = cloudLoad = o; return r; });
      const al = await T(() => { S.cap = 100000; S.rskp = 1; aldimOpen({ sym: 'THYAO', src: 'algi', entry: 100, stop: 98, tgt: 102 }); document.getElementById('ad_e').value = '100'; document.getElementById('ad_sp').value = '98'; document.getElementById('ad_lot').value = ''; aldimCalc(); const r = { lot: document.getElementById('ad_lot').value, txt: document.getElementById('ad_info').innerText }; aldimClose(); return r; });
      ok('Aldım: 100.000 ₺ sermaye, %1 risk, 2 ₺ stop mesafesi → 500 lot', al.lot === '500', JSON.stringify(al));
      const ja = await T(() => { const o = S.jr; S.jr = [1, -1, 2, -0.5, 1.5, 0.8].map((p, i) => ({ s: 'H' + i, k: i % 2 ? 'algi' : 'momentum', e: 10, l: 9.8, r: p, pct: p, dt: '2026-10-05 0' + (7 + (i % 3)) + ':30', closeD: '2026-10-05' })); const h = jrAnalysis(); S.jr = o; return h; });
      ok('İşlem analizim: kazanma oranı ve saat/kaynak tablosu çıkıyor', /%67/.test(ja) && /Kaynak/.test(ja) && /Saat/.test(ja));
      const pp = await T(() => { paperLoad(true); return new Promise(res => setTimeout(() => { const now = paperCard(), full = paperFull(); res({ now, full }); }, 1500)); });
      ok('Kâğıt bot: Şimdi kartı toplam TL gösteriyor', /Kâğıt üzerinde bot/.test(pp.now) && /\+140 TL/.test(pp.now) && /BOTUN KASASI/.test(pp.now), pp.now.slice(0, 200));
      ok('Kâğıt bot: Karne bölümü gün gün, kaynak ve açık işlem tablosu', /Gün gün/.test(pp.full) && /botta kapalı/.test(pp.full) && /ASELS/.test(pp.full) && /Botun kuralları/.test(pp.full) && /Bot yarışı/.test(pp.full) && /henüz ölçülmedi/.test(pp.full) && /YARIŞINDA ÖNDE/.test(pp.now));
      ok('Deneme laboratuvarı listeleniyor', await T(() => /Deneme laboratuvarı/.test(labHtml()) && /Momentum/.test(labHtml())));
      ok('yeni ikon kurulumu: yapıştırılan bilgi adres + kodu yerine koyuyor', su.got === 'wss://x.test/k' && su.own === 'kod123', JSON.stringify(su));
      const mm = await T(() => { const D = []; let c = 100; for (let i = 0; i < 25; i++) { c = i === 24 ? c * 1.04 : i >= 20 ? c * 1.01 : c; D.push({ open: c, high: c * 1.035, low: c * 0.965, close: c, volume: 2e6 }); }
        const r = momCalc(D, D[24].close * 1.005), r2 = momCalc(D, D[24].close * 1.02); return { ok: r.ok, d1: r.d1, d5: r.d5, adr: r.adr, late: r2.ok }; });
      ok('momentum kuralı: dün +%3, 5 gün +%5, oynak, sabah koşmamış → aday; koşmuşsa değil', mm.ok && !mm.late, JSON.stringify(mm));
      ok('yaklaşan veri için uyarı çıkıyor', ec.warn);
      ok('sinyal notu: bilanço yarın + veri saati', /Bilanço yarın/.test(ec.notes) && /ABD verisi/.test(ec.notes) && ec.msg, ec.notes);
      await T(() => { const d = document.createElement('div'); d.id = 'pairbox'; document.body.appendChild(d); });
      await T(() => pairStart()); await p.waitForTimeout(800);
      ok('eşleştirme kodu ve kurulum komutu gösteriliyor', /ABCDE-FGH23/.test(await T(() => document.getElementById('pairbox').innerText)) && /kur\.ps1/.test(await T(() => document.getElementById('pairbox').innerText)));
      ok('telefon modunda sayfa hatası yok', !errs.length, errs.slice(0, 2).join(' | ')); await p.close(); }
  } catch (e) { ok('test çalıştırma', false, e.message); }
  await b.close();
  const f = results.filter(r => !r.ok);
  fs.writeFileSync(path.join(OUT, 'ui_sonuc.json'), JSON.stringify(results, null, 1));
  console.log('\nUI: ' + (results.length - f.length) + '/' + results.length + ' geçti');
  process.exit(f.length ? 1 : 0);
})();
