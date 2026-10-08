import glob
V={}
for t in open('ver.txt').read().strip().split(','):
    d,l,h=t.split(':'); V[d]=(int(l),h)
got={}
for f in sorted(glob.glob('c*.txt')):
    for day in open(f).read().strip().split(';'):
        d,h,x=day.split('|'); got[d]=(len(x),h)
bad=[d for d in got if got[d]!=V.get(d)]
print('gün',len(got),'/',len(V),'hatalı',bad[:10])
S={t.split(':')[0]:int(t.split(':')[1]) for t in open('sum.txt').read().strip().split(',')}
def cs(x): return sum(ord(c)*((i+1)%7+1) for i,c in enumerate(x))
X={}
for f in sorted(glob.glob('c*.txt')):
    for day in open(f).read().strip().split(';'):
        d,h,x=day.split('|'); X[d]=x
bad2=[d for d in X if cs(X[d])!=S[d]]
print('checksum hatalı',bad2)
