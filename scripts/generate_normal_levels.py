"""Deterministic normal catalogue authoring; no guessing in the acceptance solver."""
import json, random
from pathlib import Path
R=random.Random(91428)
N=8
neighbors=[[j for j in range((N*N)) if abs(i//N-j//N)+abs(i%N-j%N)==1] for i in range((N*N))]
def conflict(a,b,regions):
 return a//N==b//N or a%N==b%N or regions[a]==regions[b] or max(abs(a//N-b//N),abs(a%N-b%N))<=1
def logic(regions):
 candidates=set(range((N*N))); placed=set(); rounds=0; deductions=0
 units=[set(range(r*N,r*N+N)) for r in range(N)]+[set(range(c,(N*N),N)) for c in range(N)]+[{i for i in range((N*N)) if regions[i]==r} for r in range(N)]
 while len(placed)<N:
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
 sol=list(range(N));R.shuffle(sol)
 if any(abs(sol[i]-sol[i+1])<=1 for i in range(N-1)):return
 reg=[-1]*(N*N)
 for r,c in enumerate(sol):reg[r*N+c]=r
 frozen=set()
 if kind=='single': frozen.add(R.randrange(N))
 else:
  for axis in (['v'] if kind=='vertical' else ['v','h'] if kind=='mixed' else []):
   r=R.randrange(N); anchor=r*N+sol[r]
   if r in frozen: return
   cells=[anchor]
   for _ in range(R.randint(1,3)):
    opts=[j for i in cells for j in neighbors[i] if reg[j] in (-1,r) and j not in cells and (j%N==sol[r] if axis=='v' else j//N==r)]
    if not opts:break
    j=R.choice(opts);reg[j]=r;cells.append(j)
   if len(cells)<2:return
   frozen.add(r)
 edges={(i,j) for i in range(N*N) if reg[i]==-1 for j in neighbors[i] if reg[j]>=0 and reg[j] not in frozen}
 while -1 in reg:
  opts=sorted(edges)
  if not opts:return
  i,j=R.choice(opts);r=reg[j];reg[i]=r
  edges={edge for edge in edges if edge[0]!=i}
  if r not in frozen:
   edges.update((j,i) for j in neighbors[i] if reg[j]==-1)
 groups=[[i for i in range((N*N)) if reg[i]==r] for r in range(N)]
 singles=sum(len(g)==1 for g in groups)
 v=sum(len(g)>1 and len({i%N for i in g})==1 for g in groups)
 h=sum(len(g)>1 and len({i//N for i in g})==1 for g in groups)
 if singles!=(1 if kind=='single' else 0):return
 if kind=='vertical' and not v:return
 if kind=='mixed' and not (v and h):return
 score=logic(reg)
 if score is None:return
 return reg,sol,score,v+h

path=Path('src/data/levels/generated-levels.json')
data=json.loads(path.read_text(encoding='utf-8'))
# Checked-in seed layouts were found by the growth generator above.
# Mutate region boundaries while preserving anchors, connectivity and deduction solvability.
seeds=json.loads(Path('scripts/normal-seeds.json').read_text(encoding='utf-8'))

def connected(regions, region):
 cells={i for i,r in enumerate(regions) if r==region}
 if len(cells)<2:return False
 seen={next(iter(cells))};front=list(seen)
 while front:
  for j in neighbors[front.pop()]:
   if j in cells and j not in seen:seen.add(j);front.append(j)
 return seen==cells

pool={tuple(x[0]):x for x in seeds}
for attempt in range(30000):
 parent=R.choice(list(pool.values()))
 regions=list(parent[0]);solution=parent[1]
 anchors={r*N+c for r,c in enumerate(solution)}
 for _ in range(R.randint(1,5)):
  i=R.randrange(N*N)
  if i in anchors:continue
  old=regions[i];target=regions[R.choice(neighbors[i])]
  if old==target:continue
  regions[i]=target
  if not connected(regions,old) or not connected(regions,target):regions[i]=old
 score=logic(regions)
 if score is not None:pool[tuple(regions)]=(regions,solution,score,0)
 if len(pool)>=4000:break

def shapes(result):
 groups=[[i for i,r in enumerate(result[0]) if r==region] for region in range(N)]
 return sum(len(g)>1 and len({i%N for i in g})==1 for g in groups),sum(len(g)>1 and len({i//N for i in g})==1 for g in groups)

ordered=sorted(pool.values(),key=lambda x:(x[2][1],x[2][0]))
chosen=[]
# Distinct solutions prevent near-identical boundary mutations becoming consecutive puzzles.
for stage, count, minimum in [('mixed',3,5),('vertical',3,7),('late',4,9)]:
 eligible=[x for x in ordered if (shapes(x)[0]>=1 and shapes(x)[1]>=1 if stage=='mixed' else shapes(x)[0]>=1 if stage=='vertical' else sum(shapes(x))<=2)]
 for _ in range(count):
  used_solutions={tuple(x[1]) for x in chosen}
  threshold=max(minimum,chosen[-1][2][1] if chosen else 0)
  match=next((x for x in eligible if tuple(x[1]) not in used_solutions and x[2][1]>=threshold),None)
  if match is None:raise RuntimeError(('Need more distinct candidates',stage,len(chosen)))
  chosen.append(match)
if len(chosen)!=10:raise RuntimeError('Insufficient progression candidates')
print('accepted',len(pool),'selected scores',[(x[2],shapes(x)) for x in chosen],flush=True)
for index,(regions,solution,score,strips) in enumerate(chosen):
 level=[level for level in data if level['difficulty']=='normal'][index]
 level.update(regions=regions,solution=solution,revision=2)
 # Separate adjacent colours using RGB distance over saturated display swatches.
 colors=['f4cf46','ee7d85','f4a34f','add35a','53c49d','66d5e7','6595e3','a28bdb','e378c4','a5b0bf']
 rgb=[tuple(int(c[i:i+2],16) for i in (0,2,4)) for c in colors]
 adj=[{regions[j] for i in range((N*N)) if regions[i]==r for j in neighbors[i] if regions[j]!=r} for r in range(N)]
 palette=[-1]*N;available=set(range(10))
 for r in sorted(range(N),key=lambda r:-len(adj[r])):
  assigned=[palette[n] for n in adj[r] if palette[n]>=0]
  color=max(available,key=lambda c:min((sum((a-b)**2 for a,b in zip(rgb[c],rgb[n])) for n in assigned),default=100000-c))
  palette[r]=color;available.remove(color)
 level['palette']=palette
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
