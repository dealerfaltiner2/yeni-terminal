# BIST sinyal motorunu kaldırır:  irm https://raw.githubusercontent.com/dealerfaltiner2/yeni-terminal/main/pc/kaldir.ps1 | iex
Remove-Item (Join-Path ([Environment]::GetFolderPath('Startup')) 'BistMotor.vbs') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Startup')) 'BIST Pusula Motor.lnk') -Force -ErrorAction SilentlyContinue
schtasks /Delete /F /TN 'BistMotor' 2>$null | Out-Null
schtasks /Delete /F /TN 'BistMotorBekci' 2>$null | Out-Null
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*bot.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force (Join-Path $env:LOCALAPPDATA 'BistMotor') -ErrorAction SilentlyContinue
Write-Host 'Sinyal motoru kaldırıldı.' -ForegroundColor Green
