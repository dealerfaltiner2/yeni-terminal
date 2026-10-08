' BIST motor bekçisi — PowerShell betiğini pencere açmadan çalıştırır (Görev Zamanlayıcı 5 dk'da bir)
Set sh = CreateObject("WScript.Shell")
d = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\BistMotor"
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & d & "\bekci.ps1""", 0, False
