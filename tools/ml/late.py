import pickle,numpy as np,pandas as pd
exec(open('ideas.py').read().split('rows=[]')[0])
rows=[]
for sym,days in S.items():
    n=len(days)
    C=np.array([a[-1,4] for _,_,a in days]); H=np.array([a[:,2].max() for _,_,a in days]); L=np.array([a[:,3].min() for _,_,a in days]); V=np.array([(a[:,4]*a[:,5]).sum() for _,_,a in days])
    for i in range(21,n-1):
        k,t,a=days[i]; pc=C[i-1]; ciro=V[i-20:i].mean()
        if ciro<5e7: continue
        adr=np.mean((H[i-20:i]-L[i-20:i])/C[i-21:i-1])*100
        na=days[i+1][2]
        for T in (1050,1065):   # bu mumun kapanışında al (17:45 / 18:00)
            m=np.where(t==T)[0]
            if not len(m): continue
            j=m[0]; px=a[j,4]; r=(px/pc-1)*100
            if r<3: continue
            hiSoFar=a[:j+1,2].max(); lo=a[:j+1,3].min()
            pos=(px-lo)/(hiSoFar-lo) if hiSoFar>lo else .5
            seg=np.vstack([a[j+1:],na])  # kapanış seansı + yarın
            g,pl,plH=race(seg,px)
            touched=(hiSoFar/pc-1)*100>=9.5
            rows.append(dict(T=T,sym=sym,day=k,r=r,pos=pos,adr=adr,touched=touched,clsT=(C[i]/pc-1)*100>=9.5,g=g,pl=pl,plH=plH,auc=(C[i]/px-1)*100,opn=(na[0,1]/px-1)*100))
X=pd.DataFrame(rows); X['d']=pd.to_datetime(X.day*86400,unit='s').dt.strftime('%Y-%m-%d'); X['ay']=X.d.str[:7]; X.to_pickle('late.pkl')
c=0.1
def rep(x):
    e=x[x.d<'2026-03-15'];y=x[x.d>='2026-03-15'];mo=x.groupby('ay').pl.mean()-c
    top=x.groupby('sym').pl.sum().sort_values(ascending=False).index[:5]
    return pd.Series(dict(n=len(x),kazan=(x.g==1).mean()*100,stop=(x.g==2).mean()*100,ort=x.pl.mean()-c,eski=e.pl.mean()-c,yeni=y.pl.mean()-c,ay=f"{(mo>0).sum()}/{len(mo)}",top5=(x[~x.sym.isin(top)].pl-c).mean(),hedefsiz=x.plH.mean()-c,tavanKap=x.clsT.mean()*100))
pd.set_option('display.width',250)
for T in (1050,1065):
    x=X[(X['T']==T)&(X.r<9.3)].copy(); x['b']=pd.cut(x.r,[3,5,7,8,9,9.3])
    print('GİRİŞ',T//60,':',T%60,'(tavan değil, r<9.3)'); print(x.groupby('b').apply(rep).round(2).to_string())
    x2=x[(x.r>=7)]; x2['pb']=pd.cut(x2.pos,[0,.8,.95,1.01]); print(' r≥7, gün içi yer:'); print(x2.groupby('pb').apply(rep).round(2).to_string()); print()
