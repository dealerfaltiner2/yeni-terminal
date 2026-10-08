# BIST sinyal motoru BEKÇİSİ — Görev Zamanlayıcı 5 dakikada bir çalıştırır (bekci.vbs ile, pencere açmadan).
# Motor yanıt vermiyorsa (http://127.0.0.1:47123) takılı kalan motoru kapatıp yeniden başlatır.
# Ayrıca sunucuya ulaşılabiliyor mu bakar (internet/şirket ağı sorunu teşhisi için). Her olay bekci.log'a yazılır.
$ErrorActionPreference = 'SilentlyContinue'
$D = Join-Path $env:LOCALAPPDATA 'BistMotor'
$L = Join-Path $D 'bekci.log'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
function Kayit($t) {
  try { if ((Test-Path $L) -and ((Get-Item $L).Length -gt 500KB)) { Move-Item $L "$L.eski" -Force } } catch {}
  Add-Content -Path $L -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $t) -Encoding UTF8
}
function MotorCevap {
  try { $r = Invoke-WebRequest 'http://127.0.0.1:47123' -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop; return ($r.StatusCode -eq 200) } catch { return $false }
}
if (MotorCevap) {
  # motor ayakta; sunucuya ulaşılabiliyor mu? (yalnız ulaşılamıyorsa yaz)
  try { $s = Invoke-WebRequest 'https://api.altinerpano.com/echo' -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop; if ($s.StatusCode -ne 200) { Kayit "motor çalışıyor ama sunucu yanıtı $($s.StatusCode)" } }
  catch { Kayit ('motor çalışıyor ama sunucuya ulaşılamıyor (internet/şirket ağı?): ' + $_.Exception.Message) }
  return
}
# 20 sn sonra bir kez daha dene (motor o an yeniden başlıyor olabilir)
Start-Sleep -Seconds 20
if (MotorCevap) { return }
Kayit 'motor yanıt vermiyor → yeniden başlatılıyor'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*bot.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 3
$vbs = Join-Path $D 'baslat.vbs'
if (Test-Path $vbs) { Start-Process wscript.exe "`"$vbs`"" } else { Kayit 'baslat.vbs bulunamadı — kurulumu yeniden yap' ; return }
Start-Sleep -Seconds 40
if (MotorCevap) { Kayit 'motor yeniden başladı ✓' } else { Kayit 'motor başlatıldı ama henüz yanıt yok (motor.log ve motor_cikti.log dosyalarına bak)' }
