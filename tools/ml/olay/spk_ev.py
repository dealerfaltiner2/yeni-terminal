import pandas as pd,numpy as np
P=pd.concat([pd.read_csv(f'prices{i}.tsv',sep='\t') for i in range(3)]).drop_duplicates(['kod','date'])
P['date']=pd.to_datetime(P.date.str[:10]); P=P.sort_values(['kod','date'])
E=pd.read_csv('events.csv'); E['tarih']=pd.to_datetime(E.tarih)
E=E.drop_duplicates(['kod','tarih'])
rows=[]
for _,e in E.iterrows():
    x=P[P.kod==e.kod].reset_index(drop=True)
    i=np.where(x.date==e.tarih)[0]
    if not len(i) or i[0]<1 or i[0]+5>=len(x): continue
    i=i[0]; c0=x.close[i-1]; D=x.iloc[i]; N=x.iloc[i+1]
    o=N.open
    r=dict(kod=e.kod,tarih=e.tarih.date(),gun=e.gun,oran=e.yeni_sermaye/e.eski_sermaye-1,
      rD=(D.close/c0-1)*100, hiD=(D.high/c0-1)*100, gap1=(o/D.close-1)*100, oc1=(N.close/o-1)*100,
      hi1=(N.high/o-1)*100, lo1=(N.low/o-1)*100,
      h3=(x.close[i+3]/o-1)*100, h5=(x.close[i+5]/o-1)*100,
      tav1=(N.close/D.close-1)*100>=9.5, tavD=(D.close/c0-1)*100>=9.5)
    # gün sonuna kadar +3/-1 (günlük mumla): ikisi de → belirsiz
    up=r['hi1']>=3; dn=r['lo1']<=-1
    r['g']= 'belirsiz' if up and dn else ('kazan' if up else ('kayıp' if dn else 'yok'))
    r['pl']= 3 if r['g']=='kazan' else (-1 if r['g']=='kayıp' else (r['oc1'] if r['g']=='yok' else np.nan))
    rows.append(r)
R=pd.DataFrame(rows); R.to_pickle('spk_res.pkl')
print('olay',len(R))
print(R[['rD','gap1','oc1','hi1','lo1','h3','h5']].describe().round(2).to_string())
print(R.g.value_counts())
print('bülten günü tavan %',round(R.tavD.mean()*100,1),' ertesi gün tavan %',round(R.tav1.mean()*100,1))
print('\ngüne göre (bülten günü):'); print(R.groupby('gun')[['rD','gap1','oc1','h5']].mean().round(2))
R['ob']=pd.cut(R.oran,[0,0.5,1,2,5,100]); print('\nbedelsiz oranına göre:'); print(R.groupby('ob')[['rD','gap1','oc1','h5']].agg(['mean','count']).round(2))
