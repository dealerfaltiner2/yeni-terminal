import numpy as np, pandas as pd, warnings; warnings.filterwarnings('ignore')
exec(open('model.py').read().split("months=sorted")[0])
months=sorted(df.m.unique())
from sklearn.ensemble import HistGradientBoostingClassifier as HGC
# 1) Momentum içinde model puanı işe yarıyor mu?
for t in ['p15','p20']:
    o=pd.read_pickle(f'oos_{t}.pkl'); mo=o[o.mom].copy()
    med=o.pr.median(); q=mo.pr.quantile(.5)
    a=mo[mo.pr>=q]; b=mo[mo.pr<q]
    print(t,'Momentum içinde model yüksek yarı',len(a),round(a[t].mean(),2),'düşük yarı',len(b),round(b[t].mean(),2))
# 2) kazanma olasılığı sınıflandırıcısı (o15==1)
out=[]
for i in range(3,len(months)):
    tr=df[(df.m<months[i])]; te=df[df.m==months[i]].copy()
    c=HGC(max_iter=200,learning_rate=0.04,max_leaf_nodes=15,min_samples_leaf=80,l2_regularization=1.0,random_state=0)
    c.fit(tr[X],(tr.o15==1).astype(int)); te['pw']=c.predict_proba(te[X])[:,1]; out.append(te)
o=pd.concat(out)
for thr in [.45,.5,.55,.6]:
    s=o[o.pw>thr].sort_values('pw',ascending=False).groupby('d').head(2)
    print(f'sınıflandırıcı p>{thr}: n={len(s)} kaz%={(s.o15==1).mean()*100:.0f} (hedef/stop yarışında)  ort p15={s.p15.mean():+.2f}')
print('tüm satırlarda ±1.5 hedef önce %',round((o.o15==1).mean()*100))
# 3) şans kontrolü: hedefi gün içinde karıştır, aynı modeli eğit
rng=np.random.default_rng(1); res=[]
for rep in range(5):
    d2=df.copy(); d2['p20']=d2.groupby('d').p20.transform(lambda s: rng.permutation(s.values))
    outs=[]
    for i in range(3,len(months)):
        tr=d2[d2.m<months[i]]; te=d2[d2.m==months[i]].copy()
        mdl=HGR(max_iter=200,learning_rate=0.04,max_leaf_nodes=15,min_samples_leaf=80,l2_regularization=1.0,random_state=0)
        mdl.fit(tr[X],tr.p20); te['pr']=mdl.predict(te[X]); outs.append(te)
    oo=pd.concat(outs); s=oo.sort_values('pr',ascending=False).groupby('d').head(1)
    res.append(round(s.p20.mean(),2))
print('karıştırılmış hedefle top1 p20 ort (şans):',res)
