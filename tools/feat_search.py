#!/usr/bin/env python3
"""%60 araması — ADIM 2: tools/data/parca_*.txt dosyalarındaki sıkıştırılmış satırları çözer ve kural arar.
Kural = 1–3 özelliğin kova aralıkları (ör. 'vr30 ≥1,5 VE i30 ≥0'). Ölçü: 10:30'da gir, ±K% hedef/stop — önce hangisi?
Başarı: hedef önce → kazandı; stop önce → kaybetti; ikisi de yoksa kapanış >0 → kazandı.
SAHTE BAŞARIYA KARŞI: kurallar YALNIZ eski dönemde aranır (bit45=1), yeni dönemde doğrulanır. Binlerce kombinasyonda bazıları
şans eseri %60 çıkar; yeni dönemde de tutmayan kural kabul edilmez. Ayrıca eski dönemde ≥150, yeni dönemde ≥60 işlem şartı.
Kullanım: python3 feat_search.py [K=1|1.5|2]"""
import sys, glob, math, itertools
import numpy as np
from feat_pack import F, A
K = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
KI = {1.0: 0, 1.5: 1, 2.0: 2}[K]
def decode(s):
    idx = {c: i for i, c in enumerate(A)}
    rows = []
    for k in range(0, len(s) - len(s) % 10, 10):
        v = 0
        for j, ch in enumerate(s[k:k + 10]): v |= idx[ch] << (6 * j)
        rows.append(v)
    return np.array(rows, dtype=np.uint64)
def load():
    s = ''.join(open(f).read().strip() for f in sorted(glob.glob('data/parca_*.txt')))
    return decode(s)
def fields(C):
    B = np.stack([((C >> np.uint64(3 * i)) & np.uint64(7)).astype(np.int8) for i in range(len(F))], 1)
    old = ((C >> np.uint64(45)) & np.uint64(1)).astype(bool)
    o = ((C >> np.uint64(46 + 2 * KI)) & np.uint64(3)).astype(np.int8)
    rest = ((C >> np.uint64(52)) & np.uint64(31)).astype(float) / 4 - 2
    return B, old, o, rest
def wilson(w, n, z=1.64):
    if n == 0: return 0
    p = w / n; d = 1 + z * z / n
    return (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d
def main():
    C = load(); B, old, o, rest = fields(C)
    ok = o != 3
    win = (o == 1) | ((o == 0) & (rest > 0))
    ev = np.where(o == 1, K, np.where(o == 2, -K, np.clip(rest, -K, K)))
    print(f'satır {len(C)} · geçerli {ok.sum()} · eski {(ok & old).sum()} · yeni {(ok & ~old).sum()} · hedef ±%{K}')
    print(f'TABAN  eski %{win[ok & old].mean() * 100:.1f} (ort {ev[ok & old].mean():+.3f}) · yeni %{win[ok & ~old].mean() * 100:.1f} (ort {ev[ok & ~old].mean():+.3f})')
    # tekil şartlar: her özellik için kova aralıkları [lo,hi] (boş=7 hariç)
    conds = []
    for i, (name, cuts) in enumerate(F):
        nb = len(cuts) + 1
        for lo in range(nb):
            for hi in range(lo, nb):
                if lo == 0 and hi == nb - 1: continue
                m = (B[:, i] >= lo) & (B[:, i] <= hi) & (B[:, i] != 7)
                lab = f'{name} ' + (f'<{cuts[hi]}' if lo == 0 else f'≥{cuts[lo - 1]}' if hi == nb - 1 else f'{cuts[lo - 1]}..{cuts[hi]}')
                conds.append((i, lab, m & ok))
    def score(m):
        a, b = m & old, m & ~old
        na, nb_ = int(a.sum()), int(b.sum())
        if na < 150 or nb_ < 60: return None
        wa, wb = int(win[a].sum()), int(win[b].sum())
        return dict(na=na, pa=wa / na, lb=wilson(wa, na), ea=float(ev[a].mean()), nb=nb_, pb=wb / nb_, eb=float(ev[b].mean()))
    res = []
    for (i, l, m) in conds:
        r = score(m)
        if r: res.append(((l,), r))
    pairs = []
    for (i1, l1, m1), (i2, l2, m2) in itertools.combinations(conds, 2):
        if i1 == i2: continue
        r = score(m1 & m2)
        if r: pairs.append(((l1, l2), r, m1 & m2, (i1, i2)))
    res += [(p[0], p[1]) for p in pairs]
    top = sorted(pairs, key=lambda x: -x[1]['lb'])[:40]           # üçlü: en iyi 40 ikiliden genişlet (yalnız ESKİ döneme göre sıralı)
    for (lab, r, m, ii) in top:
        for (i3, l3, m3) in conds:
            if i3 in ii: continue
            r3 = score(m & m3)
            if r3: res.append((lab + (l3,), r3))
    res.sort(key=lambda x: -x[1]['lb'])
    print('\nEN İYİ 25 (sıralama yalnız ESKİ döneme göre; YENİ sütunu doğrulama):')
    print(f"{'kural':70s} {'eski n':>6} {'eski %':>7} {'eski ort':>8} | {'yeni n':>6} {'yeni %':>7} {'yeni ort':>8}")
    for lab, r in res[:25]:
        flag = '  ✅' if r['pb'] >= 0.6 and r['pa'] >= 0.6 else ''
        print(f"{' VE '.join(lab)[:70]:70s} {r['na']:6d} {r['pa'] * 100:6.1f}% {r['ea']:+8.3f} | {r['nb']:6d} {r['pb'] * 100:6.1f}% {r['eb']:+8.3f}{flag}")
if __name__ == '__main__':
    main()
