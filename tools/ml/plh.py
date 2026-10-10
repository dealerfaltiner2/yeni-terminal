import pickle,numpy as np,pandas as pd
D=pickle.load(open('bars.pkl','rb')); X=pd.read_pickle('g31.pkl')
idx={}
for s in [k for k in D if k.endswith('@15') and not k.startswith('XU')]:
    a=np.array(D[s],float); loc=a[:,0]+3*3600; idx[s[:-3]]=(a,(loc//86400).astype(int),((loc%86400)//60).astype(int))
out=np.empty(len(X))
for n,r in enumerate(X[['sym','day','T']].itertuples(index=False)):
    a,d,tod=idx[r.sym]; m0=np.where((d==r.day)&(tod<r.T))[0]; j=m0[-1]; px=a[j,4]
    seg=a[j+1:]; seg=seg[d[j+1:]==r.day]; sl=px*0.99; p=None
    for b in seg:
        if b[3]<=sl: p=(min(sl,b[1])/px-1)*100; break
    out[n]=p if p is not None else ((seg[-1,4]/px-1)*100 if len(seg) else 0)
X['plH']=out; X.to_pickle('g31h.pkl'); print(X.groupby('T')[['pl','plH']].mean().round(3))
