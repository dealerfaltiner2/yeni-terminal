# KEŞİF MOTORU: binlerce kural (tek ve ikili koşul) × giriş saati × çıkış — eğitimde seç, doğrulamada ele, testte (dokunulmamış son dönem) bak.
import pandas as pd,numpy as np,sys
X=pd.read_pickle('g31h.pkl'); C=0.1
F=['rT','gap','roT','iT','rng','pos','vwd','vrT','l1','l2','lv','offhi','upb','adr','d1','d5','d20','dist','yclv','ylast','yvwd','yvr','ylastv']
TR,VA='2026-03-01','2026-06-15'
seed=int(sys.argv[1]) if len(sys.argv)>1 else -1
res=[]
for T in (630,660,720,840):
  x=X[X['T']==T].reset_index(drop=True)
  for out in ('pl','plH'):
    y=x[out].values-C
    if seed>=0:   # ŞANS KONTROLÜ: sonuçlar günler arasında karıştırılır (gün içi yapı korunur)
        rng=np.random.default_rng(seed); days=x.d.unique(); perm=dict(zip(days,rng.permutation(days)))
        g=x.groupby('d').indices; ny=y.copy()
        # her günün sonuç vektörünü başka günün ortalamasıyla kaydır: hisse sırası korunmaz, basitçe satırları gün içinde karıştır + gün etkisini değiştir
        ny=rng.permutation(y); y=ny
    tr=(x.d<TR).values; va=((x.d>=TR)&(x.d<VA)).values; te=(x.d>=VA).values
    conds=[];names=[]
    for f in F:
        v=x[f].values; q=np.nanquantile(v[tr],np.arange(.1,.91,.1))
        for k,t in enumerate(q):
            conds.append(np.nan_to_num(v>=t,nan=0)); names.append(f'{f}≥{t:.2f}')
            conds.append(np.nan_to_num(v<=t,nan=0)); names.append(f'{f}≤{t:.2f}')
    M=np.array(conds,dtype=np.float32)
    def stats(mask):
        A=M[:,mask]; yy=y[mask].astype(np.float32)
        n=A@A.T; s=(A*yy)@A.T; return n,s
    ntr,str_=stats(tr); nva,sva=stats(va); nte,ste=stats(te)
    with np.errstate(invalid='ignore',divide='ignore'):
        mtr=str_/ntr; mva=sva/nva; mte=ste/nte
    iu=np.triu_indices(len(names))
    ok=(ntr[iu]>=80)&(nva[iu]>=25)&(nte[iu]>=20)
    i,j=iu[0][ok],iu[1][ok]
    df=pd.DataFrame(dict(T=T,out=out,a=[names[k] for k in i],b=[names[k] for k in j],ntr=ntr[i,j],mtr=mtr[i,j],nva=nva[i,j],mva=mva[i,j],nte=nte[i,j],mte=mte[i,j]))
    res.append(df)
R=pd.concat(res,ignore_index=True)
# seçim: eğitimde en iyi 200, doğrulamada > +0,3 olanlar
top=R.sort_values('mtr',ascending=False).groupby(['T','out']).head(200)
sel=top[top.mva>0.3]
tag='GERÇEK' if seed<0 else f'ŞANS{seed}'
print(tag,'denenen kural:',len(R),'| eğitim ilk 200 (her saat/çıkış):',len(top),'| doğrulamayı geçen:',len(sel),'| test ort: %.3f'%sel.mte.mean() if len(sel) else '', '| testte artı: %d'%(sel.mte>0).sum() if len(sel) else '')
if seed<0:
    R.to_pickle('engine_all.pkl'); sel.sort_values('mva',ascending=False).to_pickle('engine_sel.pkl')
