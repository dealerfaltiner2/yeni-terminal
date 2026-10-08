import sys
A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
F=[('gap',-10,10),('r30',-10,10),('vr30',0,6.2),('d1',-10,10),('d5',-25,40),('d20',-40,100),('dist',-50,0),('sq',0,3.1),('vt',0,4),('above',0,1),('i30',-3,3),('rng30',0,15),('adr',0,15),('wd',0,6),('rest',-10,10),('mae',-10.5,0)]
def q(e,lo,hi):
    return f"substr(al.a,(CASE WHEN {e} IS NULL THEN 63 ELSE CAST(round((max({lo},min({hi},{e}))-({lo}))*62.0/({hi}-({lo}))) AS INT) END)+1,1)"
def row():
    parts=["substr(al.a,(s.si/64)+1,1)","substr(al.a,(s.si%64)+1,1)"]+[q('s.'+c,lo,hi) for c,lo,hi in F]
    parts.append("substr(al.a,coalesce(s.o10,3)*16+coalesce(s.o15,3)*4+coalesce(s.o20,3)+1,1)")
    return "||".join(parts)
def head():
    return "||".join([q('m.md20',-20,20),q('m.md5',-10,10),q('m.mr30',-3,3),q('m.up',0,1)])
def sql(off,lim):
    return (f"WITH al(a) AS (SELECT '{A}'), sy AS (SELECT sym, ROW_NUMBER() OVER (ORDER BY sym)-1 si FROM (SELECT DISTINCT sym FROM feat)), "
            f"m AS (SELECT d, avg(d20) md20, avg(d5) md5, avg(r30) mr30, avg(r30>0) up FROM feat WHERE adr>0 GROUP BY d), "
            f"dd AS (SELECT d FROM m ORDER BY d LIMIT {lim} OFFSET {off}), "
            f"s AS (SELECT f.*, sy.si FROM feat f JOIN sy USING(sym) WHERE f.adr>=4 AND f.rest IS NOT NULL AND f.d IN (SELECT d FROM dd)) "
            f"SELECT group_concat(x,';') s FROM (SELECT m.d||'|'||{head()}||'|'||coalesce((SELECT group_concat({row()},'') FROM s, al WHERE s.d=m.d),'') x FROM m, al WHERE m.d IN (SELECT d FROM dd) ORDER BY m.d)")
if __name__=='__main__': print(sql(int(sys.argv[1]),int(sys.argv[2])))
