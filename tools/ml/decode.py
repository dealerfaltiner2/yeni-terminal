import glob, numpy as np, pandas as pd
A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
I={c:i for i,c in enumerate(A)}
SY="AEFES,AKBNK,AKSA,AKSEN,ALARK,ALTNY,ANSGR,ARCLK,ASELS,ASTOR,BALSU,BERA,BIMAS,BRSAN,BRYAT,BSOKE,BTCIM,CANTE,CCOLA,CIMSA,CVKMD,CWENE,DAPGM,DOAS,DOHOL,DSTKF,ECILC,EFOR,EKGYO,ENERY,ENJSA,ENKAI,EREGL,ESEN,EUPWR,EUREN,FENER,FROTO,GARAN,GENIL,GESAN,GLRMK,GRSEL,GRTHO,GSRAY,GUBRF,HALKB,HEKTS,IEYHO,ISCTR,ISMEN,IZENR,KCHOL,KLRHO,KRDMD,KTLEV,KUYAS,MAGEN,MAVI,MGROS,MIATK,MPARK,OBAMS,ODAS,ODINE,OTKAR,OYAKC,PAHOL,PASEU,PATEK,PETKM,PGSUS,PSGYO,QUAGR,RALYH,REEDR,SAHOL,SARKY,SASA,SISE,SKBNK,SOKM,TAVHL,TCELL,THYAO,TKFEN,TOASO,TRALT,TRENJ,TRMET,TSKB,TTKOM,TUKAS,TUPRS,TURSG,ULKER,VAKBN,VESTL,YKBNK,ZOREN".split(',')
F=[('gap',-10,10),('r30',-10,10),('vr30',0,6.2),('d1',-10,10),('d5',-25,40),('d20',-40,100),('dist',-50,0),('sq',0,3.1),('vt',0,4),('above',0,1),('i30',-3,3),('rng30',0,15),('adr',0,15),('wd',0,6),('rest',-10,10),('mae',-10.5,0)]
H=[('md20',-20,20),('md5',-10,10),('mr30',-3,3),('up',0,1)]
def dq(c,lo,hi):
    q=I[c]; return np.nan if q==63 else lo+q*(hi-lo)/62
rows=[]
for f in sorted(glob.glob('c[0-9].txt')):
    for day in open(f).read().strip().split(';'):
        d,h,x=day.split('|')
        hv={n:dq(h[i],lo,hi) for i,(n,lo,hi) in enumerate(H)}
        for k in range(0,len(x),19):
            r=x[k:k+19]; si=I[r[0]]*64+I[r[1]]
            rec={'d':d,'sym':SY[si],**hv}
            for j,(n,lo,hi) in enumerate(F): rec[n]=dq(r[2+j],lo,hi)
            o=I[r[18]]; rec['o10']=o//16; rec['o15']=(o//4)%4; rec['o20']=o%4
            rows.append(rec)
df=pd.DataFrame(rows)
for c in ['o10','o15','o20']: df.loc[df[c]==3,c]=np.nan
df.to_pickle('feat.pkl'); print(df.shape, df.d.nunique(), df.sym.nunique()); print(df.describe().T[['mean','min','max']].round(2))
