#!/usr/bin/env bash
# Sunucuyu (Worker) yerelde çalıştırıp temel yolları dener: onay akışı, hata defteri, karne verisi, sahip yolları.
# Gerçek Cloudflare'e DOKUNMAZ (wrangler dev --local, sahte ACCESS_KEY). Çıkış 0 = geçti.
cd "$(dirname "$0")"
T=$(mktemp -d); cp -r ../worker/src "$T/"; sed 's/"crons": \["\* \* \* \* \*"\]/"crons": []/' ../worker/wrangler.jsonc > "$T/wrangler.jsonc"; echo 'ACCESS_KEY=k123' > "$T/.dev.vars"
cd "$T"; PORT=87$((RANDOM%90+10))
npx -y wrangler@3 d1 execute bist_bt --local --command "CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)" >/dev/null 2>&1
(npx -y wrangler@3 dev --local --port $PORT > dev.log 2>&1 &) ; for i in $(seq 1 40); do curl -s -m 2 "http://localhost:$PORT/k123/" >/dev/null && break; sleep 1; done
B=http://localhost:$PORT/k123; fail=0
chk(){ if echo "$2" | grep -qE "$3"; then echo "✓ $1"; else echo "✗ $1 — $(echo "$2" | head -c 160)"; fail=1; fi; }
chk "anahtarsız istek reddedilir" "$(curl -s -m 10 http://localhost:$PORT/yanlis/status)" "yetkisiz"
chk "hello (sahip yokken serbest)" "$(curl -s -m 10 "$B/hello?dev=eskicihaz0001")" '"blocked": ?false'
OWN=$(curl -s -m 10 -X POST "$B/owner-claim" | python3 -c "import json,sys;print(json.load(sys.stdin).get('tok',''))")
chk "ana cihaz kodu alındı" "$OWN" "[a-f0-9]{20}"
chk "yeni cihaz onay bekler" "$(curl -s -m 10 "$B/hello?dev=yenicihaz0001")" '"wait": ?true'
chk "onaysız cihaz veri alamaz" "$(curl -s -m 10 "$B/sigstats?dev=yenicihaz0001")" "onayını bekliyor"
chk "eski cihaz onaylı" "$(curl -s -m 10 "$B/sigstats?dev=eskicihaz0001")" '"ok": ?true'
chk "sahip yolu kodsuz reddedilir" "$(curl -s -m 10 "$B/devices")" "yalnız ana cihaz"
chk "cihaz onaylama" "$(curl -s -m 10 "$B/dev-ok?id=yenicihaz0001&own=$OWN")" '"ok": ?true'
chk "onaydan sonra veri gelir" "$(curl -s -m 10 "$B/sigstats?dev=yenicihaz0001")" '"ok": ?true'
chk "KAP listesi onaysız cihaza kapalı" "$(curl -s -m 10 "$B/kap?f=onemli&dev=yabanci000001")" "onayını bekliyor"
chk "kâğıt bot sonuçları (onaylı cihaz)" "$(curl -s -m 10 "$B/paper?dev=eskicihaz0001")" '"tot"'
chk "kâğıt bot ayarı sahipsiz değişmez" "$(curl -s -m 10 -X POST -d '{"amt":5000}' "$B/paper-set?dev=eskicihaz0001")" "ana cihaz"
chk "kâğıt bot ayarı kaydedilir (sahip)" "$(curl -s -m 10 -X POST -d '{"amt":5000,"max":3}' "$B/paper-set?dev=eskicihaz0001&own=$OWN")" '"amt": ?5000'
chk "KAP listesi (indeksli sorgu, hisse filtresi) çalışır" "$(curl -s -m 10 "$B/kap?f=hepsi&s=ASELS,THYAO&dev=eskicihaz0001")" '"ok": ?true'
chk "motor kapalıyken hello: bot=false" "$(curl -s -m 10 "$B/hello?dev=eskicihaz0001")" '"bot": ?false'
PC=$(curl -s -m 10 -X POST -d '{"cfg":{"ls":{"tvproxy":"wss://x/k","ownTok":"t"}}}' "$B/pair-create?own=$OWN" | python3 -c "import json,sys;print(json.load(sys.stdin).get('code',''))")
chk "eşleştirme kodu üretildi (sahip)" "$PC" "^[A-Z0-9]{5}-[A-Z0-9]{5}$"
chk "eşleştirme kodu sahipsiz üretilemez" "$(curl -s -m 10 -X POST -d '{"cfg":{}}' "$B/pair-create")" "yalnız ana cihaz"
chk "kodla ayar alındı (anahtarsız)" "$(curl -s -m 10 -X POST -d "{\"c\":\"$PC\"}" "http://localhost:$PORT/pair")" '"tvproxy": ?"wss://x/k"'
chk "kod ikinci kez kullanılamaz" "$(curl -s -m 10 -X POST -d "{\"c\":\"$PC\"}" "http://localhost:$PORT/pair")" "kullanılmış"
chk "yanlış kod reddedilir" "$(curl -s -m 10 -X POST -d '{"c":"AAAAA-BBBBB"}' "http://localhost:$PORT/pair")" "geçersiz"
curl -s -m 10 "$B/hello?dev=motor0000000001&bot=1&own=$OWN" >/dev/null
chk "motor nabzı sonrası hello: bot=true" "$(curl -s -m 10 "$B/hello?dev=eskicihaz0001")" '"bot": ?true'
chk "hata defterine yazma" "$(curl -s -m 10 -X POST -d '{"items":[{"k":"hata","m":"test hatası","w":"x.js:1","tab":"now","v":"7.2"}]}' "$B/errlog?dev=eskicihaz0001")" '"n": ?1'
curl -s -m 10 -X POST -d '{"items":[{"k":"hata","m":"test hatası","w":"x.js:1"}]}' "$B/errlog?dev=eskicihaz0001" >/dev/null
chk "aynı hata sayaçla tek satır" "$(npx -y wrangler@3 d1 execute bist_bt --local --command "SELECT n FROM err WHERE msg='test hatası'" 2>/dev/null)" '"n": ?2'
for p in $(pgrep -f "port $PORT"); do kill $p 2>/dev/null; done
cd /; rm -rf "$T"
[ $fail = 0 ] && echo "SUNUCU: geçti" || echo "SUNUCU: HATA VAR"; exit $fail
