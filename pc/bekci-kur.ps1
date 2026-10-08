# BIST sinyal motoruna BEKÇİ ekler: 5 dakikada bir motoru kontrol eder, kapanmışsa yeniden açar.
# Kullanım (iş bilgisayarında PowerShell):  irm https://raw.githubusercontent.com/dealerfaltiner2/yeni-terminal/main/pc/bekci-kur.ps1 | iex
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Yaz($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
Yaz "`n=== BIST motor bekçisi kurulumu ===`n" 'Cyan'
$D = Join-Path $env:LOCALAPPDATA 'BistMotor'
if (-not (Test-Path (Join-Path $D 'bot.js'))) { Yaz 'Motor bu bilgisayarda kurulu değil. Önce kur.ps1 ile motoru kur.' 'Red'; return }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$RAW = 'https://raw.githubusercontent.com/dealerfaltiner2/yeni-terminal/main/pc'
# 1) Güncel dosyalar (motor + bekçi)
Yaz '1/3 Dosyalar indiriliyor...'
foreach ($f in 'bot.js', 'baslat.vbs', 'bekci.ps1', 'bekci.vbs') { Invoke-WebRequest "$RAW/$f" -OutFile (Join-Path $D $f) -UseBasicParsing }
# 2) Görev Zamanlayıcı: oturum açıkken 5 dakikada bir + oturum açılınca (yönetici izni gerekmez)
Yaz '2/3 Bekçi görevi ekleniyor (5 dakikada bir)...'
$act = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + (Join-Path $D 'bekci.vbs') + '"') -WorkingDirectory $D
$t1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$t2 = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
try {
  Register-ScheduledTask -TaskName 'BistMotorBekci' -Action $act -Trigger $t1, $t2 -Settings $set -Force | Out-Null
  Yaz '✅ Bekçi eklendi.' 'Green'
} catch {
  Yaz ('⚠️ Bekçi görevi eklenemedi: ' + $_.Exception.Message) 'Yellow'
  Yaz 'Bu ekranın fotoğrafını Claude''a gönder.' 'Yellow'; return
}
# 3) Şimdi bir kez çalıştır
Yaz '3/3 Motor kontrol ediliyor (1 dakika kadar sürebilir)...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $D 'bekci.ps1')
try { $s = Invoke-WebRequest 'http://127.0.0.1:47123' -UseBasicParsing -TimeoutSec 8; $ok = $s.StatusCode -eq 200 } catch { $ok = $false }
if ($ok) { Yaz "`n✅ Motor çalışıyor. Bundan sonra kapanırsa en geç 5 dakikada kendiliğinden açılır." 'Green' }
else { Yaz "`n⚠️ Motor hâlâ yanıt vermiyor. '$D' klasöründeki motor.log ve bekci.log dosyalarının son satırlarının fotoğrafını Claude'a gönder." 'Yellow' }
# Uyku uyarısı
try {
  $uyku = (powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | Select-String 'Current AC Power Setting Index|Geçerli AC Güç Ayarı Dizini' | Select-Object -First 1)
  if ($uyku -and ($uyku.ToString() -notmatch '0x00000000')) { Yaz "`nNot: Bu bilgisayar bir süre sonra UYKU moduna geçecek şekilde ayarlı. Uykudayken motor çalışamaz. Ayarlar > Sistem > Güç > 'Prize takılıyken uyku' = Hiçbir zaman yaparsan sorun kalmaz." 'Yellow' }
} catch {}
