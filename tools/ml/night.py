import pickle,numpy as np,pandas as pd
exec(open('ideas.py').read().split('rows=[]')[0])
rows=[]
for sym,days in S.items():
    n=len(days)
    C=np.array([a[-1,4] for _,_,a in days]); H=np.array([a[:,2].max() for _,_,a in days]); L=np.array([a[:,3].min() for _,_,a in days]); V=np.array([(a[:,4]*a[:,5]).sum() for _,_,a in days])
    for i in range(21,n-1):
        k,t,a=days[i]; pc=C[i-1]
        ciro=V[i-20:i].mean()
        if ciro<5e7: continue
        adr=np.mean((H[i-20:i]-L[i-20:i])/C[i-21:i-1])*100
        rD=(C[i]/pc-1)*100; clv=(C[i]-L[i])/(H[i]-L[i]) if H[i]>L[i] else .5
        mx=(H[i]/pc-1)*100
        na=days[i+1][2]
        g,pl,plH=race(na,C[i])
        vr=V[i]/ciro
        # son saat: 17:00 -> kapanış
        m=np.where(days[i][1]<1020)[0]; last=(C[i]/a[m[-1],4]-1)*100 if len(m) else 0
        x=XD.get(k); iD=(x[1][-1,4]/xpc[k]-1)*100 if x is not None and xpc[k]==xpc[k] else np.nan
        rows.append(dict(sym=sym,day=k,rD=rD,clv=clv,mx=mx,adr=adr,vr=vr,last=last,iD=iD,d20=(C[i]/C[i-20]-1)*100,
            g=g,pl=pl,plH=plH,opn=(na[0,1]/C[i]-1)*100))
N=pd.DataFrame(rows); N['d']=pd.to_datetime(N.day*86400,unit='s').dt.strftime('%Y-%m-%d'); N['ay']=N.d.str[:7]
N.to_pickle('night.pkl'); print(len(N))
