import numpy as np,pandas as pd,warnings,sys; warnings.filterwarnings('ignore')
from sklearn.ensemble import HistGradientBoostingRegressor as HGR
df=pd.read_pickle('rich.pkl'); df['m']=df.d.str[:7]
F=['T','rT','gap','roT','iT','rng','pos','vwd','vrT','l1','l2','lv','offhi','nh','upb','adr','d1','d5','d20','dist','yclv','ylast','yvwd','yvr','ylastv']
df['xT']=df.rT-df.iT; F+=['xT']
for c in ['rT','xT','vrT','d5','vwd']:
    df['k_'+c]=df.groupby(['d','T'])[c].rank(pct=True); F.append('k_'+c)
months=sorted(df.m.unique())
COST=0.1
def wf(target,sub,shuffle=False,seed=0):
    d=sub.copy()
    if shuffle:
        r=np.random.default_rng(seed); d[target]=d.groupby(['d','T'])[target].transform(lambda s:r.permutation(s.values))
    out=[]
    for i in range(3,len(months)):
        tr=d[d.m<months[i]]; te=d[d.m==months[i]].copy()
        if len(te)==0: continue
        mdl=HGR(max_iter=150,learning_rate=0.04,max_leaf_nodes=15,min_samples_leaf=200,l2_regularization=1.0,random_state=seed)
        mdl.fit(tr[F],tr[target]); te['pr']=mdl.predict(te[F]); out.append(te)
    return pd.concat(out)
def stat(s,col):
    g=s[col]; bym=s.groupby('m')[col].sum(); top5=s.groupby('sym')[col].sum().sort_values(ascending=False).index[:5]
    eq=s.groupby('d')[col].mean().cumsum(); dd=(eq-eq.cummax()).min()
    return f"n={len(s):5d} ort={g.mean():+.3f} net={g.mean()-COST:+.3f} kaz%={(g>0).mean()*100:3.0f} artıAy={int((bym>0).sum())}/{len(bym)} top5hariç={g[~s.sym.isin(top5)].mean():+.3f} DD={dd:+.1f}"
if __name__=='__main__':
    tgt=sys.argv[1]
    sub=df[(df.rT>-7)&(df.rT<7)]
    sub=sub if tgt!='hold1' else sub[sub['T']>=1020]
    o=wf(tgt,sub); o.to_pickle(f'roosF_{tgt}.pkl')
    print('== hedef',tgt,'test',o.d.min(),o.d.max(),'tüm ort',round(o[tgt].mean(),3))
    for T in sorted(o['T'].unique()):
        x=o[o['T']==T]
        for k in [1,3]:
            s=x.sort_values('pr',ascending=False).groupby('d').head(k)
            print(f'T={T//60}:{T%60:02d} top{k}', stat(s,tgt))
    # günde tek işlem: ilk saat, tahmin > eşik
    for thr in [0.2,0.4,0.6,0.8]:
        s=o[o.pr>thr].sort_values(['d','T','pr'],ascending=[True,True,False]).groupby('d').head(1)
        print(f'günde 1 (ilk eşik>{thr})', stat(s,tgt))
    for rep in range(int(__import__('os').environ.get('REP','0'))):
        sh=wf(tgt,sub,True,rep); s=sh.sort_values('pr',ascending=False).groupby(['d','T']).head(1)
        print('ŞANS (karıştırılmış) top1 her saat', stat(s,tgt))
