import json,pickle,numpy as np,pandas as pd
raw=json.load(open('geri_raw.txt')); rows=raw[0]['results']; G=pd.DataFrame(rows)
print('olay',len(G),'hisse',G.sym.nunique())
S=pickle.load(open('S.pkl','rb')); S.pop('XU100',None)
exec(open('ideas.py').read().split('S=pickle.load')[0])  # yok; race'i aşağıda tanımla
def race(seg,px,tg=3,st=1):
    sl=px*(1-st/100); tp=px*(1+tg/100); g=0; pl=None
    for b in seg:
        if b[3]<=sl: g=2; pl=(min(sl,b[1])/px-1)*100; break
        if b[2]>=tp: g=1; pl=(max(tp,b[1])/px-1)*100; break
    if pl is None: pl=(seg[-1,4]/px-1)*100 if len(seg) else 0
    plH=None
    for b in seg:
        if b[3]<=sl: plH=(min(sl,b[1])/px-1)*100; break
    if plH is None: plH=(seg[-1,4]/px-1)*100 if len(seg) else 0
    return g,pl,plH
out=[]
G['sym1']=G.sym.str.split(',').str[0]
G=G.sort_values('t')
last={}
for r in G.itertuples():
    s=r.sym1
    if s not in S: continue
    days=S[s]; dk=[d for d,_,_ in days]
    loc=r.t/1000+3*3600; day=int(loc//86400); m=int((loc%86400)//60)
    # giriş: seans içi (10:00-17:45) → bir sonraki 15 dk mumun kapanışı; değilse sonraki işlem günü 10:00 (ilk sürekli mum açılışı = 600 mumunun açılışı)
    import bisect
    if m<600: i=bisect.bisect_left(dk,day)
    elif m<1065 and day in dk: i=dk.index(day)
    else: i=bisect.bisect_right(dk,day)
    if i>=len(days): continue
    d,t,a=days[i]
    if d==day and 600<=m<1065:
        j=np.where(t>m)[0]
        if not len(j): continue
        j=j[0]; px=a[j,4]; seg=a[j+1:]
    else:
        j=np.where(t>=600)[0][0]; px=a[j,1]; seg=a[j:]
    g,pl,plH=race(seg,px)
    first = (s not in last) or (r.t-last[s] > 30*864e5)
    last[s]=r.t
    out.append(dict(sym=s,d=pd.to_datetime(d*86400,unit='s').strftime('%Y-%m-%d'),g=g,pl=pl,plH=plH,ilk=first))
R=pd.DataFrame(out); R['ay']=R.d.str[:7]; R=R.drop_duplicates(['sym','d'])
c=0.1
def rep(nm,x):
    mo=x.groupby('ay').pl.mean()-c; top=x.groupby('sym').pl.sum().sort_values(ascending=False).index[:5]
    print(f"{nm:40s} n {len(x):4d} hisse {x.sym.nunique():3d} | kazan(+3 önce) %{(x.g==1).mean()*100:.0f} stop %{(x.g==2).mean()*100:.0f} | +3/−1 ort {x.pl.mean()-c:+.2f} | hedefsiz {x.plH.mean()-c:+.2f} | ay {(mo>0).sum()}/{len(mo)} | 5 hisse hariç {(x[~x.sym.isin(top)].pl-c).mean():+.2f}")
rep('Geri alım bildirimi (100 büyük hisse)',R)
rep('  └ ilk bildirim (30 günde ilk)',R[R.ilk])
rep('  └ tekrar eden günlük bildirim',R[~R.ilk])
# karşılaştırma: aynı hisselerin rastgele günleri 10:00 açılış girişi
base=[]
syms=set(R.sym)
for s in syms:
    for d,t,a in S[s][::3]:
        j=np.where(t>=600)[0][0]; g,pl,plH=race(a[j:],a[j,1]); base.append(dict(sym=s,g=g,pl=pl,plH=plH,ay=pd.to_datetime(d*86400,unit='s').strftime('%Y-%m')))
rep('KARŞILAŞTIRMA: aynı hisseler, herhangi bir gün 10:00',pd.DataFrame(base))
