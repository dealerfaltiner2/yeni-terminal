# BIST Terminal · sinyal motoru kurulumu (Windows 10/11)
# Kullanım (PowerShell):  irm https://raw.githubusercontent.com/dealerfaltiner2/yeni-terminal/main/pc/kur.ps1 | iex
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Yaz($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
Yaz "`n=== BIST Terminal sinyal motoru kurulumu ===`n" 'Cyan'
$D = Join-Path $env:LOCALAPPDATA 'BistMotor'
New-Item -ItemType Directory -Force -Path $D | Out-Null

# 1) Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Yaz '1/5 Node.js kuruluyor (birkaç dakika sürebilir)...'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements | Out-Null
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Yaz 'Node.js otomatik kurulamadı. https://nodejs.org adresinden LTS sürümünü kurup bu komutu yeniden çalıştır.' 'Red'; return
  }
} else { Yaz '1/5 Node.js zaten kurulu.' }

# 2) Motor dosyaları
Yaz '2/5 Motor dosyaları indiriliyor...'
$RAW = 'https://raw.githubusercontent.com/dealerfaltiner2/yeni-terminal/main/pc'
foreach ($f in 'bot.js', 'package.json', 'baslat.vbs', 'bekci.ps1', 'bekci.vbs') { Invoke-WebRequest "$RAW/$f" -OutFile (Join-Path $D $f) -UseBasicParsing }

# 3) Tarayıcı bileşeni
Yaz '3/5 Tarayıcı bileşeni kuruluyor (ilk seferde ~150 MB)...'
Push-Location $D
try {
  & npm.cmd install --no-audit --no-fund --loglevel=error | Out-Null
  & npx.cmd playwright install chromium | Out-Null
} finally { Pop-Location }

# 4) Eşleştirme
if (Test-Path (Join-Path $D 'ayar.json')) {
  $yeni = Read-Host '4/5 Motor daha önce eşleştirilmiş. Yeniden eşleştirmek ister misin? (E/H)'
} else { $yeni = 'E' }
if ($yeni -match '^[Ee]') {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $kod = Read-Host '4/5 Telefondaki eşleştirme kodunu yaz (Ayarlar > Ana cihaz > İş bilgisayarını bağla)'
  $body = @{ c = $kod.Trim() } | ConvertTo-Json
  try { $r = Invoke-RestMethod -Method Post -Uri 'https://api.altinerpano.com/pair' -Body $body -ContentType 'application/json' }
  catch { $m = $_.ErrorDetails.Message; if (-not $m) { $m = $_.Exception.Message }; Yaz ('Eşleştirme olmadı: ' + $m + "`nTelefondan yeni kod alıp komutu tekrar çalıştır.") 'Red'; return }
  if (-not $r.ok) { Yaz ('Eşleştirme olmadı: ' + $r.error) 'Red'; return }
  $json = $r.cfg | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText((Join-Path $D 'ayar.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
}

# 5) Otomatik başlatma (oturum açılınca) + şimdi başlat
Yaz '5/5 Otomatik başlatma ayarlanıyor...'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*BistMotor*' -or $_.CommandLine -like '*bot.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$vbs = Join-Path $D 'baslat.vbs'
# Oturum açılınca otomatik başlasın: Başlangıç klasörü (yönetici izni gerekmez)
$startup = [Environment]::GetFolderPath('Startup')
Copy-Item $vbs (Join-Path $startup 'BistMotor.vbs') -Force
Start-Process wscript.exe "`"$vbs`""
# Bekçi: 5 dakikada bir motoru kontrol eder, kapanmışsa yeniden açar (yönetici izni gerekmez)
try {
  $bact = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + (Join-Path $D 'bekci.vbs') + '"') -WorkingDirectory $D
  $bt1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
  $bt2 = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  $bset = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
  Register-ScheduledTask -TaskName 'BistMotorBekci' -Action $bact -Trigger $bt1, $bt2 -Settings $bset -Force | Out-Null
  Yaz 'Bekçi eklendi: motor kapanırsa en geç 5 dakikada yeniden açılır.' 'Green'
} catch { Yaz ('Bekçi eklenemedi (motor yine çalışır): ' + $_.Exception.Message) 'Yellow' }
Start-Sleep -Seconds 20
try { $s = Invoke-WebRequest 'http://127.0.0.1:47123' -UseBasicParsing -TimeoutSec 5; $ok = $s.StatusCode -eq 200 } catch { $ok = $false }
# 6) İsteğe bağlı: bilgisayar açılınca OTURUM AÇILMADAN da başlasın (Görev Zamanlayıcı; Windows şifresi bir kez sorulur, hiçbir yere kaydedilmez/gönderilmez)
$ots = Read-Host "`nBilgisayar yeniden başlayınca, sen oturum açmadan da motor çalışsın mı? (E/H)"
if ($ots -match '^[Ee]') {
  try {
    $u = "$env:USERDOMAIN\$env:USERNAME"
    $sp = Read-Host "Windows oturum şifren ($u) — yalnız Windows'a verilir" -AsSecureString
    $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sp))
    $node = (Get-Command node).Source
    $act = New-ScheduledTaskAction -Execute $node -Argument 'bot.js' -WorkingDirectory $D
    $trg = New-ScheduledTaskTrigger -AtStartup
    $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName 'BistMotor' -Action $act -Trigger $trg -Settings $set -User $u -Password $pw -RunLevel Limited -Force | Out-Null
    $pw = $null
    Yaz '✅ Görev eklendi: bilgisayar açılınca motor oturum açılmasını beklemeden başlar.' 'Green'
  } catch {
    Yaz ('⚠️ Görev eklenemedi: ' + $_.Exception.Message) 'Yellow'
    Yaz 'Bu ayar için genelde yönetici izni gerekir. Motor yine çalışır; yalnız yeniden başlatmadan sonra senin oturum açman gerekir.' 'Yellow'
  }
}
if ($ok) {
  Yaz "`n✅ Kuruldu. Sinyal motoru arka planda çalışıyor." 'Green'
  Yaz 'Durumunu görmek için tarayıcıda: http://127.0.0.1:47123'
  Yaz 'Bilgisayar yeniden açılınca kendiliğinden başlar. Oturumu KAPATMA (ekranı kilitlemek sorun değil).'
} else {
  Yaz "`n⚠️ Motor başlatıldı ama henüz yanıt vermiyor. 1 dakika sonra http://127.0.0.1:47123 adresine bak; açılmazsa '$D\motor.log' dosyasının ekran görüntüsünü Claude'a gönder." 'Yellow'
}
