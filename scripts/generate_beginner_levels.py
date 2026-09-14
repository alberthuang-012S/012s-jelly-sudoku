"""Deterministic beginner catalogue authoring; no guessing in the acceptance solver."""
import json, random
from pathlib import Path
R=random.Random(91426)
N=6
neighbors=[[j for j in range(36) if abs(i//6-j//6)+abs(i%6-j%6)==1] for i in range(36)]
def conflict(a,b,regions):
 return a//6==b//6 or a%6==b%6 or regions[a]==regions[b] or max(abs(a//6-b//6),abs(a%6-b%6))<=1
def logic(regions):
 candidates=set(range(36)); placed=set(); rounds=0; deductions=0
 units=[set(range(r*6,r*6+6)) for r in range(6)]+[set(range(c,36,6)) for c in range(6)]+[{i for i in range(36) if regions[i]==r} for r in range(6)]
 while len(placed)<6:
  rounds+=1; changed=False
  for unit in units:
   if unit&placed: continue
   choices=unit&candidates
   if not choices:return None
   if len(choices)==1:
    a=next(iter(choices));placed.add(a)
    candidates={b for b in candidates if not conflict(a,b,regions)}
    changed=True
   else:
    removed={b for b in candidates-unit if all(conflict(a,b,regions) for a in choices)}
    if removed:
     candidates-=removed; deductions+=1;changed=True
  if not changed:return None
 return rounds,deductions

def generate(kind):
 sol=list(range(6));R.shuffle(sol)
 if any(abs(sol[i]-sol[i+1])<=1 for i in range(5)):return
 reg=[-1]*36
 for r,c in enumerate(sol):reg[r*6+c]=r
 frozen=set()
 if kind=='single': frozen.add(R.randrange(6))
 else:
  for axis in (['v'] if kind=='vertical' else ['v','h'] if kind=='mixed' else []):
   r=R.randrange(6); anchor=r*6+sol[r]
   if r in frozen: return
   cells=[anchor]
   for _ in range(R.randint(1,3)):
    opts=[j for i in cells for j in neighbors[i] if reg[j] in (-1,r) and j not in cells and (j%6==sol[r] if axis=='v' else j//6==r)]
    if not opts:break
    j=R.choice(opts);reg[j]=r;cells.append(j)
   if len(cells)<2:return
   frozen.add(r)
 while -1 in reg:
  opts=[(i,reg[j]) for i in range(36) if reg[i]==-1 for j in neighbors[i] if reg[j]>=0 and reg[j] not in frozen]
  if not opts:return
  i,r=R.choice(opts);reg[i]=r
 groups=[[i for i in range(36) if reg[i]==r] for r in range(6)]
 singles=sum(len(g)==1 for g in groups)
 v=sum(len(g)>1 and len({i%6 for i in g})==1 for g in groups)
 h=sum(len(g)>1 and len({i//6 for i in g})==1 for g in groups)
 if singles!=(1 if kind=='single' else 0):return
 if kind=='vertical' and not v:return
 if kind=='mixed' and not (v and h):return
 score=logic(reg)
 if score is None:return
 return reg,sol,score,v+h

path=Path('src/data/levels/generated-levels.json')
data=json.loads(path.read_text(encoding='utf-8'))
used=set(); chosen=[]
for kind,count in [('single',3),('vertical',2),('mixed',2),('late',3)]:
 pool=[]
 for attempt in range(150000):
  result=generate(kind)
  if result and tuple(result[0]) not in used:
   used.add(tuple(result[0]));pool.append(result)
  if len(pool)>=30:break
 if len(pool)<count:raise RuntimeError((kind,len(pool)))
 pool.sort(key=lambda x:(x[2][1],x[2][0]))
 selected=pool[:count] if kind!='late' else pool[-count:]
 chosen+=selected
 print(kind,'attempts',attempt,'scores',[(x[2],x[3]) for x in selected],flush=True)
for index,(regions,solution,score,strips) in enumerate(chosen):
 level=data[index]
 level.update(regions=regions,solution=solution,revision=2)
 # Separate adjacent colours using RGB distance over saturated display swatches.
 colors=['f4cf46','ee7d85','f4a34f','add35a','53c49d','66d5e7','6595e3','a28bdb','e378c4','a5b0bf']
 rgb=[tuple(int(c[i:i+2],16) for i in (0,2,4)) for c in colors]
 adj=[{regions[j] for i in range(36) if regions[i]==r for j in neighbors[i] if regions[j]!=r} for r in range(6)]
 palette=[-1]*6;available=set(range(10))
 for r in sorted(range(6),key=lambda r:-len(adj[r])):
  assigned=[palette[n] for n in adj[r] if palette[n]>=0]
  color=max(available,key=lambda c:min((sum((a-b)**2 for a,b in zip(rgb[c],rgb[n])) for n in assigned),default=100000-c))
  palette[r]=color;available.remove(color)
 level['palette']=palette
# Preserve the requested swap of the first two authored puzzles.
first=next(level for level in data if level['id']=='basic-001')
second=next(level for level in data if level['id']=='basic-002')
for key in ('regions','solution','palette'):
 first[key],second[key]=second[key],first[key]
first['revision']=second['revision']=3
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
