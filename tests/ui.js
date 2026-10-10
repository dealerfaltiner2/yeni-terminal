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
      const xr = await T(() => new Promise(res => { const o = S.uni.slice().sort((a, b) => b.voltl - a.voltl)[0]; const cs = []; let px = o.close * 0.95; const t0 = Math.floor(Date.now() / 1000) - 200 * 900;
        for (let i = 0; i < 200; i++) { const op = px; px = px * (1.0015 + Math.sin(i / 5) * 0.002); cs.push({ time: t0 + i * 900, open: op, high: Math.max(op, px) * 1.002, low: Math.min(op, px) * 0.998, close: px, volume: 1e5 }); }
        S.ccache['b:' + o.name + ':15min'] = { t: Date.now(), d: cs }; xrayOpen(o.name);
        setTimeout(() => { const t = document.getElementById('xr_body').textContent; xrayGo('YOKBOYLE1'); setTimeout(() => { const t2 = document.getElementById('xr_body').innerText; xrayClose(); res({ t, t2 }); }, 200); }, 1500); }));
      ok('Hisse röntgeni: not, ön şartlar, puan, seviyeler, karne görünüyor', /Ön şartlar/i.test(xr.t) && /Puan: 6'da/i.test(xr.t) && /Seviyeler/i.test(xr.t) && /karnesi/i.test(xr.t) && /tavsiyesi değildir/.test(xr.t), xr.t.slice(0, 160));
      ok('Hisse röntgeni: olmayan hisse için uyarı', /bulamadım/.test(xr.t2));
      ok('Hisse röntgeni: büyük kapat düğmesi ve ana ekrana dön çalışıyor', await T(() => { xrayOpen(); const b = document.querySelector('#xray .xcl').getBoundingClientRect(); document.querySelector('#xray .xback').click(); return b.width >= 40 && b.height >= 40 && !document.getElementById('xray').classList.contains('on'); }));
      ok('Fırsat kartında ölçerler Detay\'a basmadan görünüyor', await T(() => { showTab('op'); const c = document.querySelector('#oplist .card.v6'); return !!c && !!c.querySelector(':scope > .mts') && !!c.querySelector(':scope > .mtf'); }));
      { const T0 = Date.UTC(2026, 8, 1, 7, 0) / 1000, bars = []; let px = 10, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let day = 0; day < 30; day++) { const d0 = T0 + day * 86400; if ([0, 6].includes(new Date(d0 * 1000).getUTCDay())) continue;
          for (let k = 0; k < (day === 29 ? 2 : 33); k++) { const o = px; px = px * (1 + (rnd() - 0.45) * 0.01); bars.push([d0 + k * 900, o, Math.max(o, px) * 1.003, Math.min(o, px) * 0.997, px, Math.round(1e4 * (0.5 + rnd()))]); } }
        const { riseRows } = await import(require('path').resolve(__dirname, '..', 'worker', 'src', 'rise.js'));
        const R = riseRows(bars, []).pop();
        const c = await T(b => { const cs = b.map(x => ({ time: x[0], open: x[1], high: x[2], low: x[3], close: x[4], volume: x[5] })); const today = Math.floor((b[b.length - 1][0] + 10800) / 86400); return sesCalc(cs, today); }, bars);
        const eq = (a, b) => Math.abs(a - b) < 0.02;
        ok('Sessiz trend: canlı hesap araştırmayla birebir (20g, zirve, hacim, aralık, oynaklık)', c && R && eq(c.d20, R[8]) && eq(c.dist, R[9]) && eq(c.vr30, R[5]) && eq(c.rr, R[21] / R[22]) && eq(c.adr, R[22]), JSON.stringify({ c, R: R && [R[8], R[9], R[5], R[21], R[22]] })); }
      const yr = await T(() => new Promise(res => { yorumLoad(true); setTimeout(() => { renderNow(); const e = document.querySelector('#nowbody .yrm'); res({ hd: document.getElementById('nowbody').textContent.includes('Pusula\'nın piyasa yorumu'), txt: e ? e.textContent : '', xss: !!window.__XSS || !!document.querySelector('#nowbody .yrm img'), b: !!(e && e.querySelector('.yrm-b b')) }); }, 1200); }));
      ok('Claude yorumu Şimdi ekranında (kalın yazı, maddeler, önceki yorumlar)', /Açılış sonrası/.test(yr.txt) && /Bankalar güçlü/.test(yr.txt) && /Önceki yorumlar/.test(yr.txt) && yr.b && yr.hd, yr.txt.slice(0, 120));
      ok('Claude yorumundaki HTML çalıştırılmadı', !yr.xss);
      { const g = await T(() => { const D = []; let c = 100; for (let i = 0; i < 25; i++) { const h = c * 1.04, l = c * 0.97; D.push({ open: c, high: h, low: l, close: c, volume: 1e6 }); } D[24] = { open: 100, high: 104, low: 96, close: 103, volume: 1e6 };
          return { a: dgCalc(D, 103.5), b: dgCalc(D, 105), c: dgCalc(D.map((x, i) => i === 24 ? { ...x, close: 97 } : x), 97.2) }; });
        ok('Dün güçlü kapanış: kural hesabı (kapanış yeri, oynaklık, 10:30 yatay)', g.a && g.a.ok && Math.abs(g.a.yc - 0.875) < 1e-6 && Math.abs(g.a.adr - 7.05) < 0.01 && g.b && !g.b.ok && g.c && !g.c.ok, JSON.stringify(g)); }
      { const f = await T(() => { const t = Date.UTC(2026, 9, 12, 8, 30); FLOW.st = {}; FLOW.cur = {};   // Pazartesi 11:30 İstanbul
          flowTick('ZZT', { lp: 10, volume: 1000, bid: 9.99, ask: 10.01 }, t);   // ilk mesaj: sayılmaz
          flowTick('ZZT', { lp: 10.01, volume: 1500 }, t);                       // satış fiyatından → alıcılı 500
          flowTick('ZZT', { lp: 9.99, volume: 1800 }, t);                        // alış fiyatından → satıcılı 300
          flowTick('ZZT', { bid: 9.98, ask: 10 }, t);                            // yalnız kademe değişti
          flowTick('ZZT', { lp: 9.99, volume: 1900 }, t);                        // arada, fiyat aynı → önceki yön (satıcılı) 100
          flowTick('ZZT', { lp: 10, volume: 2000 }, t);                          // satış fiyatında → alıcılı 100
          flowTick('ZZT', { lp: 10, volume: 2100 }, Date.UTC(2026, 9, 10, 8, 30));   // Cumartesi → sayılmaz
          const r = FLOW.cur['2026-10-12|690'] && FLOW.cur['2026-10-12|690'].ZZT; FLOW.cur = {}; FLOW.st = {}; return r; });
        ok('emir akışı: alıcılı/satıcılı ayrımı (motor kaydı)', f && f[0] === 690 && f[1] === 600 && f[2] === 400 && f[3] === 0 && f[4] === 4 && f[5] === 10 && f[6] === 9.98 && f[7] === 10, JSON.stringify(f)); }
      { const og = await T(() => { const U = [{ name: 'AA', close: 103, open: 100, change: 4, market_cap_basic: 9e9 }, { name: 'BB', close: 101, open: 100, change: 1, market_cap_basic: 8e9 },
          { name: 'CC', close: 110, open: 100, change: 8, market_cap_basic: 7e9 }, { name: 'DD', close: 105, open: 100, change: 5, market_cap_basic: 6e9 }];
          return { a: ogPick(U, 1.0).map(x => x.s).join(), b: ogPick(U, 0.5).length }; });
        ok('Öğle trend günü: endeks ≥+0,8 iken açılıştan ≥+%2, tavana yakın olmayan, en güçlü önce', og.a === 'DD,AA' && og.b === 0, JSON.stringify(og)); }
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
