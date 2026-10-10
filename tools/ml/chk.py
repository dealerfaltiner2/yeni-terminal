import pandas as pd,numpy as np
X=pd.read_pickle('g31h.pkl'); C=0.1; X['ay']=X.d.str[:7]
def rep(nm,x,col):
    p=x[col]-C; top=x.groupby('sym')[col].sum().sort_values(ascending=False).index[:5]
    dd=x.groupby('d')[col].mean()-C; mo=x.groupby('ay')[col].mean()-C
    per=lambda a,b: (x[(x.d>=a)&(x.d<b)][col]-C).mean()
    print(f"{nm:55s} {col:3s} n {len(x):4d} gün {x.d.nunique():3d} | ort {p.mean():+.2f} | gün ort {dd.mean():+.2f} artı gün %{(dd>0).mean()*100:.0f} | ay {(mo>0).sum()}/{len(mo)} | 5 hisse hariç {(x[~x.sym.isin(top)][col]-C).mean():+.2f} | dönem {per('2000','2026-03-01'):+.2f}/{per('2026-03-01','2026-06-15'):+.2f}/{per('2026-06-15','2100'):+.2f} | kazan(+3) %{(x.g==1).mean()*100:.0f}")
x=X[X['T']==720]
for nm,m in [('12:00 hisse açılıştan ≥+2 & endeks ≥+0,8',(x.roT>=1.96)&(x.iT>=0.8)),
             ('12:00 endeks ≥+0,8 & aralık ≥1,1×ADR',(x.iT>=0.8)&(x.rng>=1.1)),
             ('12:00 endeks ≥+0,8 (hepsi)',(x.iT>=0.8)),
             ('12:00 hisse açılıştan ≥+2 (hepsi)',(x.roT>=1.96))]:
    for col in ('pl','plH'): rep(nm,x[m],col)
# günde en çok 3: en güçlü roT
y=x[(x.roT>=1.96)&(x.iT>=0.8)].sort_values('roT',ascending=False).groupby('d').head(3)
for col in ('pl','plH'): rep('  └ günde en çok 3 (en güçlü)',y,col)
y=x[(x.roT>=1.96)&(x.iT>=0.8)&(x.rT<7)].sort_values('roT').groupby('d').head(3)
for col in ('pl','plH'): rep('  └ günde en çok 3 (en zayıf roT)',y,col)
# eşik pürüzsüzlüğü
print('\neşik taraması (plH, roT eşiği × endeks eşiği):')
for a in (1,1.5,2,2.5,3):
    print(a,' '.join(f"iT≥{b}: {(x[(x.roT>=a)&(x.iT>=b)].plH-C).mean():+.2f}({((x.roT>=a)&(x.iT>=b)).sum()})" for b in (0,0.4,0.8,1.2,1.6)))
