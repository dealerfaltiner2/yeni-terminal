import pickle,numpy as np,pandas as pd
D=pickle.load(open('bars.pkl','rb'))
def daysplit(b):
    a=np.array(b,dtype=float); loc=a[:,0]+3*3600
    d=(loc//86400).astype(int); tod=((loc%86400)//60).astype(int)  # dakika
    out={}
    for k in np.unique(d):
        m=d==k; x=a[m]; t=tod[m]
        if len(x)<30: continue
        out[k]=(t,x)
    return out
TS=[630,660,690,720,780,840,900,960,1020,1050]   # 10:30 ... 17:30
IX=daysplit(D['XU100@15']); ik=sorted(IX)
ipc={}; 
for i,k in enumerate(ik):
    ipc[k]=IX[ik[i-1]][1][-1,4] if i else np.nan
def at(t,x,T):  # T'ye kadar kapanmış mumlar
    m=t<T; return x[m]
rows=[]
for s in [k for k in D if k.endswith('@15') and not k.startswith('XU100')]:
    sym=s[:-3]; DS=daysplit(D[s]); ks=sorted(DS)
    C=np.array([DS[k][1][-1,4] for k in ks]); H=np.array([DS[k][1][:,2].max() for k in ks]); L=np.array([DS[k][1][:,3].min() for k in ks])
    V=np.array([DS[k][1][:,5].sum() for k in ks])
    for i in range(21,len(ks)-1):
        k=ks[i]; t,x=DS[k]; pc=C[i-1]
        if k not in IX: continue
        it,ixx=IX[k]
        adr=np.mean((H[i-20:i]-L[i-20:i])/C[i-21:i-1])*100
        if adr<2: continue
        # dün
        yt,yx=DS[ks[i-1]]
        yr=(H[i-1]-L[i-1]); yclv=(C[i-1]-L[i-1])/yr if yr>0 else .5
        ylast=(yx[-1,4]/yx[yt<1020][-1,4]-1)*100 if (yt<1020).any() else np.nan   # dün 17:00→kapanış
        yvw=(yx[:,4]*yx[:,5]).sum()/max(yx[:,5].sum(),1); yvwd=(C[i-1]/yvw-1)*100
        yvr=V[i-1]/V[i-21:i-1].mean()
        ylastv=yx[yt>=1020,5].sum()/max(V[i-1],1)
        d1=(C[i-1]/C[i-2]-1)*100; d5=(C[i-1]/C[i-6]-1)*100; d20=(C[i-1]/C[i-21]-1)*100
        dist=(C[i-1]/H[i-20:i].max()-1)*100
        nx=DS[ks[i+1]][1]; on=(nx[0,1]/C[i]-1)*100   # bu günün kapanışından yarın açılışa
        for T in TS:
            xb=at(t,x,T); xa=x[t>=T]
            if len(xb)<2 or len(xa)<1: continue
            px=xb[-1,4]; 
            ib=at(it,ixx,T)
            if len(ib)<1: continue
            o=xb[0,1]
            vw=(xb[:,4]*xb[:,5]).sum()/max(xb[:,5].sum(),1)
            # aynı saate kadar hacim, 20 gün ort.
            cv=[DS[ks[j]][1][DS[ks[j]][0]<T,5].sum() for j in range(i-20,i)]
            hi=xb[:,2].max(); lo=xb[:,3].min()
            f=dict(sym=sym,day=k,T=T,
              rT=(px/pc-1)*100, gap=(o/pc-1)*100, roT=(px/o-1)*100,
              iT=(ib[-1,4]/ipc[k]-1)*100 if ipc[k]==ipc[k] else np.nan,
              rng=(hi-lo)/pc*100/adr, pos=(px-lo)/(hi-lo) if hi>lo else .5,
              vwd=(px/vw-1)*100, vrT=xb[:,5].sum()/max(np.mean(cv),1),
              l1=(px/xb[-2,4]-1)*100 if len(xb)>=2 else 0, l2=(px/xb[-3,4]-1)*100 if len(xb)>=3 else 0,
              lv=xb[-1,5]/max(xb[:,5].mean(),1), offhi=(px/hi-1)*100, nh=float(xb[-1,2]>=hi),
              upb=(xb[:,4]>xb[:,1]).mean(),
              adr=adr,d1=d1,d5=d5,d20=d20,dist=dist,yclv=yclv,ylast=ylast,yvwd=yvwd,yvr=yvr,ylastv=ylastv)
            # sonuç: ±K yarışı
            for K in (1,1.5,2):
                up=px*(1+K/100); dn=px*(1-K/100); res=None
                for bb in xa:
                    hu=bb[2]>=up; hd=bb[3]<=dn
                    if hd: res=-K;break
                    if hu: res=K;break
                if res is None: res=(xa[-1,4]/px-1)*100
                f['p%d'%int(K*10)]=res
            f['rest']=(xa[-1,4]/px-1)*100; f['mae']=(xa[:,3].min()/px-1)*100; f['mfe']=(xa[:,2].max()/px-1)*100
            f['on']=on; f['hold1']=(nx[0,1]/px-1)*100
            rows.append(f)
df=pd.DataFrame(rows); df['d']=pd.to_datetime(df.day*86400,unit='s').dt.strftime('%Y-%m-%d')
df.to_pickle('rich.pkl'); print(df.shape, df.d.min(), df.d.max(), df.sym.nunique())
print(df.groupby('T')[['p10','p15','p20','rest']].mean().round(3))
