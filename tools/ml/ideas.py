import pickle,numpy as np,pandas as pd,datetime as dt
S=pickle.load(open('S.pkl','rb'))
XU=S.pop('XU100'); XD={k:(t,a) for k,t,a in XU}; xk=sorted(XD)
xpc={k:(XD[xk[i-1]][1][-1,4] if i else np.nan) for i,k in enumerate(xk)}
def race(seg,px,tg=3,st=1):
    """seg: bars after entry. returns (g, pl, plH)"""
    if len(seg)==0: return 0,0.0,0.0
    sl=px*(1-st/100); tp=px*(1+tg/100); g=0; pl=None
    for b in seg:
        if b[1]<=sl and pl is None: pass
        if b[3]<=sl: g=2; pl=(min(sl,b[1])/px-1)*100; break   # açılış stopun altındaysa oradan
        if b[2]>=tp: g=1; pl=(max(tp,b[1]) if b[1]>tp else tp)/px*100-100; break
    if pl is None: pl=(seg[-1,4]/px-1)*100
    plH=None
    for b in seg:
        if b[3]<=sl: plH=(min(sl,b[1])/px-1)*100; break
    if plH is None: plH=(seg[-1,4]/px-1)*100
    return g,pl,plH
rows=[]
def add(idea,sym,day,px,seg,**kw):
    g,pl,plH=race(seg,px)
    mfe=(seg[:,2].max()/px-1)*100 if len(seg) else 0
    rows.append(dict(idea=idea,sym=sym,day=day,g=g,pl=pl,plH=plH,mfe=mfe,**kw))
