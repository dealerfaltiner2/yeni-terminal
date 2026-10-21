// Terminal arayüz testi (Playwright). Çıkış kodu 0 = hepsi geçti. Ekran görüntüleri tests/out/ içine.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), glob = d => { try { return fs.readdirSync(d) } catch (e) { return [] } };
const { install } = require('./mock');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const exe = (() => { const b = '/opt/pw-browsers'; const c = glob(b).filter(x => /^chromium-\d+$/.test(x)).sort().pop(); const p = c && path.join(b, c, 'chrome-linux', 'chrome'); return p && fs.existsSync(p) ? p : undefined; })();
const results = []; const ok = (name, cond, info) => { results.push({ name, ok: !!cond, info: info || '' }); console.log((cond ? '✓ ' : '✗ ') + name + (info ? ' — ' + info : '')); };
const TABS = ['now', 'op', 'algi', 'chart', 'watch', 'live', 'lab', 'kesif', 'brief', 'reg', 'mov', 'heat', 'kap', 'cal', 'alarm', 'jr', 'perf', 'risk', 'port', 'crypto', 'set'];
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
        const on = await T(t => { if (t === 'set' && guestHideSet()) return S.tab === 'now'; const e = document.getElementById('t-' + t); return !!(e && e.classList.contains('on')); }, t);
        ok('sekme ' + t, r === 1 && on === true && errs.length === e0, errs.slice(e0).join(' | '));
        await p.screenshot({ path: path.join(OUT, 'sekme_' + t + '.png') });
      }
      await T(() => { NOWK.t = 0; window.nowSess = () => ({ open: true, pre: false, m: 840, wd: 3, wk: true }); nowKapLoad(); });
      await p.waitForTimeout(1500); await T(() => { NOWF.f_kap = 1; showTab('now'); renderNow(); });
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
      ok('Şimdi ekranında motor durumu görünüyor', /Ana sunucu: çalışıyor/.test(await T(() => document.getElementById('nowbody').innerText)));
      const ec = await T(() => { const n = Date.now(); ECAL.list = [{ t: n + 20 * 60e3, c: 'US', ti: 'Non Farm Payrolls', im: 1, f: 120, p: 142, u: 'K' }, { t: n + 3 * 3600e3, c: 'TR', ti: 'Interest Rate Decision', im: 1, f: 39.5, p: 40.5, u: '%' }]; ECAL.t = n;
        const k = Object.keys(S.umap)[0]; S.umap[k].earnings_release_next_date = Math.floor(n / 1000) + 86400; renderNow(); const tx = document.getElementById('nowbody').innerText;
        return { cal: /Tarım dışı istihdam/.test(tx) && /Faiz kararı/.test(tx), warn: !!document.querySelector('#nowbody .nwarn'), notes: sigNotes(k).join('|'), msg: /⚠️/.test(sigNoteTxt(k)) }; });
      ok('ekonomik takvim kartı Türkçe görünüyor', ec.cal);
      const su = await T(() => { let got = null; const o = window.cloudLoad; window.cloudLoad = cloudLoad = a => { got = a; }; const old = LS.get('ownTok', ''); setupFromText('PUSULA|wss://x.test/k|kod123'); const r = { got, own: LS.get('ownTok', '') }; LS.set('ownTok', old); window.cloudLoad = cloudLoad = o; return r; });
      const al = await T(() => { S.cap = 100000; S.rskp = 1; aldimOpen({ sym: 'THYAO', src: 'algi', entry: 100, stop: 98, tgt: 102 }); document.getElementById('ad_e').value = '100'; document.getElementById('ad_sp').value = '98'; document.getElementById('ad_lot').value = ''; aldimCalc(); const r = { lot: document.getElementById('ad_lot').value, txt: document.getElementById('ad_info').innerText }; aldimClose(); return r; });
      ok('Aldım: 100.000 ₺ sermaye, %1 risk, 2 ₺ stop mesafesi → 500 lot', al.lot === '500', JSON.stringify(al));
      const ja = await T(() => { const o = S.jr; S.jr = [1, -1, 2, -0.5, 1.5, 0.8].map((p, i) => ({ s: 'H' + i, k: i % 2 ? 'algi' : 'momentum', e: 10, l: 9.8, r: p, pct: p, dt: '2026-10-05 0' + (7 + (i % 3)) + ':30', closeD: '2026-10-05' })); const h = jrAnalysis(); S.jr = o; return h; });
      ok('İşlem analizim: kazanma oranı ve saat/kaynak tablosu çıkıyor', /%67/.test(ja) && /Kaynak/.test(ja) && /Saat/.test(ja));
      const tb = await T(() => { TEDB.map = { ZZZ: [{ k: 'brut', ad: 'Brüt takas', t: Date.now() - 864e5 }] }; const n = sigNotes('ZZZ'), f = sigFund('ZZZ'), f2 = sigFund(S.uni[0].name); TEDB.map = {}; return { n: n.join(' | '), f, f2 }; });
      ok('Borsa tedbiri: sinyal uyarısı ve karne notu (tb), göreli hacim notu (rv)', /Borsa tedbiri: Brüt takas \(\d\d\.\d\d\)/.test(tb.n) && tb.f && tb.f.tb === 'brut' && tb.f2 && !tb.f2.tb, JSON.stringify(tb));
      const dvx = await T(() => { const k = S.uni[0].name, o = S.umap[k], old = o.ex_dividend_date_upcoming; o.ex_dividend_date_upcoming = Math.floor(Date.now() / 1000) + 86400; const n = sigNotes(k).join(' | '), f = sigFund(k); o.ex_dividend_date_upcoming = old; return { n, dv: f && f.dv }; });
      ok('Temettü: yarın hak kullanımı uyarısı ve karne notu (dv)', /Yarın temettü hak kullanımı/.test(dvx.n) && dvx.dv === 1, JSON.stringify(dvx));
      const tm = await T(() => { const a = document.documentElement.classList.contains('cam'); temaSet('klasik'); const b = document.documentElement.classList.contains('cam'), on = (document.querySelector('#temaseg button.on') || {}).dataset; temaSet('cam'); return { a, b, on: on && on.v, c: document.documentElement.classList.contains('cam') }; });
      ok('Cam görünüm: varsayılan açık, Klasik ile kapanır, geri açılır', tm.a && !tm.b && tm.on === 'klasik' && tm.c, JSON.stringify(tm));
      const dfx = await T(() => { delete S.deep.ZZQ; return { al: deepFlags('ZZQ', 'AL', { pull: { bars: 2 }, kvw: { side: 'AL' }, ref: {}, pocD: 0.3, valD: 2, vahD: 2 }), sat: deepFlags('ZZQ', 'SAT', { pull: { bars: 2 }, kvw: { side: 'AL' } }) }; });
      ok('Otomatik taramada derin kurulumlar (geri çekilme, Keskin VWAP, POC) karneye yazılır', dfx.al.join() === 'pull,kvw,poc' && dfx.sat.length === 0, JSON.stringify(dfx));
      const tgx = await T(() => ({ c: tgCard({ ic: '🟢', dir: 'AL', sym: 'THYAO', src: 'Fırsat · A notu', name: 'Türk <Hava>', px: 312.5, ch: 1.41, tp: 312.5 * 1.03, sl: 312.5 * 0.99, why: ['VWAP dönüşü'], more: 'Hacim profili' }), k: tgKb('THYAO', 123), p: tgPlain('<b>A</b>\n<blockquote>x &amp; y</blockquote>z') }));
      ok('Telegram kart düzeni: fiyat kutusu, kopyalanır rakam, katlanır ayrıntı, düğmeler, düz metin yedeği', /<blockquote>Giriş   <code>312,50<\/code>/.test(tgx.c) && /Hedef   <code>321,88<\/code>   \+%3\n/.test(tgx.c) && /−%1<\/blockquote>/.test(tgx.c) && /Türk &lt;Hava&gt;/.test(tgx.c) && /<blockquote expandable>/.test(tgx.c) && tgx.k.inline_keyboard[1].length === 2 && /BIST%3ATHYAO/.test(tgx.k.inline_keyboard[1][1].url) && /t\.me\/BistPusulaBot\?startapp=THYAO$/.test(tgx.k.inline_keyboard[0][0].url) && tgx.p === 'A\nx & y\nz', JSON.stringify(tgx));
      const pus = await T(() => { renderNow(); return { d: nDial(), now: document.getElementById('nowbody').innerHTML.slice(0, 4000), tab: !!document.querySelector('#tabs button[data-t="lab"]'), chart: !!document.querySelector('#more [data-t="chart"]') }; });
      ok('Pusula ana sayfa: kadran, alt menüde Karne, Grafik menüde', /class="pcomp"/.test(pus.d) && /class="phero"/.test(pus.now) && pus.tab && pus.chart, JSON.stringify({ tab: pus.tab, chart: pus.chart }));
      const ak = await T(() => { const oK = window.KSTAT, oJ = S.jr, oM = S.mkt; const td = todayStr();
        window.KSTAT = { _t: Date.now(), gun: 10, src: { tavan: { n: 134, h: 45, s: 81, r0: 2 }, 'firsat-B': { n: 600, h: 56, s: 350, r0: 120 } }, up: { tavan: { n: 98, h: 32, s: 59, r0: 0 }, 'firsat-B': { n: 247, h: 24, s: 145, r0: 44 } }, dn: { 'kap-geri': { n: 86, h: 13, s: 59, r0: 5.6 }, tavan: { n: 36, h: 10, s: 22, r0: 1.7 }, 'firsat-B': { n: 361, h: 32, s: 211, r0: 75 }, sessiz: { n: 9, h: 0, s: 6, r0: 1 } } };
        S.mkt = Object.assign({}, oM, { XU100: { c: 10000, ch: -1.2 } });
        const Y = pusYon(), g = nGuven(), a1 = nAkil(Y), src = pusGuvenSrc('tavan');
        S.jr = (oJ || []).concat([{ s: 'AAA', d: 'AL', k: 'algi', e: 10, l: 9.9, r: -1, pct: -1, closeD: td, dt: td + ' 08:00' }, { s: 'BBB', d: 'AL', k: 'algi', e: 10, l: 9.9, r: -1, pct: -1, closeD: td, dt: td + ' 09:00' }]);
        const a2 = nAkil(Y); renderNow(); const html = document.getElementById('nowbody').innerHTML, folds = document.querySelectorAll('#nowbody .pfo').length, open = document.querySelectorAll('#nowbody .pfb').length;
        window.KSTAT = oK; S.jr = oJ; S.mkt = oM; return { y: Y && Y.sc, lab: Y && Y.lab, g, a1, a2, src, folds, open, dial: /class="pcomp"/.test(html) && /yön puanı/.test(html) }; });
      ok('Akıllı pusula: yön puanı hesaplanıyor, endeks eksi günlerin karnesi (Tavan önde, Fırsat B kaybettiriyor, sessiz yok), güven notu', typeof ak.y === 'number' && /Bugünkü gibi günlerde/.test(ak.g) && /eksideyken/.test(ak.g) && ak.g.indexOf('Tavan takibi') < ak.g.indexOf('Fırsat B') && !/sessiz/i.test(ak.g) && /kaybettiren[^.]*Fırsat B/.test(ak.a1) && /bu havada %31 hedef/.test(ak.src), JSON.stringify({ y: ak.y, a1: ak.a1.slice(0, 400), src: ak.src }));
      ok('Günlük fren: bugün 2 zararlı işlem → "Bugün dur"', /Bugün dur/.test(ak.a2) && !/Bugün dur/.test(ak.a1));
      ok('Sade ana sayfa: kadran + katlanır bölümler (kapalı başlar)', ak.dial && ak.folds >= 5 && ak.open <= 2, JSON.stringify({ folds: ak.folds, open: ak.open }));
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
      const yr = await T(() => new Promise(res => { yorumLoad(true); NOWF.f_yrm = 1; setTimeout(() => { renderNow(); const e = document.querySelector('#nowbody .yrm'); res({ hd: document.getElementById('nowbody').textContent.includes('Pusula\'nın piyasa yorumu'), txt: e ? e.textContent : '', xss: !!window.__XSS || !!document.querySelector('#nowbody .yrm img'), b: !!(e && e.querySelector('.yrm-b b')) }); }, 1200); }));
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
      { const fu = await T(() => { S.umap = S.umap || {}; S.umap.ZZF = { price_earnings_ttm: 12.345, price_book_fundamental: 1.234, market_cap_basic: 45.6e9 }; S.umap.ZZG = { price_earnings_ttm: null };
          const r = [sigFund('ZZF'), sigFund('ZZG'), sigFund('YOKYOK')]; delete S.umap.ZZF; delete S.umap.ZZG; return r; });
        ok('sinyale temel oran notu (F/K, PD/DD, piyasa değeri)', fu[0] && fu[0].pe === 12.3 && fu[0].pb === 1.23 && fu[0].mc === 45.6 && fu[1] === null && fu[2] === null, JSON.stringify(fu)); }
      ok('Deneme laboratuvarı listeleniyor', await T(() => /Deneme laboratuvarı/.test(labHtml()) && /Momentum/.test(labHtml())));
      ok('yeni ikon kurulumu: yapıştırılan bilgi adres + kodu yerine koyuyor', su.got === 'wss://x.test/k' && su.own === 'kod123', JSON.stringify(su));
      const mm = await T(() => { const D = []; let c = 100; for (let i = 0; i < 25; i++) { c = i === 24 ? c * 1.04 : i >= 20 ? c * 1.01 : c; D.push({ open: c, high: c * 1.035, low: c * 0.965, close: c, volume: 2e6 }); }
        const r = momCalc(D, D[24].close * 1.005), r2 = momCalc(D, D[24].close * 1.02); return { ok: r.ok, d1: r.d1, d5: r.d5, adr: r.adr, late: r2.ok }; });
      ok('momentum kuralı: dün +%3, 5 gün +%5, oynak, sabah koşmamış → aday; koşmuşsa değil', mm.ok && !mm.late, JSON.stringify(mm));
      { const mr = await T(() => [momRepPick({ ok: true, src: [{ src: 'momentum', son: '2026-10-14' }] }, '2026-10-16'), momRepPick({ ok: true, src: [{ src: 'momentum', son: '2026-10-05' }] }, '2026-10-16'), momRepPick({ ok: true, src: [{ src: 'algi', son: '2026-10-15' }] }, '2026-10-16'), momRepPick(null, '2026-10-16')]);
        ok('momentum tekrar uyarısı: son 6 gün içindeyse tarih, değilse boş', mr[0] === '2026-10-14' && mr[1] === '' && mr[2] === '' && mr[3] === '', JSON.stringify(mr)); }
      ok('yaklaşan veri için uyarı çıkıyor', ec.warn);
      ok('sinyal notu: bilanço yarın + veri saati', /Bilanço yarın/.test(ec.notes) && /ABD verisi/.test(ec.notes) && ec.msg, ec.notes);
      await T(() => { const d = document.createElement('div'); d.id = 'pairbox'; document.body.appendChild(d); });
      await T(() => pairStart()); await p.waitForTimeout(800);
      ok('eşleştirme kodu ve kurulum komutu gösteriliyor', /ABCDE-FGH23/.test(await T(() => document.getElementById('pairbox').innerText)) && /kur\.ps1/.test(await T(() => document.getElementById('pairbox').innerText)));
      ok('telefon modunda sayfa hatası yok', !errs.length, errs.slice(0, 2).join(' | ')); await p.close(); }
    // v11.7 Telegram mini uygulaması: ilk açılışta Telegram kimliğiyle giriş, sonra startapp hissesinin röntgeni + geri tuşu
    { const tgMock = () => { window.Telegram = { WebApp: { initData: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x', initDataUnsafe: { start_param: 'THYAO' }, ready() {}, expand() {}, disableVerticalSwipes() {}, setHeaderColor() {}, setBackgroundColor() {},
        BackButton: { onClick(f) { window.__bb = f; }, show() { window.__bbs = 1; }, hide() { window.__bbs = 0; } } } }; };
      const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await install(p, { proxy: true }); let auth = 0;
      await p.route('https://api.altinerpano.com/tgauth', r => { auth++; r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, owner: true, setup: 'PUSULA|wss://x.test/k|sahipkodu' }) }); });
      await p.addInitScript(tgMock);
      await p.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 20000 }); await p.waitForTimeout(5000);
      const T = f => p.evaluate(f);
      const st = await T(() => ({ px: LS.get('tvproxy', ''), own: LS.get('ownTok', ''), tga: document.documentElement.classList.contains('tga'), x: !!(document.getElementById('xray') && document.getElementById('xray').classList.contains('on')), bbs: window.__bbs }));
      ok('Telegram mini uygulaması: Telegram kimliğiyle giriş (sunucu adresi + sahip kodu), sonra hisse röntgeni açıldı', auth === 1 && st.px === 'wss://x.test/k' && st.own === 'sahipkodu' && st.tga && st.x && st.bbs === 1, JSON.stringify({ auth, st }));
      await T(() => window.__bb()); await p.waitForTimeout(300);
      ok('Telegram geri tuşu röntgeni kapatıyor', await T(() => !document.getElementById('xray').classList.contains('on')));
      ok('Telegram mini uygulamasında sayfa hatası yok', !errs.length, errs.slice(0, 2).join(' | ')); await p.close(); }
    // v12.8 araştırma veri paketi: yalnız sahipte görünür; güncel mumlar toplanıp tek JSON dosyası olur
    { const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await install(p, { proxy: true }); await p.addInitScript(() => { localStorage.setItem('tvproxy', JSON.stringify('wss://x.test/k')); localStorage.setItem('ownClaimed', '1'); localStorage.setItem('ownTok', JSON.stringify('sahipkodu')); });
      await p.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 20000 }); await p.waitForTimeout(2500);
      const vp = await p.evaluate(async () => {
        const asked = []; const of = window.fetch;
        window.fetch = async (u, o) => { u = String(u); if (/\/bars\?/.test(u)) { asked.push(u); const s = decodeURIComponent(/s=([^&]+)/.exec(u)[1]).split(','); const data = {};
            s.forEach(x => { data['BIST:' + x] = x === 'YOKK' ? { bars: [], err: 'yok' } : { bars: [[1790000000, 1, 2, 0.5, 1.5, 100], [1790003600, 1.5, 2, 1, 1.8, 120]] }; });
            return new Response(JSON.stringify({ ok: true, data })); } return of(u, o); };
        let blob = null; URL.createObjectURL = b2 => { blob = b2; return 'blob:x'; };
        showTab('lab'); renderLab(); const card = !!document.querySelector('#labbody .vpk');
        VP.grp = 'el'; VP.el = 'THYAO asels, YOKK'; VP.tf = '60'; VP.n = 1000; await vpRun();
        const j = blob ? JSON.parse(await blob.text()) : null;
        return { card, n: asked.length, keys: j && Object.keys(j.hisseler), bad: j && j.gelmeyen, tf: j && j.tf, msg: VP.msg.slice(0, 80) };
      });
      ok('Araştırma veri paketi: sahipte görünüyor, endeksler + seçilen hisseler tek dosyada, gelmeyen ayrıca yazılı', vp.card && vp.keys && vp.keys.join() === 'XU100,XU030,XBANK,XUSIN,THYAO,ASELS' && vp.bad.join() === 'YOKK' && vp.tf === '60' && /Hazır/.test(vp.msg), JSON.stringify(vp));
      const vpU = await p.evaluate(() => { S.uye = true; return vpHtml() === ''; });
      ok('Araştırma veri paketi üyede görünmüyor', vpU);
      ok('veri paketi sayfasında hata yok', !errs.length, errs.slice(0, 2).join(' | ')); await p.close(); }
    // v12.0 üye sürümü: sunucu 'uye' derse oturumsuz akış, hata yazısı yok, ana sayfada 'Üye sürümü', sinyal kartı yok
    { const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await install(p, { proxy: true }); await p.addInitScript(() => { localStorage.setItem('tvproxy', JSON.stringify('wss://x.test/k')); localStorage.setItem('ownClaimed', '1'); });
      await p.route('**/tv-token**', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, token: '', uye: 1, err: 'üye sürümü' }) }));
      await p.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 20000 }); await p.waitForTimeout(3000);
      const u = await p.evaluate(async () => { TVL.tok = null; TVL.tokAt = 0; const t = await tvToken(); renderNow(); sigToast({ sym: 'THYAO', src: 'algi' });
        return { t, uye: TVL.uye, err: TVL.err, home: /Üye sürümü/.test(document.getElementById('nowbody').innerText), toast: document.getElementById('sigtoast').classList.contains('on') }; });
      ok('Üye sürümü: gecikmeli akış, hata yok, ana sayfada not, anlık sinyal kartı yok', u.t === '' && u.uye === 1 && !u.err && u.home && !u.toast, JSON.stringify(u));
      const v = await p.evaluate(() => { showTab('op'); const a = S.tab; showTab('algi'); const b2 = S.tab; showTab('lab'); const c = S.tab;
        const vis = q => { const e = document.querySelector('#tabs [data-t="' + q + '"]'); return !!e && getComputedStyle(e).display !== 'none'; };
        return { a, b2, c, cls: document.documentElement.classList.contains('uye'), op: vis('op'), algi: vis('algi'), lab: vis('lab') }; });
      const ix = await p.evaluate(async () => { const asked = []; window.tvScan = async (m, b) => { asked.push(m);
          if (m === 'global') return { data: [{ d: ['USDTRY', 41.9, 0.1] }] };
          if (m === 'turkey') return { data: b.symbols.tickers.map(t => ({ d: [t.split(':')[1], t.endsWith('XU100') ? 10850 : 100, -1.2] })) };
          return { data: [] }; };
        document.hidden || await refreshTick(); return { asked, c: S.mkt.XU100 && S.mkt.XU100.c, usd: S.mkt.USD && S.mkt.USD.c }; });
      const inv = await p.evaluate(() => { window.Telegram = { WebApp: { initDataUnsafe: { user: { id: 99887766 } }, openTelegramLink: u => { window.__inv = u; } } };
        renderNow(); const b = document.querySelector('#nowbody .pinv button'); if (b) b.click(); return { card: !!b, link: decodeURIComponent(window.__inv || '') }; });
      ok('Davet kartı: Telegram içinde görünüyor, kişiye özel bağlantıyla paylaşım açılıyor', inv.card && /t\.me\/share\/url\?url=https:\/\/t\.me\/BistPusulaBot\?startapp=r_99887766/.test(inv.link), JSON.stringify(inv));
      ok('BIST 100 genel taramada yoksa Türkiye taramasından alınıyor', ix.c === 10850 && ix.usd === 41.9 && ix.asked.includes('turkey'), JSON.stringify(ix));
      ok('Üye görünümü (B): Fırsat/Algı sekmeleri gizli ve açılmıyor, Karne açık', v.cls && v.a === 'now' && v.b2 === 'now' && v.c === 'lab' && !v.op && !v.algi && v.lab, JSON.stringify(v));
      ok('üye sayfasında hata yok', !errs.length, errs.slice(0, 2).join(' | ')); await p.close(); }
    // v13.0 fiyat aralığı + dönem getirisi + fiyat vurgusu + Keşfet
    { const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await install(p, { proxy: true }); await p.addInitScript(() => { localStorage.setItem('tvproxy', JSON.stringify('wss://x.test/k')); localStorage.setItem('ownClaimed', '1'); localStorage.setItem('ownTok', JSON.stringify('sahipkodu')); });
      await p.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 20000 }); await p.waitForTimeout(3000);
      const fl = await p.evaluate(() => [pxFl('t:A', 10), pxFl('t:A', 10), pxFl('t:A', 11), pxFl('t:A', 9)].join('|'));
      ok('Fiyat vurgusu: yalnız değişince, yükselişte yeşil düşüşte kırmızı', fl === '|| pfu| pfd', fl);
      const rc = await p.evaluate(() => { const d = Date.now(), cs = Array.from({ length: 400 }, (_, i) => { const c = 100 + i; return { time: istD(d - (399 - i) * 864e5), open: c, high: c + 2, low: c - 2, close: c, volume: 10 }; });
        const R = rngCalc(cs, 499, { lo: 495, hi: 505 }); return { day: R.day, yrlo: R.yr.lo, monlo: R.mon.lo, r7: Math.round(R.ret[0][1] * 100) / 100, r52: Math.round(R.ret[4][1] * 100) / 100 }; });
      ok('Aralık/getiri hesabı: gün, ay, yıl düşükleri ve 7 gün / 52 hafta getirisi doğru', rc.day.lo === 495 && rc.monlo === 468 && rc.yrlo === 133 && rc.r7 === 1.42 && rc.r52 === 269.63, JSON.stringify(rc));
      await p.evaluate(() => xrayOpen('THYAO')); await p.waitForTimeout(2500);
      const xr = await p.evaluate(() => { const b2 = document.getElementById('xr_body'); return { rows: b2.querySelectorAll('.rgc .rgr').length, tiles: b2.querySelectorAll('.rtg div').length, txt: b2.textContent }; });
      ok('Röntgen: fiyat aralığı (günlük/aylık/yıllık) ve 6 dönem getirisi görünüyor', xr.rows === 3 && xr.tiles === 6 && /Dönem getirisi/.test(xr.txt) && /son bir yılın en düşüğünden/.test(xr.txt), JSON.stringify({ rows: xr.rows, tiles: xr.tiles }));
      await p.evaluate(() => { xrayClose(); S.mkt = S.mkt || {}; S.mkt.XU100 = { c: 10800, ch: 0.5 }; showTab('now'); renderNow(); }); await p.waitForTimeout(1500);
      const hm = await p.evaluate(() => { renderNow(); const x = document.querySelector('#nowbody .pcard .pxr'); return x ? { rows: x.querySelectorAll('.rgr').length, tiles: x.querySelectorAll('.rtg.mini div').length } : null; });
      ok('Ana sayfa: BIST 100 kartında gün/yıl aralığı ve 6 dönem getirisi', hm && hm.rows === 2 && hm.tiles === 6, JSON.stringify(hm));
      const kh = await p.evaluate(async () => { showTab('kesif'); await new Promise(r => setTimeout(r, 800)); renderKesif(); const el = document.getElementById('kesifbody');
        return { items: el.querySelectorAll('.kesi').length, quick: el.querySelectorAll('.kesq button').length, menu: !!document.querySelector('#more [data-t="kesif"]'), bar: getComputedStyle(document.querySelector('#tabs [data-t="kesif"]')).display }; });
      ok('Keşfet: 3 hızlı liste + 16 hazır liste, menüde ve alt çubukta var', kh.items === 16 && kh.quick === 3 && kh.menu && kh.bar !== 'none', JSON.stringify(kh));
      const ku = await p.evaluate(() => { kesOpen('up'); const el = document.getElementById('kesifbody'), r = [...el.querySelectorAll('.krow')].map(x => parseFloat(x.querySelector('.ksv i').innerText.replace(/[^0-9,−-]/g, '').replace(',', '.').replace('−', '-')));
        return { n: r.length, sorted: r.every((v, i) => !i || r[i - 1] >= v) }; });
      ok('Keşfet: Yükselenler listesi dolu ve büyükten küçüğe', ku.n > 5 && ku.sorted, JSON.stringify(ku));
      const ki = await p.evaluate(() => { S.mkt.USD = { c: 42, ch: 0 }; S.umap.ASELS.market_cap_basic = 100e9; kesOpen('is'); const el = document.getElementById('kesifbody'); return { txt: el.innerText, html: el.innerHTML, first: (el.querySelector('.krow .ksm b') || {}).innerText }; });
      ok('Keşfet: yeni iş listesi tutarı TL\'ye çevirip piyasa değerine oranlıyor, metin kaçışlı', ki.first === 'ASELS' && /5,30 milyar TL/.test(ki.txt) && /%5,3/.test(ki.txt) && /Tutar açıklanmamış/.test(ki.txt) && !/<b>x<\/b>/.test(ki.html), ki.txt.replace(/\s+/g, ' ').slice(0, 400));
      const kg = await p.evaluate(async () => { kesOpen('gc'); for (let i = 0; i < 40 && KCR.busy; i++) await new Promise(r => setTimeout(r, 250)); renderKesif(); const g = [...document.querySelectorAll('#kesifbody .krow .ksm b')].map(x => x.innerText); kesOpen('dc'); const d = [...document.querySelectorAll('#kesifbody .krow .ksm b')].map(x => x.innerText); return { g, d, done: KCR.d === todayStr() }; });
      ok('Keşfet: Golden Cross / Death Cross günlük mumlardan bulunuyor', kg.done && kg.g.join() === 'THYAO' && kg.d.join() === 'ASELS', JSON.stringify(kg));
      const kt = await p.evaluate(() => { kesOpen('tavan'); const a = document.getElementById('kesifbody').innerText; kesOpen('geri'); const g = document.getElementById('kesifbody').innerText; kesBack(); return { a: /PGSUS/.test(a), g: /KONTR/.test(g) && /3 bildirim/.test(g), back: !!document.querySelector('#kesifbody .kesq') }; });
      ok('Keşfet: dün tavan, geri alım listeleri ve geri dönüş', kt.a && kt.g && kt.back, JSON.stringify(kt));
      const kx = await p.evaluate(() => { kesOpen('up'); const r = document.querySelector('#kesifbody .krow'); r.click(); return document.getElementById('xray').classList.contains('on'); });
      ok('Keşfet: hisseye dokununca röntgen açılıyor', kx);
      const km = await p.evaluate(() => { document.documentElement.classList.add('uye'); return getComputedStyle(document.querySelector('#tabs [data-t="kesif"]')).display; });
      ok('Keşfet: üyede alt çubukta görünüyor', km !== 'none', km);
      const th = await p.evaluate(() => { const h = document.documentElement, a = h.className, bg = getComputedStyle(document.body).backgroundColor; temaSet('cam'); const b = h.classList.contains('mx'); temaSet('matrix'); return { a, bg, b, c: h.classList.contains('mx') && h.classList.contains('cam'), inf: (xrayOpen('THYAO'), true) }; });
      await p.waitForTimeout(1500);
      const xi = await p.evaluate(() => { const t = document.getElementById('xr_body').textContent; xrayClose(); return /Piyasa ve işlem bilgileri/.test(t) && /Önceki gün kapanış/.test(t) && /İşlem hacmi/.test(t); });
      ok('Matrix görünümü varsayılan (siyah zemin), Cam/Matrix arası geçiş çalışıyor', /mx/.test(th.a) && th.bg === 'rgb(0, 0, 0)' && !th.b && th.c, JSON.stringify(th));
      ok('Röntgen: piyasa ve işlem bilgileri tablosu', xi);
      const v2 = await p.evaluate(() => { const D = (o, h, l, c, i) => ({ time: istD(Date.now() - (10 - i) * 864e5), open: o, high: h, low: l, close: c, volume: 1 });
        // düşüş trendi + yutan boğa
        const cs1 = [D(110, 111, 108, 109, 0), D(109, 110, 106, 107, 1), D(107, 108, 104, 105, 2), D(105, 106, 102, 103, 3), D(103, 104, 100, 101, 4), D(101, 102, 98, 99, 5), D(99, 100, 96, 97, 6), D(97.5, 98, 95, 95.5, 7), D(95, 99, 94.5, 98.5, 8)];
        const p1 = patOf(cs1, 1)[0];
        // yükseliş trendi + kayan yıldız
        const cs2 = [100, 102, 104, 106, 108, 110, 112, 114].map((c, i) => D(c - 1, c + 0.5, c - 1.5, c, i)); cs2.push(D(115, 119, 114.6, 115.4, 8));
        const p2 = patOf(cs2, 1)[0];
        const pv = pivotOf([{ time: '2026-01-01', open: 5, high: 6, low: 4, close: 5, volume: 1 }, { time: '2026-01-02', open: 10, high: 12, low: 9, close: 11, volume: 1 }]);
        KT.c = [['change', '>=', 0], ['vol', '>=', 5]]; KT.run = true; const items = tarItems(); const okT = items.length > 0 && items.every(r => { const o = S.umap[r.s]; return o.change >= 0 && o.voltl >= 5e6; });
        kesOpen('tar'); const tarUI = document.querySelectorAll('#kesifbody .ktr').length === 2 && /hisse bulundu/.test(document.getElementById('kesifbody').textContent);
        kesOpen('sa'); const sa = /EREGL/.test(document.getElementById('kesifbody').textContent) && /Bedelsiz/.test(document.getElementById('kesifbody').textContent);
        const o = S.umap.ASELS; o.earnings_release_next_date = Math.floor((Date.now() + 5 * 864e5) / 1000); kesOpen('earn'); const earn = document.querySelectorAll('#kesifbody .kgh').length >= 1;
        kesBack();
        return { p1: p1 && p1.ad, p2: p2 && p2.ad, pv: pv && [pv.P, pv.R1, pv.S1].map(x => Math.round(x * 100) / 100).join(), okT, tarUI, sa, earn }; });
      ok('Mum formasyonu: düşüşte yutan boğa, yükselişte kayan yıldız bulunuyor', v2.p1 === 'Yutan boğa' && v2.p2 === 'Kayan yıldız', JSON.stringify(v2));
      ok('Pivot hesabı doğru (P, Direnç 1, Destek 1)', v2.pv === '10.67,12.33,9.33', v2.pv);
      ok('Kendi tarayıcın: koşullara uyanları buluyor, ekranda koşul satırları var', v2.okT && v2.tarUI, JSON.stringify(v2));
      ok('Keşfet: sermaye artırımı listesi ve gün gün bilanço takvimi', v2.sa && v2.earn, JSON.stringify(v2));
      await p.evaluate(() => xrayOpen('THYAO')); await p.waitForTimeout(1800);
      const xt = await p.evaluate(() => { const t = document.getElementById('xr_body').textContent; xrayClose(); return { pv: /Destek ve direnç/.test(t) && /Direnç 1/.test(t) && /Fiyat şimdi/.test(t), pat: /Mum formasyonları/.test(t) }; });
      ok('Röntgen: pivot destek/direnç ve mum formasyonları bölümü', xt.pv && xt.pat, JSON.stringify(xt));
      const mk = await p.evaluate(() => { const real = Date.now, at = iso => { Date.now = () => Date.parse(iso); const r = mktSt(); Date.now = real; return r; };
        return { open: at('2026-10-20T12:00:00+03:00').k, eve: at('2026-10-20T18:35:00+03:00'), fri: at('2026-10-23T19:00:00+03:00').sub, pre: at('2026-10-21T09:30:00+03:00'), kap: at('2026-10-20T18:05:00+03:00').k,
          top: (renderPx(), document.getElementById('px').innerHTML) }; });
      ok('Piyasa durumu: seansta açık, akşam kapalı + açılışa kalan süre, Cuma akşamı Pazartesi, sabah seans öncesi, 18:00–18:10 kapanış seansı',
        mk.open === 'open' && mk.eve.k === 'cl' && mk.eve.sub === 'Açılışa 15 sa 25 dk' && mk.fri === "Pazartesi 10:00'da açılır" && mk.pre.k === 'pre' && mk.pre.sub === 'Açılışa 30 dk' && mk.kap === 'kap', JSON.stringify(mk).slice(0, 300));
      const vp = await p.evaluate(() => { const real = Date.now, keep = { v: S.viop, m: S.mkt }; S.viop = { c: 14803, ch: 2.72, dl: true }; S.mkt = Object.assign({}, S.mkt || {}, { XU030: { c: 14676.53, ch: 3.2 } });
        const at = iso => { Date.now = () => Date.parse(iso); const r = viopInfo(); Date.now = real; return r; };
        const a = at('2026-10-21T09:37:00+03:00'), o = at('2026-10-21T11:00:00+03:00'), w = at('2026-10-25T12:00:00+03:00');
        Date.now = () => Date.parse('2026-10-21T09:37:00+03:00'); let yonOld = null; try { const t = document.createElement('div'); t.innerHTML = nDial(); yonOld = /dünkü veri/.test(t.textContent); } catch (e) { yonOld = 'hata ' + e.message; } Date.now = real;
        S.viop = keep.v; S.mkt = keep.m; return { aOld: a.old, oOld: o.old, pr: o.pr != null ? +o.pr.toFixed(2) : null, w: w.wkend, yonOld }; });
      ok('VİOP: 09:45 öncesi dünkü veri sayılır, seansta değil, BIST 30\'a göre fark hesaplanır, ana sayfada "dünkü veri" yazar',
        vp.aOld === true && vp.oOld === false && vp.pr === 0.86 && vp.w === true && vp.yonOld === true, JSON.stringify(vp));
      const gt = await p.evaluate(() => { tgaGate({ url: 'https://t.me/bistpusulatr', title: 'BIST Pusula' }); const b = document.getElementById('tgabox'); const r = { t: b.textContent, n: b.querySelectorAll('button').length };
        tgaGate({ url: 'javascript:alert(1)', title: '<i>x</i>' }); r.bad = b.querySelectorAll('button').length; r.esc = !b.querySelector('i'); b.remove(); return r; });
      ok('Kanal kapısı: "Kanala katıl" ve "Katıldım, aç" düğmeleri; bozuk bağlantıda katıl düğmesi yok, başlık kaçışlı', /Kanala katıl, Pusula açılsın/.test(gt.t) && gt.n === 2 && gt.bad === 1 && gt.esc, JSON.stringify(gt).slice(0, 200));
      const al = await p.evaluate(async () => { S.botAlive = true; ALS.at = 0; ALS.seen = null; alSrvLoad(); await new Promise(r => setTimeout(r, 1200)); showTab('algi'); await new Promise(r => setTimeout(r, 300));
        const t = document.getElementById('t-algi').textContent; return { n: (ALS.list || []).length, jants: /JANTS/.test(t), sahol: /SAHOL/.test(t), tg: /📨/.test(t), srv: /Ana sunucudan/.test(t), toast: (typeof stCur !== 'undefined' && stCur && stCur.sym) || (STQ[0] && STQ[0].sym) || '' }; });
      ok('Algı tek kaynak: ana sunucunun ateşlemeleri listede (Telegram işaretiyle), yeni olan üstten kart olarak çıkıyor', al.n === 2 && al.jants && al.sahol && al.tg && al.srv && al.toast === 'JANTS', JSON.stringify(al));
      await p.evaluate(() => { S.botAlive = false; });
      await p.evaluate(() => selectSym('THYAO', 'bist')); await p.waitForTimeout(2500);
      const cn = await p.evaluate(() => { const el = document.getElementById('cnote'), t = el ? el.textContent : ''; const w = S.wsig.THYAO;
        return { card: !!el.querySelector('.cnc'), grade: (el.querySelector('.cng') || {}).textContent, wg: w && !w.err ? (w.side === 'AL' ? w.grade : 'C') : 'err', txt: /PUSULA NOTU/.test(t) && /Destek/.test(t) && /Direnç/.test(t),
          leg: /Açılış/.test(document.getElementById('legend').textContent) && !/\bNot\b/.test(document.getElementById('legend').textContent), t: t.slice(0, 160) }; });
      await p.screenshot({ path: require('path').join(OUT, 'grafik-not.png') });
      const asc = await p.evaluate(async () => { chart.priceScale('right').applyOptions({ autoScale: false }); selectSym('ASELS', 'bist'); await new Promise(r => setTimeout(r, 2000)); return chart.priceScale('right').options().autoScale; });
      ok('Grafik: hisse değişince fiyat ölçeği yeniden otomatik', asc === true, String(asc));
      ok('Grafik not kartı: açılan hissenin notu Fırsat hesabıyla aynı, düz Türkçe özet + Destek/Direnç, grafik satırı Türkçe',
        cn.card && cn.txt && cn.grade === cn.wg && cn.leg, JSON.stringify(cn));
      await p.evaluate(() => showTab('kesif'));
      await p.screenshot({ path: require('path').join(OUT, 'kesif.png') });
      ok('Keşfet/aralık sayfasında hata yok', !errs.length, errs.slice(0, 2).join(' | ')); await p.close(); }
    // v11.9 misafirde Ayarlar gizli
    { const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await install(p, { proxy: true }); await p.addInitScript(() => { localStorage.setItem('tvproxy', JSON.stringify('wss://x.test/k')); localStorage.setItem('ownClaimed', '1'); });
      await p.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 20000 }); await p.waitForTimeout(3000);
      const g = await p.evaluate(() => { showTab('set'); const mt = document.querySelector('#more [data-t="set"]'); return { tab: S.tab, cls: document.documentElement.classList.contains('noset'), menu: mt ? getComputedStyle(mt).display : 'yok' }; });
      ok('Misafirde Ayarlar gizli ve açılmıyor', g.tab === 'now' && g.cls && g.menu === 'none', JSON.stringify(g));
      ok('misafir sayfasında hata yok', !errs.length, errs.slice(0, 2).join(' | ')); await p.close(); }
  } catch (e) { ok('test çalıştırma', false, e.message); }
  await b.close();
  const f = results.filter(r => !r.ok);
  fs.writeFileSync(path.join(OUT, 'ui_sonuc.json'), JSON.stringify(results, null, 1));
  console.log('\nUI: ' + (results.length - f.length) + '/' + results.length + ' geçti');
  process.exit(f.length ? 1 : 0);
})();
