import pickle,numpy as np,pandas as pd
exec(open('ideas.py').read().split('rows=[]')[0])
# endeks rejimi: XU100 dün kapanışı 20g ort üstünde mi, 5g değişim
xc=np.array([XD[k][1][-1,4] for k in xk]); reg={}
for i,k in enumerate(xk):
    if i>=21: reg[k]=dict(xma=xc[i-1]/xc[i-21:i-1].mean()-1, x5=(xc[i-1]/xc[i-6]-1)*100, x1=(xc[i-1]/xc[i-2]-1)*100)
rows=[]
for sym,days in S.items():
    C=np.array([a[-1,4] for _,_,a in days]); H=np.array([a[:,2].max() for _,_,a in days]); L=np.array([a[:,3].min() for _,_,a in days]); V=np.array([(a[:,4]*a[:,5]).sum() for _,_,a in days]); O=np.array([a[0,1] for _,_,a in days])
    for i in range(21,len(days)):
        k,t,a=days[i]; pc=C[i-1]; adr=np.mean((H[i-20:i]-L[i-20:i])/C[i-21:i-1])*100
        if V[i-20:i].mean()<5e7 or k not in reg: continue
        d1=(C[i-1]/C[i-2]-1)*100; d5=(C[i-1]/C[i-6]-1)*100
        if not(d1>=3 and d5>=5 and adr>=6): continue
        yclv=(C[i-1]-L[i-1])/(H[i-1]-L[i-1]) if H[i-1]>L[i-1] else .5
        ix=XD[k]; 
        for T in (600,615,630,660,720):
            m=np.where(t<T)[0]
            if not len(m): continue
            px=a[m[-1],4]; r=(px/pc-1)*100
            if not(-7<r<1): continue
            im=np.where(ix[0]<T)[0]; iT=(ix[1][im[-1],4]/xpc[k]-1)*100 if len(im) else np.nan
            # bugüne kadar gün içi hareket
            lo=a[:m[-1]+1,3].min(); hi=a[:m[-1]+1,2].max()
            g,pl,plH=race(a[m[-1]+1:],px)
            rows.append(dict(T=T,sym=sym,day=k,r=r,gap=(O[i]/pc-1)*100,iT=iT,yclv=yclv,d1=d1,d5=d5,adr=adr,dd=(lo/pc-1)*100,up=(hi/pc-1)*100,g=g,pl=pl,plH=plH,**reg[k]))
X=pd.DataFrame(rows); X['d']=pd.to_datetime(X.day*86400,unit='s').dt.strftime('%Y-%m-%d'); X['ay']=X.d.str[:7]; X['dow']=pd.to_datetime(X.d).dt.dayofweek
X.to_pickle('mom2.pkl')
c=0.1
def rep(x):
    e=x[x.d<'2026-03-15'];y=x[x.d>='2026-03-15'];mo=x.groupby('ay').pl.mean()-c
    top=x.groupby('sym').pl.sum().sort_values(ascending=False).index[:5]
    return pd.Series(dict(n=len(x),kazan=(x.g==1).mean()*100,stop=(x.g==2).mean()*100,ort=x.pl.mean()-c,eski=e.pl.mean()-c,yeni=y.pl.mean()-c,ay=f"{(mo>0).sum()}/{len(mo)}",top5=(x[~x.sym.isin(top)].pl-c).mean(),hedefsiz=x.plH.mean()-c))
pd.set_option('display.width',250)
print('giriş saati:'); print(X.groupby('T').apply(rep).round(2).to_string())
x=X[X['T']==630].copy()
for col,bins in [('iT',[-9,-1,-0.3,0.3,1,9]),('xma',[-1,-.02,0,.02,1]),('x1',[-9,-1,0,1,9]),('gap',[-9,-1,0,1,2,9]),('dd',[-9,-3,-2,-1,0]),('up',[-1,1,2,3,9]),('d1',[3,5,7,9.5,30]),('dow',[-1,0,1,2,3,4])]:
    x['b']=pd.cut(x[col],bins); print('\n',col); print(x.groupby('b').apply(rep).round(2).to_string())