for sym,days in S.items():
    n=len(days)
    C=np.array([a[-1,4] for _,_,a in days]); H=np.array([a[:,2].max() for _,_,a in days]); L=np.array([a[:,3].min() for _,_,a in days])
    O=np.array([a[0,1] for _,_,a in days]); V=np.array([(a[:,4]*a[:,5]).sum() for _,_,a in days])
    for i in range(21,n):
        k,t,a=days[i]; pc=C[i-1]
        adr=np.mean((H[i-20:i]-L[i-20:i])/C[i-21:i-1])*100
        ciro=V[i-20:i].mean()
        if ciro<5e7: continue
        d1=(C[i-1]/C[i-2]-1)*100; d5=(C[i-1]/C[i-6]-1)*100; d20=(C[i-1]/C[i-21]-1)*100
        yclv=(C[i-1]-L[i-1])/(H[i-1]-L[i-1]) if H[i-1]>L[i-1] else .5
        hi20=H[i-20:i].max()
        dow=dt.datetime.utcfromtimestamp(k*86400).weekday()
        ix=XD.get(k); 
        base=dict(adr=adr,d1=d1,d5=d5,d20=d20,yclv=yclv,dow=dow)
        # ---- A: dün tavan (d1>=9.5) → bugün açılış/10:15/10:30 girişi
        if d1>=9.5:
            for T,lab in ((600,'A1 dün tavan · 10:00 açılışta al'),(630,'A2 dün tavan · 10:30 al')):
                m=np.where(t<T)[0]
                if not len(m): continue
                j=m[-1]; px=a[j,4]; r=(px/pc-1)*100
                if r>=9.5: continue  # tavandan alınamaz
                add(lab,sym,k,px,a[j+1:],r=r,**base)
        # ---- B: güçlü kapanış gecesi: bugün kapanışta al (≥+3, kapanış yeri ≥0.8, tavan değil), yarın +3/-1
        if i<n-1:
            rD=(C[i]/pc-1)*100; clv=(C[i]-L[i])/(H[i]-L[i]) if H[i]>L[i] else .5
            if 3<=rD<9.5 and clv>=0.8 and adr>=4:
                nk,nt,na=days[i+1]
                add('B1 güçlü gün kapanışta al → yarın',sym,k,C[i],na,r=rD,**base)
            if rD>=9.5:
                nk,nt,na=days[i+1]
                add('B2 tavan kapanışta al (alınabilirse) → yarın',sym,k,C[i],na,r=rD,**base)
        # ---- C: ilk saat aralığı kırılımı (10:00-11:00 tepesi), 11:00-15:00 arası ilk kırılım mumunun kapanışında al
        if adr>=4:
            m1=(t>=600)&(t<660)
            if m1.sum()>=3:
                orh=a[m1,2].max(); orl=a[m1,3].min()
                for j in np.where((t>=660)&(t<900))[0]:
                    if a[j,4]>orh:
                        px=a[j,4]; r=(px/pc-1)*100
                        if r<7 and (orh-orl)/pc*100<adr:
                            vr=a[j,5]/max(a[m1,5].mean(),1)
                            add('C ilk saat tepesini kırınca al',sym,k,px,a[j+1:],r=r,vr=vr,orr=(orh-orl)/pc*100/adr,**base)
                        break
        # ---- D: 20 gün zirvesini gün içinde ilk kırış (10:30-15:00)
        if adr>=4:
            for j in np.where((t>=600)&(t<900))[0]:
                if a[j,2]>hi20:
                    if t[j]<630 or a[j,4]<=hi20: break
                    px=a[j,4]; r=(px/pc-1)*100
                    if r<7: add('D 20 gün zirvesini kırınca al',sym,k,px,a[j+1:],r=r,**base)
                    break
        # ---- E: açılış boşluğu ≥+2 ve 10:30'da açılışın üstünde (gap & go)
        m=np.where(t<630)[0]
        if len(m) and adr>=4:
            j=m[-1]; px=a[j,4]; gap=(O[i]/pc-1)*100; r=(px/pc-1)*100
            if 2<=gap<7 and px>O[i] and r<7: add('E boşlukla açılıp tutunan (10:30)',sym,k,px,a[j+1:],r=r,**base)
            if gap<=-2 and px>pc and r<7: add('F aşağı açılıp artıya dönen (10:30)',sym,k,px,a[j+1:],r=r,**base)
        # ---- G: endeks düşerken güçlü (11:00): XU100 ≤ -0.7, hisse ≥ +2
        if ix is not None and xpc[k]==xpc[k] and adr>=4:
            it,ia=ix; mm=np.where(it<660)[0]; m=np.where(t<660)[0]
            if len(mm) and len(m):
                iT=(ia[mm[-1],4]/xpc[k]-1)*100; px=a[m[-1],4]; r=(px/pc-1)*100
                if iT<=-0.7 and 2<=r<7: add('G endeks düşerken güçlü hisse (11:00)',sym,k,px,a[m[-1]+1:],r=r,iT=iT,**base)
        # ---- H: hacim patlaması: 15 dk mum hacmi ≥ 5x aynı gün ort., yeşil, tepeye yakın kapanış (10:30-15:00)
        if adr>=4 and i>=1:
            for j in np.where((t>=630)&(t<900))[0]:
                pv=a[(t>=600)&(t<t[j]),5]
                if len(pv)<2: continue
                b=a[j]; rg=b[2]-b[3]
                if b[5]>=5*pv.mean() and b[4]>b[1] and rg>0 and (b[4]-b[3])/rg>=0.7:
                    px=b[4]; r=(px/pc-1)*100
                    if r<7: add('H hacim patlaması + güçlü mum',sym,k,px,a[j+1:],r=r,**base)
                    break
        # ---- I: VWAP'a geri çekilip dönen (trend günü): 10:30'da ≥+2, sonra VWAP'a değip üstünde kapanan ilk mum (11:00-15:00)
        m=np.where(t<630)[0]
        if len(m) and adr>=4 and 2<=(a[m[-1],4]/pc-1)*100<7:
            for j in np.where((t>=660)&(t<900))[0]:
                xb=a[:j+1]; vw=(xb[:,4]*xb[:,5]).sum()/max(xb[:,5].sum(),1)
                if a[j,3]<=vw*1.002 and a[j,4]>vw and a[j,4]>a[j,1]:
                    px=a[j,4]; add('I yükselen hisse VWAP\'tan dönünce al',sym,k,px,a[j+1:],r=(px/pc-1)*100,**base); break
R=pd.DataFrame(rows); R['d']=pd.to_datetime(R.day*86400,unit='s').dt.strftime('%Y-%m-%d'); R['ay']=R.d.str[:7]
R.to_pickle('ideas.pkl'); print(len(R))
