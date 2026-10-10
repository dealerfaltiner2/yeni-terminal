import pickle,numpy as np,pandas as pd
exec(open('ideas.py').read().split('rows=[]')[0])
rows=[]
def add(idea,sym,k,px,seg,**kw):
    g,pl,plH=race(seg,px); rows.append(dict(idea=idea,sym=sym,day=k,g=g,pl=pl,plH=plH,**kw))
for sym,days in S.items():
    n=len(days)
    C=np.array([a[-1,4] for _,_,a in days]); H=np.array([a[:,2].max() for _,_,a in days]); L=np.array([a[:,3].min() for _,_,a in days]); V=np.array([(a[:,4]*a[:,5]).sum() for _,_,a in days])
    for i in range(21,n):
        k,t,a=days[i]; pc=C[i-1]; ciro=V[i-20:i].mean()
        if ciro<5e7: continue
        adr=np.mean((H[i-20:i]-L[i-20:i])/C[i-21:i-1])*100
        d1=(C[i-1]/C[i-2]-1)*100; d20=(C[i-1]/C[i-21]-1)*100
        # 1) TAVANA KOŞU: gün içinde ilk kez +X'i geçen mumun kapanışında al (10:15-17:00), hedef +3 ≈ tavana yakın
        for X in (5,6,7,8):
            for j in np.where((t>=615)&(t<1020))[0]:
                if (a[j,2]/pc-1)*100>=X:
                    px=a[j,4]; r=(px/pc-1)*100
                    if X<=r<9: add(f'1 gün içinde +%{X}\'u ilk geçince al',sym,k,px,a[j+1:],r=r,adr=adr,tod=t[j])
                    break
        # 2) SERT DÜŞÜŞTEN DÖNÜŞ: trendde hisse (d20≥10) gün içinde ≤−4 olup mum yeşil kapanınca (11:00-16:00)
        if d20>=10:
            for j in np.where((t>=660)&(t<960))[0]:
                lo=(a[:j+1,3].min()/pc-1)*100
                if lo<=-4 and a[j,4]>a[j,1] and (a[j,4]/pc-1)*100<=-2:
                    add('2 trenddeki hisse −%4 düşüp dönünce',sym,k,a[j,4],a[j+1:],adr=adr); break
        # 3) AÇILIŞ SEANSI: açılış mumu (09:55) hacmi 20g ort açılış hacminin ≥3 katı ve açılış +1..+4 → 10:15'te al
        if t[0]==585:
            av=[days[q][2][0,5] for q in range(i-20,i) if days[q][1][0]==585]
            if len(av)>10:
                vr=a[0,5]/max(np.mean(av),1); gp=(a[0,4]/pc-1)*100
                m=np.where(t<615)[0]
                if vr>=3 and 1<=gp<=4 and len(m):
                    add('3 açılışta yoğun alım (hacim ≥3x, +1..+4)',sym,k,a[m[-1],4],a[m[-1]+1:],adr=adr)
        # 4) 3 GÜN ÜST ÜSTE DÜŞÜŞ SONRASI (her biri ≤−2), trend yukarı (d20 eski ≥0): 10:30'da al
        if i>=24 and all((C[i-q]/C[i-q-1]-1)*100<=-2 for q in (1,2,3)) and adr>=4:
            m=np.where(t<630)[0]
            if len(m): add('4 üç gün sert düşüş sonrası 10:30',sym,k,a[m[-1],4],a[m[-1]+1:],adr=adr)
        # 5) TAVAN SERİSİ: dün tavan + önceki gün de tavan → bugün 10:30
        if i>=3 and d1>=9.5 and (C[i-2]/C[i-3]-1)*100>=9.5:
            m=np.where(t<630)[0]
            if len(m) and (a[m[-1],4]/pc-1)*100<9.5: add('5 iki gün tavan sonrası 10:30',sym,k,a[m[-1],4],a[m[-1]+1:],adr=adr)
R=pd.DataFrame(rows); R['d']=pd.to_datetime(R.day*86400,unit='s').dt.strftime('%Y-%m-%d'); R['ay']=R.d.str[:7]; R.to_pickle('wide.pkl')
c=0.1
def rep(x):
    e=x[x.d<'2026-03-15'];y=x[x.d>='2026-03-15'];mo=x.groupby('ay').pl.mean()-c
    top=x.groupby('sym').pl.sum().sort_values(ascending=False).index[:5]
    return f"n {len(x):4d} gün {x.day.nunique():3d} | kazan %{(x.g==1).mean()*100:4.1f} | ort {x.pl.mean()-c:+.2f} (eski {e.pl.mean()-c:+.2f} yeni {y.pl.mean()-c:+.2f}) | ay {(mo>0).sum()}/{len(mo)} | top5 hariç {(x[~x.sym.isin(top)].pl-c).mean():+.2f} | hedefsiz {x.plH.mean()-c:+.2f}"
for k,x in R.groupby('idea'): print(f"{k:45s}",rep(x))
x=R[R.idea.str.startswith('1 gün içinde +%7')]
print('\n+%7 saat dağılımı:'); 
for lo,hi in ((615,720),(720,900),(900,1020)): print(lo,hi,rep(x[(x.tod>=lo)&(x.tod<hi)]))
