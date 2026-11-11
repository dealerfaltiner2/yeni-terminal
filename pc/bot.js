// BIST Terminal · SİNYAL MOTORU (Windows) — terminali "sunucu modu"nda (?bot=1) başsız tarayıcıda sürekli açık tutar.
// - Ayarlar: ayar.json (kurulumda telefondaki eşleştirme koduyla sunucudan bir kez alınır; repoda YOK).
// - Bekçi: sayfanın nabzı (window.BOT.beat) 3 dk durursa ya da tarayıcı çökerse yeniden başlatır.
// - Her gün 09:40 ve 18:25'te (İstanbul) tarayıcıyı yeniler → terminalin son sürümü yüklenir.
// - Tek kopya: 127.0.0.1:47123 kilidi; aynı adreste durum sayfası (tarayıcıda http://127.0.0.1:47123 aç).
// - Gözetmen (dosyanın sonu): düz 'node bot.js' motoru '--isci' alt süreci olarak çalıştırır ve kapanırsa yeniden açar.
const fs = require('fs'), path = require('path'), http = require('http');
const DIR = __dirname, LOG = path.join(DIR, 'motor.log');
const SITE = process.env.BIST_SITE || 'https://dealerfaltiner2.github.io/yeni-terminal/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const trNow = () => { const d = new Date(Date.now() + 3 * 3600e3); return { hm: d.toISOString().slice(11, 16), day: d.toISOString().slice(0, 10), wd: d.getUTCDay() }; };
function log(...a) {
  const l = new Date(Date.now() + 3 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + ' ' + a.join(' ');
  // 10.11: yazılar YALNIZ dosyaya — komut penceresine yazmak, pencere 'seçim' moduna geçince (tıklama/gizleme) motoru donduruyordu
  try { if (fs.existsSync(LOG) && fs.statSync(LOG).size > 2e6) fs.renameSync(LOG, LOG + '.eski'); fs.appendFileSync(LOG, l + '\n'); } catch (e) {}
}
function readCfg() {
  const t = fs.readFileSync(path.join(DIR, 'ayar.json'), 'utf8').replace(/^﻿/, '');
  const c = JSON.parse(t);
  if (!c || !c.ls || !c.ls.tvproxy || !c.ls.ownTok) throw new Error('ayar.json eksik — kurulumu eşleştirme koduyla yeniden yap');
  return c;
}
const STATE = { started: Date.now(), restarts: 0, lastBeat: 0, last: {}, err: '', loop: Date.now() };
// 11.11: süreli bekleme — sayfa donarsa page.evaluate/browser.close sonsuza dek bekliyordu (16:08 olayı: motor sustu, günlüğe hiçbir şey yazmadı)
const within = (p, ms, what) => Promise.race([p, sleep(ms).then(() => { throw new Error(what + ' ' + Math.round(ms / 1000) + ' sn yanıt vermedi'); })]);
// tek kopya kilidi + durum sayfası
function lock() {
  return new Promise((res, rej) => {
    const srv = http.createServer((q, r) => {
      if (q.url === '/h') { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ loop: STATE.loop, beat: STATE.lastBeat })); return; }
      r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      const b = STATE.last || {};
      r.end('<meta http-equiv="refresh" content="10"><body style="font:15px system-ui;background:#0b111b;color:#e9eff7;padding:20px"><h2>BIST sinyal motoru</h2>' +
        '<p>Çalışıyor: ' + Math.round((Date.now() - STATE.started) / 60e3) + ' dk · yeniden başlatma: ' + STATE.restarts + '</p>' +
        '<p>Son nabız: ' + (STATE.lastBeat ? Math.round((Date.now() - STATE.lastBeat) / 1000) + ' sn önce' : '—') + '</p>' +
        '<p>Canlı veri: ' + (b.tv ? 'var' : 'yok') + ' · hisse: ' + (b.uni || 0) + ' · Algı izliyor: ' + (b.algi || 0) + ' · sürüm: ' + (b.ver || '?') + '</p>' +
        (STATE.err ? '<p style="color:#ff7a88">Son hata: ' + String(STATE.err).replace(/</g, '&lt;') + '</p>' : '') + '</body>');
    });
    srv.once('error', e => rej(e));
    srv.listen(47123, '127.0.0.1', () => res(srv));
  });
}
async function session(cfg) {
  const { chromium } = require('playwright');
  // 16.10: Playwright'ın kendi tarayıcısı indirilemediyse (ev ağında SSL engeli görüldü) bilgisayardaki Chrome, o da yoksa Edge kullanılır
  const LA = { headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] };
  let browser = null, lerr = null;
  for (const o of [process.env.BIST_CHROME ? { executablePath: process.env.BIST_CHROME } : {}, { channel: 'chrome' }, { channel: 'msedge' }]) {
    try { browser = await chromium.launch(Object.assign({}, LA, o)); break; } catch (e) { lerr = e; }
  }
  if (!browser) throw lerr;
  STATE.loop = Date.now();
  let dead = false;
  browser.on('disconnected', () => { dead = true; });
  try {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript(ls => { try { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, cfg.ls);
    const page = await ctx.newPage();
    page.on('pageerror', e => { STATE.err = e.message; log('sayfa hatası:', e.message); });
    page.on('crash', () => { dead = true; log('sayfa çöktü'); });
    await page.goto(SITE + '?bot=1&t=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90e3 });
    log('terminal açıldı (sunucu modu)'); STATE.loop = Date.now();
    const t0 = Date.now(); let fails = 0, refreshDone = '';
    while (!dead) {
      await sleep(30e3);
      STATE.loop = Date.now();
      try {
        const b = await within(page.evaluate(() => window.BOT ? { beat: BOT.beat, tv: BOT.tv, uni: BOT.uni, algi: BOT.algi, ver: BOT.ver, srv: BOT.srv } : null), 20e3, 'sayfa');
        if (b && b.beat) { STATE.lastBeat = Date.now(); STATE.last = b; fails = 0; } else fails++;
        if (b && Date.now() - b.beat > 180e3) { log('nabız durdu → yeniden başlatılıyor'); break; }
        // 10.11: sayfa canlı ama sunucuyla konuşamıyorsa (17:23 olayı) — seansta 5 dk sunucu teması yoksa yeniden başlat
        { const n0 = trNow(), seans = n0.wd >= 1 && n0.wd <= 5 && n0.hm >= '10:00' && n0.hm <= '18:10';
          if (b && seans && typeof b.srv === 'number' && Date.now() - Math.max(b.srv, t0) > 300e3) { log('sunucuya 5 dk ulaşılamadı → yeniden başlatılıyor'); break; } }
      } catch (e) { fails++; log('nabız okunamadı:', e.message); }
      if (fails >= 6) { log('sayfa 3 dk yanıt vermedi → yeniden başlatılıyor'); break; }
      const n = trNow(), key = n.day + n.hm;
      if ((n.hm === '09:40' || n.hm === '18:25') && refreshDone !== key && Date.now() - t0 > 5 * 60e3) { refreshDone = key; log('günlük tazeleme (' + n.hm + ')'); break; }
    }
  } finally {
    try { await within(browser.close(), 15e3, 'tarayıcı kapanışı'); }
    catch (e) { log(e.message, '→ tarayıcı zorla kapatılıyor'); try { const bp = browser.process && browser.process(); if (bp) bp.kill(); } catch (e2) {} }
  }
}
// 08.10 GÖZETMEN: şirket antivirüsü (Bitdefender) gizli pencere açan .vbs betiklerini siliyordu → .vbs ve ayrı bekçi KALDIRILDI.
// Artık bu dosya iki rol oynar: düz 'node bot.js' = GÖZETMEN (görünür, simge durumunda küçültülmüş pencere; tek kopya kilidi 47124),
// 'node bot.js --isci' = asıl motor. Gözetmen motor kapanırsa 10 sn sonra, 3 dk yanıt vermezse yeniden başlatır.
if (!process.argv.includes('--isci')) {
  process.title = 'BIST Pusula Motor';
  const lk = http.createServer((q, r) => { r.end('ok'); });
  lk.once('error', () => { console.log('BIST Pusula motoru zaten çalışıyor. Bu pencereyi kapatabilirsin.'); setTimeout(() => process.exit(0), 8000); });
  lk.listen(47124, '127.0.0.1', () => {
    console.log('==============================================');
    console.log('  BIST Pusula sinyal motoru — BU PENCEREYİ KAPATMA');
    console.log('  (simge durumuna küçültebilirsin; durum: http://127.0.0.1:47123)');
    console.log('==============================================');
    log('gözetmen başladı');
    const { spawn } = require('child_process');
    let child = null, lastStart = 0, fails = 0;
    const start = () => {
      if (!fs.existsSync(__filename)) { log('bot.js bulunamadı (antivirüs silmiş olabilir) — kurulumu yeniden yap'); setTimeout(start, 60e3); return; }
      lastStart = Date.now();
      const c = spawn(process.execPath, [__filename, '--isci'], { cwd: DIR, stdio: 'ignore', windowsHide: true });   // 10.11: 'inherit' değil — pencere donarsa motor da donuyordu
      child = c;
      c.on('exit', code => { if (child !== c) return; log('motor kapandı (kod ' + code + ') → 10 sn sonra yeniden başlatılıyor'); child = null; setTimeout(start, 10e3); });
    };
    start();
    // 11.11: motorun yalnız 'açık' olması yetmez — iç döngüsü (STATE.loop) 5 dk ilerlemediyse de takılmış sayılır
    const ping = () => new Promise(res => {
      const q = http.get('http://127.0.0.1:47123/h', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { res(r.statusCode === 200 ? {} : null); } }); });
      q.setTimeout(8000, () => { q.destroy(); res(null); }); q.on('error', () => res(null));
    });
    setInterval(async () => {
      if (!child || Date.now() - lastStart < 3 * 60e3) return;
      const h = await ping();
      fails = h ? 0 : fails + 1;
      if (fails >= 3) { fails = 0; log('motor 3 dk yanıt vermedi → yeniden başlatılıyor'); try { child.kill(); } catch (e) {} return; }
      if (h && h.loop && Date.now() - h.loop > 5 * 60e3 && Date.now() - lastStart > 6 * 60e3) {
        log('motor döngüsü ' + Math.round((Date.now() - h.loop) / 60e3) + ' dk ilerlemedi (sayfa donmuş) → yeniden başlatılıyor');
        const old = child; try { old.kill(); } catch (e) {}
        // kill sonrası 'exit' 10 sn içinde gelmezse süreci yeniden başlatmayı yine de dene (kilit 47123 serbest kalınca yeni kopya açılır)
        setTimeout(() => { if (child === old) { log('eski motor kapanmadı → yeni kopya deneniyor'); child = null; start(); } }, 30e3);
      }
    }, 60e3);
  });
} else (async () => {
  try { await lock(); } catch (e) { log('motor zaten çalışıyor, bu kopya kapanıyor'); process.exit(0); }
  log('motor başladı');
  for (;;) {
    STATE.loop = Date.now();
    let cfg;
    try { cfg = readCfg(); } catch (e) { STATE.err = e.message; log(e.message); await sleep(60e3); continue; }
    try { await session(cfg); } catch (e) { STATE.err = e.message; log('hata:', e.message); }
    STATE.restarts++;
    await sleep(15e3);
  }
})();
