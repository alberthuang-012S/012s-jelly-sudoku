import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
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
const { layoutKey, layoutSimilarity, deductionOpening, openingLocation } = await import(pathToFileURL(resolve('src/game/diversity.ts')).href)
const seedPath = 'scripts/catalogue-seeds.json'
if (!existsSync(seedPath)) writeFileSync(seedPath, readFileSync('src/data/levels/generated-levels.json'))
const seeds = JSON.parse(readFileSync(seedPath, 'utf8'))
let randomState = 20261005
function random() { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296 }
const pick = (items) => items[Math.floor(random() * items.length)]
const pickFamily = (items) => {
  const families = [...new Set(items.map((x) => x.family))]
  const family = pick(families)
  return pick(items.filter((x) => x.family === family))
}
function shuffle(items) { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]] } return items }
function neighbors(i, n) { return [i - n, i + n, i - 1, i + 1].filter((j) => j >= 0 && j < n * n && Math.abs(Math.floor(i / n) - Math.floor(j / n)) + Math.abs(i % n - j % n) === 1) }
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
function rearrange(parent) {
  const n = parent.size
  const rows = Array.from({ length: n }, (_, i) => i), columns = [...rows]
  for (let move = 0; move < pick([1, 2, 3, 4]); move++) {
    const axis = random() < .5 ? rows : columns
    const first = Math.floor(random() * n), second = Math.max(0, Math.min(n - 1, first + pick([-3, -2, -1, 1, 2, 3])))
    ;[axis[first], axis[second]] = [axis[second], axis[first]]
  }
  const regions = Array(n * n), solution = Array(n)
  parent.regions.forEach((value, i) => { regions[rows[Math.floor(i / n)] * n + columns[i % n]] = value })
  parent.solution.forEach((c, r) => { solution[rows[r]] = columns[c] })
  if (solution.some((c, r) => r && Math.abs(c - solution[r - 1]) <= 1) || !areAllRegionsConnected(regions, n)) return null
  return { ...parent, regions, solution }
}
function randomSolution(n) {
  const result = [], remaining = new Set(Array.from({ length: n }, (_, i) => i))
  function visit() {
    if (!remaining.size) return true
    for (const column of shuffle([...remaining])) {
      if (result.length && Math.abs(column - result.at(-1)) <= 1) continue
      remaining.delete(column); result.push(column)
      if (visit()) return true
      remaining.add(column); result.pop()
    }
    return false
  }
  visit()
  return result
}
function grow(n, difficulty) {
  const solution = randomSolution(n), regions = Array(n * n).fill(-1)
  const frozen = new Set(), limits = new Map(), sizes = Array(n).fill(1)
  solution.forEach((c, r) => { regions[r * n + c] = r })
  const kind = pick(difficulty === 'basic' ? ['single', 'strip', 'shape', 'band', 'free'] : ['strip', 'shape', 'band', 'band', 'mixed'])
  if (kind === 'single') frozen.add(Math.floor(random() * n))
  if (kind === 'band' || kind === 'mixed') {
    const vertical = random() < .5, width = pick([2, 2, 3]), start = Math.floor(random() * (n - width + 1))
    const group = solution.flatMap((c, r) => (vertical ? c : r) >= start && (vertical ? c : r) < start + width ? [r] : [])
    for (const region of group) limits.set(region, (i) => (vertical ? i % n : Math.floor(i / n)) >= start && (vertical ? i % n : Math.floor(i / n)) < start + width)
  }
  if (kind === 'strip' || kind === 'shape' || kind === 'band' || kind === 'mixed') {
    for (const region of shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, difficulty === 'challenge' ? pick([7, 8, 9]) : pick([1, 1, 2, 3]))) {
      const anchor = region * n + solution[region]
      for (let placement = 0; placement < 12; placement++) {
      const templates = kind === 'strip' || kind === 'mixed' && !limits.has(region) ? [[[0, 0], [0, 1]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [0, 1], [0, 2], [0, 3]]] :
        [[[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [1, 0], [1, 1], [1, 2]]]
      const template = pick(templates), origin = pick(template), flip = random() < .5, turns = Math.floor(random() * 4)
      const cells = template.map(([r, c]) => {
        r -= origin[0]; c -= origin[1]
        if (flip) c = -c
        for (let t = 0; t < turns; t++) [r, c] = [c, -r]
        return [Math.floor(anchor / n) + r, anchor % n + c]
      })
      if (cells.some(([r, c]) => r < 0 || c < 0 || r >= n || c >= n || regions[r * n + c] !== -1 && regions[r * n + c] !== region || limits.has(region) && !limits.get(region)(r * n + c))) continue
      cells.forEach(([r, c]) => { regions[r * n + c] = region })
      sizes[region] = cells.length; frozen.add(region)
      break
      }
    }
  }
  // Alternate balanced and uneven growth, producing different region silhouettes.
  const balanced = random() < .5
  while (regions.includes(-1)) {
    const options = regions.flatMap((value, i) => value === -1 ? [...new Set(neighbors(i, n).map((j) => regions[j]))].filter((r) => r >= 0 && !frozen.has(r) && (!limits.has(r) || limits.get(r)(i))).map((r) => [i, r]) : [])
    if (!options.length) return null
    const choice = balanced ? pick(options.filter(([, r]) => sizes[r] <= Math.min(...options.map(([, r]) => sizes[r])) + 2)) : pick(options)
    const [i, region] = choice; regions[i] = region; sizes[region]++
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
const audit = { revision: 5, window: 10, maximumLayoutSimilarity: .85, modes: {} }
const cachePath = 'node_modules/.cache/jelly-catalogue-v5.json'
mkdirSync(dirname(cachePath), { recursive: true })
const cached = process.argv.includes('--reuse-pool') && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
const chapterRanks = {
  basic: [
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], [1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
    [1, 2, 2, 1, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 3, 2, 2, 3, 2, 2, 2, 3], [2, 3, 3, 2, 3, 3, 2, 3, 3, 3],
  ],
  normal: [
    [1, 1, 2, 2, 1, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 2, 2, 2, 3],
    [2, 2, 3, 2, 2, 2, 2, 3, 2, 2], [2, 2, 3, 2, 3, 2, 2, 3, 2, 2],
    [2, 3, 2, 3, 2, 2, 3, 2, 3, 2], [2, 3, 3, 2, 3, 2, 3, 2, 3, 2],
    [3, 2, 3, 3, 2, 3, 3, 2, 3, 2], [3, 3, 2, 3, 3, 2, 3, 3, 2, 3],
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  ],
  challenge: [
    [2, 2, 3, 2, 2, 3, 2, 3, 2, 3], [2, 2, 3, 2, 3, 2, 3, 2, 3, 3],
    [2, 3, 3, 2, 3, 3, 2, 3, 3, 3], [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 4], [3, 3, 3, 4, 3, 3, 3, 3, 3, 4],
    [3, 3, 4, 3, 3, 4, 3, 3, 3, 4], [3, 4, 3, 4, 3, 3, 4, 3, 3, 4],
    [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  ],
}
for (const [difficulty, n, maxRank] of [['basic', 6, 3], ['normal', 8, 3], ['challenge', 10, 4]]) {
  const pool = cached[difficulty] ?? [], seen = new Set(pool.map(layoutKey)), rejected = new Set()
  function accept(candidate, family) {
    if (!candidate) return
    const key = layoutKey(candidate)
    if (seen.has(key) || rejected.has(key)) return
    if (difficulty !== 'basic' && candidate.regions.some((r) => candidate.regions.filter((v) => v === r).length === 1)) { rejected.add(key); return }
    const proof = solveLogically(candidate, maxRank)
    if (!proof.solved || solveLevel(candidate, 2).solutionCount !== 1) { rejected.add(key); return }
    if (proof.placed.some((i) => candidate.solution[Math.floor(i / n)] !== i % n)) { rejected.add(key); return }
    seen.add(key)
    pool.push({ ...candidate, family: family ?? key, opening: deductionOpening(proof.steps), location: openingLocation(proof.steps, n), rating: { rank: proof.rank, score: proof.score, deductions: proof.deductions, steps: proof.rounds, techniques: [...new Set(proof.steps.map((s) => s.technique))] } })
  }
  if (existsSync('scripts/fresh-layout-seeds.json')) JSON.parse(readFileSync('scripts/fresh-layout-seeds.json', 'utf8')).filter((level) => level.difficulty === difficulty).forEach((level) => accept(level))
  if (!cached[difficulty]) {
    // Group old variants with the same answer as one family; they cannot dominate a chapter.
    seeds.filter((level) => level.difficulty === difficulty).forEach((level) => accept(level, `legacy-${level.solution.join(',')}`))
    if (difficulty === 'normal') JSON.parse(readFileSync('scripts/normal-seeds.json', 'utf8')).forEach(([regions, solution]) => accept({ difficulty, size: n, regions, solution }, `legacy-${solution.join(',')}`))
    for (let attempt = 0; attempt < 65000; attempt++) {
      const advanced = pool.filter((x) => x.rating.rank >= (difficulty === 'challenge' ? 3 : 2))
      const parent = pool.length ? pickFamily(advanced.length && random() < .7 ? advanced : pool) : undefined
      const fresh = attempt % 4 !== 3 || !parent
      accept(fresh ? grow(n, difficulty) : mutate(parent), fresh ? undefined : parent.family)
      if (attempt % 2000 === 0) console.log(difficulty, 'attempt', attempt, 'accepted', pool.length, 'ranks', pool.reduce((a, x) => (a[x.rating.rank] = (a[x.rating.rank] ?? 0) + 1, a), {}))
      const hard = pool.filter((x) => x.rating.rank === maxRank)
      if (pool.length >= (difficulty === 'basic' ? 1500 : difficulty === 'normal' ? 2200 : 3200) && hard.length >= (difficulty === 'challenge' ? 180 : 160) && new Set(hard.map((x) => x.solution.join(','))).size >= (difficulty === 'basic' ? 25 : 20) && (difficulty !== 'challenge' || new Set(hard.map((x) => x.family)).size >= 8)) break
    }
    cached[difficulty] = pool
    writeFileSync(cachePath, JSON.stringify(cached))
  }
  if (difficulty === 'challenge' && new Set(pool.filter((x) => x.rating.rank === 4).map((x) => x.family)).size < 8) {
    for (let attempt = 0; attempt < 65000; attempt++) {
      const advanced = pool.filter((x) => x.rating.rank >= 2 && !x.family.startsWith('legacy'))
      const hardest = advanced.filter((x) => x.rating.rank === 4)
      const parent = advanced.length ? pickFamily(hardest.length && random() < .4 ? hardest : advanced) : undefined
      const fresh = attempt % 3 !== 2 || !parent
      accept(fresh ? grow(n, difficulty) : mutate(parent), fresh ? undefined : parent.family)
      if (attempt % 2000 === 0) console.log(difficulty, 'fresh families', attempt, 'pool', pool.length, 'hard families', new Set(pool.filter((x) => x.rating.rank === 4).map((x) => x.family)).size)
      if (attempt % 5000 === 0) { cached[difficulty] = pool; writeFileSync(cachePath, JSON.stringify(cached)) }
      if (new Set(pool.filter((x) => x.rating.rank === 4).map((x) => x.family)).size >= 8 && new Set(pool.filter((x) => x.rating.rank === 3).map((x) => x.family)).size >= 16) break
    }
  }
  // Move whole rows/columns only when connectivity and every logical proof survive.
  // Unlike recolouring or symmetry, these produce different answers and region boundaries.
  for (let attempt = 0; attempt < 45000; attempt++) {
    const hard = pool.filter((x) => x.rating.rank === maxRank)
    const answers = new Set(hard.map((x) => x.solution.join(','))).size
    if (answers >= (difficulty === 'basic' ? 25 : 20) && hard.length >= (difficulty === 'challenge' ? 180 : 160)) break
    const parent = pickFamily(hard.length ? hard : pool)
    accept(rearrange(parent), parent.family)
    if (attempt % 3000 === 0) console.log(difficulty, 'new hard answers', answers, 'hard candidates', hard.length)
  }
  cached[difficulty] = pool
  writeFileSync(cachePath, JSON.stringify(cached))
  if (difficulty === 'challenge') for (const rank of [3, 4]) {
    for (let attempt = 0; attempt < 45000; attempt++) {
      const tier = pool.filter((x) => x.rating.rank === rank)
      const answers = new Set(tier.map((x) => x.solution.join(','))).size
      if (answers >= (rank === 3 ? 35 : 30)) break
      const parent = pickFamily(tier)
      accept(rearrange(parent), parent.family)
      if (attempt % 3000 === 0) console.log(difficulty, 'rank', rank, 'different answers', answers)
    }
    cached[difficulty] = pool
    writeFileSync(cachePath, JSON.stringify(cached))
  }
  if (pool.length < 100) throw new Error(`Only ${pool.length} usable ${difficulty} levels`)
  // Refresh classifications when the shared hint engine has changed.
  for (const candidate of pool) {
    const proof = solveLogically(candidate, maxRank)
    candidate.opening = deductionOpening(proof.steps)
    candidate.location = openingLocation(proof.steps, n)
    candidate.rating = { rank: proof.rank, score: proof.score, deductions: proof.deductions, steps: proof.rounds, techniques: [...new Set(proof.steps.map((s) => s.technique))] }
  }
  pool.sort((a, b) => a.rating.score - b.rating.score)
  const buckets = Array.from({ length: maxRank + 1 }, (_, rank) => pool.filter((x) => x.rating.rank === rank))
  const curriculum = difficulty === 'basic' ? { 13: 'pair', 15: 'triple' } : difficulty === 'normal' ? { 0: 'line', 1: 'reverse', 2: 'pair', 3: 'triple', 5: 'bend', 22: 'hall3' } : { 2: 'hall2', 5: 'hall2', 12: 'hall3', 29: 'hall3' }
  const reserved = Object.entries(curriculum).map(([slot, technique]) => {
    const options = pool.filter((x) => x.rating.rank === chapterRanks[difficulty].flat()[Number(slot)] && x.rating.techniques.includes(technique))
    const answers = new Set(options.map((x) => x.solution.join(',')))
    return { slot: Number(slot), answers: answers.size < 10 ? answers : new Set() }
  })
  const similarityCache = new Map()
  function similarity(a, b) {
    const key = [pool.indexOf(a), pool.indexOf(b)].sort((x, y) => x - y).join(':')
    if (!similarityCache.has(key)) similarityCache.set(key, layoutSimilarity(a, b))
    return similarityCache.get(key)
  }
  let selected = []
  const rankTotals = chapterRanks[difficulty].flat().reduce((a, rank) => (a[rank] = (a[rank] ?? 0) + 1, a), {})
  for (let pass = 0; pass < 60; pass++) {
    selected = []
    const used = new Set(), rankCounts = {}
    for (let slot = 0; slot < 100; slot++) {
      const chapter = Math.floor(slot / 10), rank = chapterRanks[difficulty][chapter][slot % 10], bucket = buckets[rank]
      const recent = selected.slice(-10), previous = selected.at(-1)
      const ideal = Math.floor((rankCounts[rank] ?? 0) * (bucket.length - 1) / Math.max(1, rankTotals[rank] - 1))
      const eligible = bucket.flatMap((x, i) => {
        if (curriculum[slot] && !x.rating.techniques.includes(curriculum[slot])) return []
        if (reserved.some((future) => future.slot > slot && future.slot - slot <= 10 && future.answers.has(x.solution.join(',')))) return []
        if (used.has(x) || recent.some((p) => p.solution.join(',') === x.solution.join(',')) || recent.filter((p) => p.family === x.family).length >= 2) return []
        if (previous && previous.opening === x.opening && x.opening !== 'single-only') return []
        if (x.opening !== 'single-only' && recent.filter((p) => p.opening === x.opening).length >= 3) return []
        if (previous?.location === x.location) return []
        if (chapter === 0 && difficulty === 'basic' && rank === 1 && x.rating.deductions > 4) return []
        const novelty = recent.filter((p) => p.opening === x.opening).length * 18 + recent.filter((p) => p.location === x.location).length * 8
        return [{ x, priority: Math.abs(i - ideal) / Math.max(1, bucket.length) * 80 + novelty + random() * (4 + pass) }]
      }).sort((a, b) => a.priority - b.priority)
      const choice = eligible.find(({ x }) => recent.every((p) => similarity(p, x) <= .85))?.x
      if (!choice) break
      selected.push(choice); used.add(choice); rankCounts[rank] = (rankCounts[rank] ?? 0) + 1
      }
    if (selected.length === 100) {
      const chapterScores = Array.from({ length: 10 }, (_, i) => selected.slice(i * 10, i * 10 + 10).reduce((sum, x) => sum + x.rating.score, 0) / 10)
      if (chapterScores.every((score, i) => !i || score > chapterScores[i - 1])) break
      console.log(difficulty, 'retry chapter ordering', pass, chapterScores)
      }
    else console.log(difficulty, 'selection retry', pass, 'stopped at', selected.length)
  }
  if (selected.length !== 100) throw new Error(`Unable to select 100 varied ${difficulty} puzzles`)
  const means = Array.from({ length: 10 }, (_, i) => selected.slice(i * 10, i * 10 + 10).reduce((sum, x) => sum + x.rating.score, 0) / 10)
  if (means.some((score, i) => i && score <= means[i - 1])) throw new Error(`Chapter difficulty did not increase for ${difficulty}`)
  let maximumSimilarity = 0
  selected.forEach((level, i) => {
    const { regions, solution, size, rating } = level
    selected.slice(Math.max(0, i - 10), i).forEach((previous) => { maximumSimilarity = Math.max(maximumSimilarity, similarity(previous, level)) })
    catalogue.push({ id: `${difficulty}-${String(i + 1).padStart(3, '0')}`, difficulty, size, regions, solution, palette: paletteFor(level), revision: 5, title: `${difficulty === 'basic' ? '基礎' : difficulty === 'normal' ? '普通' : '挑戰'} ${size}×${size} · ${String(i + 1).padStart(3, '0')}`, rating })
  })
  audit.modes[difficulty] = { maximumSimilarity, chapterScores: Array.from({ length: 10 }, (_, i) => selected.slice(i * 10, i * 10 + 10).reduce((sum, x) => sum + x.rating.score, 0) / 10), levels: selected.map((x, i) => ({ id: `${difficulty}-${String(i + 1).padStart(3, '0')}`, family: x.family, opening: x.opening, location: x.location })) }
  console.log('selected', difficulty, 'similarity', maximumSimilarity, 'chapter scores', audit.modes[difficulty].chapterScores)
}
writeFileSync('src/data/levels/generated-levels.json', JSON.stringify(catalogue, null, 2) + '\n')
writeFileSync('scripts/catalogue-audit.json', JSON.stringify(audit, null, 2) + '\n')
console.log('Saved', catalogue.length, 'unique, connected, logically solvable levels')
