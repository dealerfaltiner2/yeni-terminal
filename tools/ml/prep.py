import pickle,numpy as np
D=pickle.load(open('../ml/bars.pkl','rb'))
def split(b):
    a=np.array(b,float); loc=a[:,0]+3*3600; d=(loc//86400).astype(int); t=((loc%86400)//60).astype(int)
    out=[]
    for k in np.unique(d):
        m=d==k
        if m.sum()<30: continue
        out.append((k,t[m],a[m]))
    return out
S={}
for s in D:
    if not s.endswith('@15'): continue
    S[s[:-3]]=split(D[s])
pickle.dump(S,open('S.pkl','wb'))
print(len(S), len(S['XU100']))
