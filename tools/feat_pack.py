#!/usr/bin/env python3
"""%60 araması — ADIM 1: D1 'feat' tablosunu sıkıştırıp parça parça çekmek için SQL üretir.
NEDEN: 25 bin satır × kombinasyon taramasını D1'de SQL ile yapmak günlük 5M okuma sınırını ~15 kat aşar (29.09'da ölçüldü).
Bu yüzden her satır 10 karakterlik bir koda sıkıştırılır, Cloudflare MCP 'd1_database_query' ile parça parça alınır, tarama yerelde yapılır.
Kullanım:  python3 feat_pack.py 0 3000   → SQL'i yazdırır (OFFSET 0, LIMIT 3000). Toplam ~25.300 satır → 9 parça.
Her parçanın sonucundaki 's' değerini tools/data/parca_<offset>.txt dosyasına kaydet, sonra feat_search.py çalıştır.
Kod çözme feat_search.py içinde (F listesi ve bit düzeni BURAYLA AYNI olmalı)."""
import sys
# 15 özellik × 3 bit (kova 0..6, 7 = boş). Eşikler kova sınırlarıdır: değer < eşik[i] → kova i.
F = [('gap', [-2, -1, 0, 1, 2, 4]), ('r30', [-2, -1, 0, 1, 2, 4]), ('vr30', [0.5, 0.7, 1, 1.5, 2.5, 4]), ('d1', [-5, -3, 0, 3, 6]), ('d5', [-10, -5, 0, 5, 10]),
     ('d20', [-20, -10, 0, 10, 25]), ('dist', [-25, -15, -8, -3, -1]), ('sq', [0.6, 0.8, 1, 1.3, 1.6]), ('vt', [0.6, 0.8, 1, 1.2, 1.6, 2]), ('i30', [-1, -0.5, 0, 0.5, 1]),
     ('rng30', [1, 1.5, 2, 3, 5, 8]), ('adr', [2, 3, 4, 5, 6, 8]), ('above', [1]), ('wd', [2, 3, 4, 5]), ('rng30*1.0/adr', [0.3, 0.5, 0.7, 1, 1.5])]
A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
SPLIT = '2026-03-15'  # eski dönem (bit45=1) < SPLIT ≤ yeni dönem
def bucket(e, cuts):
    return f"(CASE WHEN {e} IS NULL THEN 7 " + " ".join(f"WHEN {e}<{c} THEN {i}" for i, c in enumerate(cuts)) + f" ELSE {len(cuts)} END)"
def code_expr():
    p = [f"({bucket(e, c)}<<{3 * i})" for i, (e, c) in enumerate(F)]                 # bit 0..44
    p.append(f"((d<'{SPLIT}')<<45)")                                                 # bit 45: eski dönem
    for j, o in enumerate(['o10', 'o15', 'o20']): p.append(f"(coalesce({o},3)<<{46 + 2 * j})")  # bit 46..51: 1 hedef, 2 stop, 0 yok, 3 boş
    p.append("((CAST(round((max(-2,min(2,coalesce(rest,0)))+2)*4) AS INTEGER))<<52)")  # bit 52..56: kapanış getirisi kovası (rest = b/4-2)
    return "+".join(p)
def sql(offset, limit):
    ch = "||".join(f"substr('{A}',((c>>{6 * k})&63)+1,1)" for k in range(10))
    return f"SELECT group_concat({ch},'') s, count(*) n FROM (SELECT ({code_expr()}) c FROM feat WHERE adr>0 ORDER BY sym,d LIMIT {limit} OFFSET {offset})"
if __name__ == '__main__':
    off = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    lim = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
    print(sql(off, lim))
