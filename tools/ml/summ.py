import pickle,numpy as np,pandas as pd,sys
exec(open('ideas.py').read().split('rows=[]')[0])  # race, S
R=pd.read_pickle(sys.argv[1] if len(sys.argv)>1 else 'ideas.pkl')
# Momentum taban (aynı motorla)
mr=[]
for sym,days in S.items():
    C=np.array([a[-1,4] for _,_,a in days]); H=np.array([a[:,2].max() for _,_,a in days]); L=np.array([a[:,3].min() for _,_,a in days]); V=np.array([(a[:,4]*a[:,5]).sum() for _,_,a in days])
    for i in range(21,len(days)):
        k,t,a=days[i]; pc=C[i-1]; adr=np.mean((H[i-20:i]-L[i-20:i])/C[i-21:i-1])*100
        if V[i-20:i].mean()<5e7: continue
        d1=(C[i-1]/C[i-2]-1)*100; d5=(C[i-1]/C[i-6]-1)*100
        m=np.where(t<630)[0]
        if not len(m): continue
        px=a[m[-1],4]; r=(px/pc-1)*100
        if d1>=3 and d5>=5 and adr>=6 and -7<r<1:
            g,pl,plH=race(a[m[-1]+1:],px); mr.append(dict(idea='0 MOMENTUM (karşılaştırma)',sym=sym,day=k,g=g,pl=pl,plH=plH))
M=pd.DataFrame(mr); M['d']=pd.to_datetime(M.day*86400,unit='s').dt.strftime('%Y-%m-%d'); M['ay']=M.d.str[:7]
R=pd.concat([M,R],ignore_index=True); R.to_pickle('all.pkl')
c=0.1
def rep(x):
    p=x.pl-c; h=x.plH-c; e=x[x.d<'2026-03-15']; y=x[x.d>='2026-03-15']
    top=x.groupby('sym').pl.sum().sort_values(ascending=False).index[:5]
    mo=x.groupby('ay').pl.mean()-c
    return pd.Series(dict(n=len(x),gun=x.day.nunique(),kazan=(x.g==1).mean()*100,stop=(x.g==2).mean()*100,
       ort=p.mean(),eski=(e.pl-c).mean(),yeni=(y.pl-c).mean(),ay_arti=f"{(mo>0).sum()}/{len(mo)}",
       top5haric=(x[~x.sym.isin(top)].pl-c).mean(),hedefsiz=h.mean()))
pd.set_option('display.width',250)
print(R.groupby('idea').apply(rep).round(2).to_string())
