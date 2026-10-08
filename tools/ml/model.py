import numpy as np, pandas as pd, warnings; warnings.filterwarnings('ignore')
from sklearn.ensemble import HistGradientBoostingRegressor as HGR
df=pd.read_pickle('feat.pkl')
def pnl(o,K,rest): return np.where(o==1,K,np.where(o==2,-K,rest))
df['p10']=pnl(df.o10,1,df.rest); df['p15']=pnl(df.o15,1.5,df.rest); df['p20']=pnl(df.o20,2,df.rest)
df['ps3']=np.where(df.mae<=-3,-3,df.rest)
df=df.dropna(subset=['p10','p15','p20'])
# kesitsel sıralar
for c in ['r30','vr30','d1','d5','d20','gap','rng30','dist']:
    df['k_'+c]=df.groupby('d')[c].rank(pct=True)
df['r30x']=df.r30-df.mr30; df['d5x']=df.d5-df.md5; df['d20x']=df.d20-df.md20
X=['md20','md5','mr30','up','gap','r30','vr30','d1','d5','d20','dist','sq','vt','above','i30','rng30','adr','wd','r30x','d5x','d20x']+[c for c in df if c.startswith('k_')]
df['m']=df.d.str[:7]
df['mom']=(df.d1>=3)&(df.d5>=5)&(df.adr>=6)&(df.r30<1)
months=sorted(df.m.unique()); print('aylar',months)
COST=0.2
def run(target,start=3,topk=2,minpred=None,seed=0):
    out=[]
    for i in range(start,len(months)):
        tr=df[df.m<months[i]]; te=df[df.m==months[i]].copy()
        mdl=HGR(max_iter=200,learning_rate=0.04,max_leaf_nodes=15,min_samples_leaf=80,l2_regularization=1.0,random_state=seed)
        mdl.fit(tr[X],tr[target]); te['pr']=mdl.predict(te[X]); out.append(te)
    o=pd.concat(out)
    return o
def pick(o,target,topk,thr):
    s=o[o.pr>thr].sort_values('pr',ascending=False).groupby('d').head(topk)
    return s
def rep(name,s,col):
    if len(s)==0: print(name,'işlem yok'); return
    g=s[col]; byd=s.groupby('d')[col].mean(); bym=s.groupby('m')[col].sum()
    top5=s.groupby('sym')[col].sum().sort_values(ascending=False)
    ex5=g[~s.sym.isin(top5.index[:5])].mean()
    eq=s.groupby('d')[col].mean().cumsum(); dd=(eq-eq.cummax()).min()
    print(f"{name:34s} n={len(s):4d} gün={s.d.nunique():3d} ort={g.mean():+.2f} net={g.mean()-COST:+.2f} kaz%={(g>0).mean()*100:4.0f} artıAy={int((bym>0).sum())}/{len(bym)} top5hariç={ex5:+.2f} maxDD={dd:+.1f}")
for tgt in ['p15','p20','ps3']:
    o=run(tgt)
    print('\n=== hedef',tgt,'test dönemi',o.d.min(),'..',o.d.max(),' tüm satır ort',round(o[tgt].mean(),2))
    for k in [1,2,3]:
        for thr in [-9,0,0.3,0.6]:
            rep(f'model top{k} eşik>{thr}',pick(o,tgt,k,thr),tgt)
    rep('MOMENTUM (aynı dönem)',o[o.mom],tgt)
    o.to_pickle(f'oos_{tgt}.pkl')
