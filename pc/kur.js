// BIST Pusula motoru — PowerShell'SİZ kurulum/güncelleme (şirket antivirüsü PowerShell betiklerini engelliyor).
// Kullanım: Chrome ile bu dosyayı İndirilenler'e kaydet, sonra Komut İstemi'nde:  node Downloads\kur.js
// Yaptıkları: güncel bot.js'i indirir, eski .vbs/bekçi artıklarını temizler, eski motoru kapatır,
// Başlangıç klasörüne 'BIST Pusula Motor.cmd' koyar (oturum açılınca küçük pencerede başlar) ve motoru şimdi başlatır.
const fs = require('fs'), path = require('path'), https = require('https'), http = require('http'), cp = require('child_process');
const D = path.join(process.env.LOCALAPPDATA || '', 'BistMotor');
const RAW = 'https://raw.githubusercontent.com/dealerfaltiner2/yeni-terminal/main/pc/';
const yaz = (t) => console.log(t);
const get = (u) => new Promise((res, rej) => https.get(u, { headers: { 'User-Agent': 'bist-kur' } }, r => {
  if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode + ' ' + u)); }
  const b = []; r.on('data', c => b.push(c)); r.on('end', () => res(Buffer.concat(b)));
}).on('error', rej));
const sh = (c) => { try { return cp.execSync(c, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).toString(); } catch (e) { return ''; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ping = () => new Promise(res => { const q = http.get('http://127.0.0.1:47123', r => { r.resume(); res(r.statusCode === 200); }); q.setTimeout(5000, () => { q.destroy(); res(false); }); q.on('error', () => res(false)); });
(async () => {
  yaz('\n=== BIST Pusula motoru kurulumu (PowerShell\'siz) ===\n');
  if (!fs.existsSync(path.join(D, 'ayar.json'))) { yaz('HATA: ' + D + '\\ayar.json yok. Bu bilgisayar daha önce eşleştirilmemiş; Claude\'a yaz.'); process.exit(1); }
  // 1) dosyalar
  yaz('1/5 Güncel motor dosyaları indiriliyor...');
  for (const f of ['bot.js', 'package.json']) {
    const b = await get(RAW + f);
    const p = path.join(D, f), tmp = p + '.yeni';
    fs.writeFileSync(tmp, b);
    try { fs.renameSync(tmp, p); } catch (e) { try { fs.unlinkSync(p); } catch (x) {} fs.renameSync(tmp, p); }
  }
  // 2) tarayıcı bileşeni (yoksa)
  if (!fs.existsSync(path.join(D, 'node_modules', 'playwright'))) {
    yaz('2/5 Tarayıcı bileşeni kuruluyor (birkaç dakika)...');
    cp.execSync('npm.cmd install --no-audit --no-fund --loglevel=error', { cwd: D, stdio: 'inherit' });
    cp.execSync('npx.cmd playwright install chromium', { cwd: D, stdio: 'inherit' });
  } else yaz('2/5 Tarayıcı bileşeni zaten kurulu.');
  // 3) eski yöntemin artıkları (bekçi görevi her 5 dk 'bekci.vbs bulunamıyor' penceresi açıyordu)
  yaz('3/5 Eski kurulum artıkları temizleniyor...');
  sh('schtasks /Delete /F /TN BistMotorBekci');
  const startup = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  for (const p of [path.join(startup, 'BistMotor.vbs'), path.join(startup, 'BIST Pusula Motor.lnk'), path.join(D, 'baslat.vbs'), path.join(D, 'bekci.vbs'), path.join(D, 'bekci.ps1')]) { try { fs.unlinkSync(p); } catch (e) {} }
  // 4) eski motoru kapat (yalnız bot.js çalıştıran node'lar; bu kurulum betiği değil)
  yaz('4/5 Eski motor kapatılıyor...');
  sh('wmic process where "name=\'node.exe\' and commandline like \'%bot.js%\'" call terminate');
  await sleep(3000);
  // 5) Başlangıç + şimdi başlat
  yaz('5/5 Otomatik başlatma ayarlanıyor ve motor başlatılıyor...');
  const cmdf = path.join(startup, 'BIST Pusula Motor.cmd');
  fs.writeFileSync(cmdf, '@echo off\r\ncd /d "%LOCALAPPDATA%\\BistMotor"\r\nstart "BIST Pusula Motor" /min node bot.js\r\n');
  cp.spawn('cmd.exe', ['/c', cmdf], { cwd: D, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  let ok = false;
  for (let i = 0; i < 12 && !ok; i++) { await sleep(5000); ok = await ping(); }
  if (ok) {
    yaz('\n✅ Kuruldu. Motor çalışıyor.');
    yaz('Görev çubuğunda "BIST Pusula Motor" penceresi var: KAPATMA, küçük kalsın. Kapanırsa motor kendini yeniden açar.');
    yaz('Bilgisayar açılıp oturum açılınca kendiliğinden başlar. Bu pencereyi kapatabilirsin.');
  } else yaz('\n⚠️ Motor başlatıldı ama 1 dakikada yanıt vermedi. "BIST Pusula Motor" penceresinin fotoğrafını Claude\'a gönder.');
})().catch(e => { yaz('\nHATA: ' + e.message + '\nBu ekranın fotoğrafını Claude\'a gönder.'); process.exit(1); });
