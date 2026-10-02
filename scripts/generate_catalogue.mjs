import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'

// Node 24 runs the exact TypeScript game engine; authoring and hints share deduction rules.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL)
    if (existsSync(fileURLToPath(url))) return next(url.href, context)
  }
  return next(specifier, context)
} })
const { solveLogically } = await import(pathToFileURL(resolve('src/game/logic.ts')).href)
const { solveLevel } = await import(pathToFileURL(resolve('src/game/solver.ts')).href)
const { areAllRegionsConnected } = await import(pathToFileURL(resolve('src/game/regions.ts')).href)
const seedPath = 'scripts/catalogue-seeds.json'
if (!existsSync(seedPath)) writeFileSync(seedPath, readFileSync('src/data/levels/generated-levels.json'))
const seeds = JSON.parse(readFileSync(seedPath, 'utf8'))
let randomState = 20261001
function random() { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296 }
const pick = (items) => items[Math.floor(random() * items.length)]
function shuffle(items) { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]] } return items }
function neighbors(i, n) { return [i - n, i + n, i - 1, i + 1].filter((j) => j >= 0 && j < n * n && Math.abs(Math.floor(i / n) - Math.floor(j / n)) + Math.abs(i % n - j % n) === 1) }
function canonical(regions, n) {
  const variants = []
  for (let flip = 0; flip < 2; flip++) for (let turn = 0; turn < 4; turn++) {
    const grid = Array(n * n)
    regions.forEach((value, i) => {
      let r = Math.floor(i / n), c = i % n
      if (flip) c = n - 1 - c
      for (let t = 0; t < turn; t++) [r, c] = [c, n - 1 - r]
      grid[r * n + c] = value
    })
    const ids = new Map()
    variants.push(grid.map((value) => { if (!ids.has(value)) ids.set(value, ids.size); return ids.get(value) }).join(','))
  }
  return variants.sort()[0]
}
function mutate(parent) {
  const { size: n, solution } = parent
  const regions = [...parent.regions]
  const anchors = new Set(solution.map((c, r) => r * n + c))
  for (let step = 0; step < 2 + Math.floor(random() * 12); step++) {
    const i = Math.floor(random() * regions.length)
    if (anchors.has(i)) continue
    const old = regions[i], next = regions[pick(neighbors(i, n))]
    if (old === next) continue
    regions[i] = next
    if (!areAllRegionsConnected(regions, n)) regions[i] = old
  }
  return { ...parent, regions }
}
function grow(n, difficulty, kind) {
  const solution = shuffle(Array.from({ length: n }, (_, i) => i))
  if (solution.some((c, r) => r && Math.abs(c - solution[r - 1]) <= 1)) return null
  const regions = Array(n * n).fill(-1), frozen = new Set()
  solution.forEach((c, r) => { regions[r * n + c] = r })
  if (kind === 'single') frozen.add(Math.floor(random() * n))
  if (kind === 'strip' || kind === 'mixed') {
    for (const vertical of kind === 'mixed' ? [true, false] : [random() < .5]) {
      const region = Math.floor(random() * n), anchor = region * n + solution[region]
      if (frozen.has(region)) return null
      const strip = [anchor]
      for (let k = 0; k < 1 + Math.floor(random() * 3); k++) {
        const options = strip.flatMap((i) => neighbors(i, n)).filter((i) => regions[i] === -1 && (vertical ? i % n === anchor % n : Math.floor(i / n) === region))
        if (!options.length) break
        const i = pick(options); regions[i] = region; strip.push(i)
      }
      if (strip.length === 1) return null
      frozen.add(region)
    }
  }
  while (regions.includes(-1)) {
    const options = regions.flatMap((value, i) => value === -1 ? neighbors(i, n).filter((j) => regions[j] >= 0 && !frozen.has(regions[j])).map((j) => [i, regions[j]]) : [])
    if (!options.length) return null
    const [i, region] = pick(options); regions[i] = region
  }
  return { size: n, difficulty, regions, solution }
}
const colours = ['f4cf46', 'ee7d85', 'f4a34f', 'add35a', '53c49d', '66d5e7', '6595e3', 'a28bdb', 'e378c4', 'a5b0bf'].map((hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)))
function paletteFor(level) {
  const n = level.size
  const adjacency = Array.from({ length: n }, (_, r) => new Set(level.regions.flatMap((v, i) => v === r ? neighbors(i, n).map((j) => level.regions[j]).filter((v) => v !== r) : [])))
  const palette = Array(n).fill(-1), available = new Set(colours.map((_, i) => i))
  for (const r of Array.from({ length: n }, (_, r) => r).sort((a, b) => adjacency[b].size - adjacency[a].size || a - b)) {
    const assigned = [...adjacency[r]].map((r) => palette[r]).filter((c) => c >= 0)
    const score = (c) => Math.min(...assigned.map((other) => colours[c].reduce((sum, v, i) => sum + (v - colours[other][i]) ** 2, 0)), 100000 - c)
    palette[r] = [...available].sort((a, b) => score(b) - score(a) || a - b)[0]
    available.delete(palette[r])
  }
  return palette
}
const catalogue = []
for (const [difficulty, n, maxRank] of [['basic', 6, 3], ['normal', 8, 3], ['challenge', 10, 4]]) {
  const pool = [], seen = new Set(), rejected = new Set()
  function accept(candidate) {
    if (!candidate) return
    const key = canonical(candidate.regions, n)
    if (seen.has(key) || rejected.has(key)) return
    if (difficulty !== 'basic' && candidate.regions.some((r) => candidate.regions.filter((v) => v === r).length === 1)) { rejected.add(key); return }
    const proof = solveLogically(candidate, maxRank)
    if (!proof.solved || solveLevel(candidate, 2).solutionCount !== 1) { rejected.add(key); return }
    seen.add(key)
    pool.push({ ...candidate, rating: { rank: proof.rank, score: proof.score, deductions: proof.deductions, steps: proof.rounds, techniques: [...new Set(proof.steps.map((s) => s.technique))] } })
  }
  seeds.filter((level) => level.difficulty === difficulty).forEach(accept)
  // The prior normal seed bank provides unrelated layouts and different solution anchors.
  if (difficulty === 'normal') JSON.parse(readFileSync('scripts/normal-seeds.json', 'utf8')).forEach(([regions, solution]) => accept({ difficulty, size: n, regions, solution }))
  for (let attempt = 0; attempt < 14000; attempt++) {
    const fresh = attempt % 4 === 0 || pool.length === 0
    accept(fresh ? grow(n, difficulty, difficulty === 'basic' ? pick(['single', 'strip', 'mixed', 'free']) : pick(['strip', 'mixed', 'free'])) : mutate(pick(pool)))
    if (attempt % 1000 === 0) console.log(difficulty, 'attempt', attempt, 'accepted', pool.length, 'ranks', pool.reduce((a, x) => (a[x.rating.rank] = (a[x.rating.rank] ?? 0) + 1, a), {}))
    if (pool.length >= (difficulty === 'challenge' ? 2000 : 650) && (difficulty !== 'challenge' || pool.filter((x) => x.rating.rank === 4).length >= 160)) break
  }
  if (pool.length < 100) throw new Error(`Only ${pool.length} usable ${difficulty} levels`)
  pool.sort((a, b) => a.rating.score - b.rating.score)
  const similar = (a, b) => a && a.solution.join(',') === b.solution.join(',') &&
    a.regions.reduce((sum, r, i) => sum + Number(r !== b.regions[i]), 0) < n * n * .12
  const buckets = Array.from({ length: maxRank + 1 }, (_, rank) => pool.filter((x) => x.rating.rank === rank))
  // Longest increasing paths preserve rating order while leaving space to avoid similar neighbours.
  const lengths = buckets.map((bucket) => {
    const result = Array(bucket.length).fill(1)
    for (let i = bucket.length - 1; i >= 0; i--) for (let j = i + 1; j < bucket.length; j++) {
      if (!similar(bucket[i], bucket[j])) result[i] = Math.max(result[i], 1 + result[j])
    }
    return result
  })
  const quotas = difficulty === 'basic' ? [20, 20, 50, 10, 0] : difficulty === 'normal' ? [0, 20, 55, 25, 0] : [0, 5, 25, 50, 20]
  let selected = []
  for (let pass = 0; pass < 100; pass++) {
    selected = []
    for (let rank = 0; rank <= maxRank; rank++) {
      const bucket = buckets[rank], paths = lengths[rank]
      const starters = bucket.map((x, i) => !similar(selected.at(-1), x) ? paths[i] : 0)
      const count = Math.min(quotas[rank], Math.max(0, ...starters))
      let lastIndex = -1
      for (let i = 0; i < count; i++) {
        const ideal = Math.floor(i * (bucket.length - 1) / Math.max(1, count - 1))
        const eligible = bucket.map((x, j) => j > lastIndex && paths[j] >= count - i && !similar(selected.at(-1), x) ? j : -1).filter((j) => j >= 0)
        const index = eligible.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b)[0]
        if (index === undefined) throw new Error('Difficulty path exhausted')
        selected.push(bucket[index]); lastIndex = index
      }
    }
    if (selected.length === 100) break
    quotas[2] += 100 - selected.length
  }
  if (selected.length !== 100 || selected.some((x, i) => i && similar(selected[i - 1], x))) throw new Error('Unable to select 100 varied puzzles')
  if (difficulty === 'challenge' && selected.filter((x) => x.rating.rank === 4).length < 20) throw new Error('Need more varied advanced candidates')
  selected.forEach((level, i) => {
    const { regions, solution, size, rating } = level
    catalogue.push({ id: `${difficulty}-${String(i + 1).padStart(3, '0')}`, difficulty, size, regions, solution, palette: paletteFor(level), revision: 4, title: `${difficulty === 'basic' ? '基礎' : difficulty === 'normal' ? '普通' : '挑戰'} ${size}×${size} · ${String(i + 1).padStart(3, '0')}`, rating })
  })
  console.log('selected', difficulty, selected.reduce((a, x) => (a[x.rating.rank] = (a[x.rating.rank] ?? 0) + 1, a), {}), 'score range', selected[0].rating.score, selected[99].rating.score)
}
writeFileSync('src/data/levels/generated-levels.json', JSON.stringify(catalogue, null, 2) + '\n')
console.log('Saved', catalogue.length, 'unique, connected, logically solvable levels')
