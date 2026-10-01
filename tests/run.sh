#!/usr/bin/env bash
# Tüm testler: bash tests/run.sh   (çıkış 0 = hepsi geçti)
cd "$(dirname "$0")"
fail=0
echo "== Sözdizimi"; for f in ../worker/src/*.js; do node --check "$f" || fail=1; done
python3 - <<'PY' || fail=1
import re,subprocess,sys
s=open('../index.html',encoding='utf-8').read()
open('out_scripts.js','w').write('\n;\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S)))
r=subprocess.run(['node','--check','out_scripts.js'],capture_output=True,text=True)
print('index.html betikleri:', 'tamam' if r.returncode==0 else r.stderr[:400]); sys.exit(r.returncode)
PY
rm -f out_scripts.js
[ -d node_modules/playwright ] || npm install --silent --no-audit --no-fund >/dev/null 2>&1
echo "== Karne mantığı"; node sig.mjs 2>/dev/null || fail=1
echo "== KAP haberleri"; node kap.mjs 2>/dev/null || fail=1
echo "== Arayüz"; timeout 300 node ui.js || fail=1
echo "== Sunucu (yerel)"; timeout 300 bash worker.sh > out_worker.txt 2>/dev/null; wr=$?; grep -v agent-proxy out_worker.txt; rm -f out_worker.txt; [ $wr = 0 ] || fail=1
echo; [ $fail = 0 ] && echo "SONUÇ: HEPSİ GEÇTİ" || echo "SONUÇ: HATA VAR"
exit $fail
