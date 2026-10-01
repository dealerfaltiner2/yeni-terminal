' BIST sinyal motoru — pencere açmadan arka planda başlatır (Görev Zamanlayıcı oturum açılınca çalıştırır)
Set sh = CreateObject("WScript.Shell")
d = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\BistMotor"
sh.CurrentDirectory = d
sh.Run "cmd /c node bot.js >> motor_cikti.log 2>&1", 0, False
