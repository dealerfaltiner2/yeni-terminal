import pandas as pd,numpy as np
P=pd.concat([pd.read_csv(f'isprices{i}.tsv',sep='\t') for i in range(4)]); P['date']=pd.to_datetime(P.date.astype(str).str[:10]); P=P.drop_duplicates(['kod','date']).sort_values(['kod','date'])
M=pd.read_csv('mcap.tsv',sep='\t').set_index('kod')
R=pd.read_pickle('is2.pkl')
last=P.groupby('kod').apply(lambda x: x.set_index('date').close)  # not used
rows=[]
for r in R.itertuples():
    x=P[P.kod==r.sym1].reset_index(drop=True)
    if len(x)<5 or r.sym1 not in M.index: continue
    dt=r.dt; d=dt.normalize(); hm=dt.hour*60+dt.minute
    idx=x.index[x.date>=d]
    if not len(idx): continue
    i=idx[0]
    if x.date[i]==d and 600<=hm<1080: mode='seans'; ent=x.close[i]; j=i   # gün içi haber: kapanışta (geç) giriş
    elif x.date[i]==d and hm<600: mode='sabah'; j=i; ent=x.open[j]
    else:
        j=i if x.date[i]>d else i+1
        if j>=len(x): continue
        mode='aksam'; ent=x.open[j]
    if j<1: continue
    pc=x.close[j-1]
    # piyasa değeri: bugünkü değer × (o günkü fiyat / bugünkü fiyat); bugünkü fiyat mcap.tsv'deki
    mc=M.loc[r.sym1,'market_cap']*pc/M.loc[r.sym1,'price']
    o=dict(sym=r.sym1,d=str(x.date[j].date()),mode=mode,oran=r.tl/mc*100,pre=(ent/pc-1)*100)
    if mode!='seans':
        o['gun']=(x.close[j]/ent-1)*100; hi=(x.high[j]/ent-1)*100; lo=(x.low[j]/ent-1)*100
        o['g']= 'belirsiz' if hi>=3 and lo<=-1 else ('kazan' if hi>=3 else ('kayip' if lo<=-1 else 'yok'))
        o['d3']=(x.close[min(j+2,len(x)-1)]/ent-1)*100
    else:
        o['tepki']=(x.close[i]/x.open[i]-1)*100
        o['ertesi']=(x.close[min(j+1,len(x)-1)]/ent-1)*100; o['d3']=(x.close[min(j+3,len(x)-1)]/ent-1)*100
    rows.append(o)
E=pd.DataFrame(rows); E.to_pickle('is_ev.pkl'); print(len(E),E['mode'].value_counts().to_dict())
E['b']=pd.cut(E.oran,[0,1,5,20,1e9],labels=['<%1','%1-5','%5-20','>%20'])
c=0.1
A=E[E['mode']!='seans']
print('\nGECE/SABAH GELEN HABER → açılışta al (ertesi işlem günü):')
for b,x in A.groupby('b',observed=True):
    v=x.g.value_counts()
    print(f"  {b:7s} n {len(x):3d} | açılış boşluğu ort {x.pre.mean():+.2f} | açılıştan kapanışa {x.gun.mean()-c:+.2f} (medyan {x.gun.median():+.2f}) | +3 önce: kazan {v.get('kazan',0)} kayıp {v.get('kayip',0)} belirsiz {v.get('belirsiz',0)} yok {v.get('yok',0)} | 3 gün {x.d3.mean()-c:+.2f}")
S=E[E['mode']=='seans']
print('\nSEANS İÇİ HABER (günlük veriyle yalnız kapanışta girilebilir):')
for b,x in S.groupby('b',observed=True):
    print(f"  {b:7s} n {len(x):3d} | o gün açılış→kapanış {x.tepki.mean():+.2f} | kapanışta al→ertesi gün {x.ertesi.mean()-c:+.2f} | 3 gün {x.d3.mean()-c:+.2f}")
