import { registerHooks } from 'node:module'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL)
    if (existsSync(fileURLToPath(url))) return next(url.href, context)
  }
  return next(specifier, context)
} })
const { createLogicContext, initialLogicState, nextLogicStep, applyLogicStep, commonExclusions } = await import(pathToFileURL(resolve('src/game/logic.ts')).href)
const levels = JSON.parse(readFileSync('src/data/levels/generated-levels.json', 'utf8'))
const pools = Object.fromEntries(['line', 'pair', 'triple', 'bend', 'zigzag', 'hall2', 'hall3', 'reverse', 'combination'].map((t) => [t, []]))
function add(technique, level, state, sources, targets) {
  if (!targets.length) return
  const board = level.regions.map((_, i) => state.placed.has(i) ? 'jelly' : state.candidates.has(i) ? 'empty' : 'marked')
  targets.forEach((i) => { if (board[i] !== 'jelly') board[i] = 'empty' })
  const regionIds = [...new Set(sources.map((i) => level.regions[i]))]
  const groups = regionIds.map((r) => sources.filter((i) => level.regions[i] === r))
  // Every example starts from the visible, untouched board. Colour lessons
  // must use the entire region; reverse locking instead uses the entire row.
  if (board.some((cell) => cell !== 'empty') || (technique !== 'reverse' &&
    regionIds.some((r) => level.regions.filter((id) => id === r).length !== groups[regionIds.indexOf(r)].length))) return
  if (technique === 'hall2' || technique === 'hall3') {
    const context = createLogicContext(level)
    const arrangements = groups.reduce((poses, group) => poses.flatMap((pose) =>
      group.filter((i) => pose.every((a) => !context.conflicts[a].has(i))).map((i) => [...pose, i])), [[]])
    if (arrangements.length < 2) return
  }
  const scene = { level: { ...level, rating: undefined }, board, sources, targets, groups }
  // Prefer small actual boards and a small number of possibilities.
  scene.score = level.size * 1000 + sources.length * 5
  pools[technique].push(scene)
}
function scanFullRegions(level) {
  const n = level.size, context = createLogicContext(level), state = initialLogicState(context)
  const cells = [...state.candidates]
  const groups = Array.from({ length: n }, (_, r) => cells.filter((i) => level.regions[i] === r))
  const rows = (group) => new Set(group.map((i) => Math.floor(i / n)))
  const clashes = (a, b) => context.conflicts[a].has(b)
  for (const group of groups) {
    if (group.length !== 4) continue
    const rs = group.map((i) => Math.floor(i / n)), cs = group.map((i) => i % n)
    const h = Math.max(...rs) - Math.min(...rs), w = Math.max(...cs) - Math.min(...cs)
    if (!((h === 1 && w === 2) || (h === 2 && w === 1))) continue
    const coords = group.map((i) => [Math.floor(i / n) - Math.min(...rs), i % n - Math.min(...cs)])
    const z = h === 1 ? coords : coords.map(([r, c]) => [c, r])
    if (z.filter(([r]) => r === 0).length !== 2 || z.filter(([, c]) => c === 1).length !== 2 ||
      z.some(([r, c]) => c === 0 && z.some(([r2, c2]) => c2 === 2 && r2 === r))) continue
    const holes = cells.filter((i) => Math.floor(i / n) >= Math.min(...rs) && Math.floor(i / n) <= Math.max(...rs) &&
      i % n >= Math.min(...cs) && i % n <= Math.max(...cs) && !group.includes(i))
    if (holes.length === 2 && holes.every((i) => group.every((a) => clashes(a, i)))) add('zigzag', level, state, group, holes)
  }
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const first = groups[a], second = groups[b], source = [...first, ...second]
    const pairRows = rows(source)
    if (rows(first).size === 2 && rows(second).size === 2 && pairRows.size === 2) {
      add('hall2', level, state, source, cells.filter((i) => pairRows.has(Math.floor(i / n)) && !source.includes(i)))
    }
    if (first.length >= 2 && second.length >= 2 && source.length <= 18) {
      const targets = cells.filter((i) => !source.includes(i) && [first, second].every((g) => g.some((a) => !clashes(a, i))))
        .filter((i) => {
          const remaining = source.filter((a) => !clashes(a, i))
          return rows(remaining).size === 1 || new Set(remaining.map((a) => a % n)).size === 1
        })
      // Both colours must have a legal joint arrangement before the assumption.
      if (first.some((i) => second.some((j) => !clashes(i, j)))) add('combination', level, state, source, targets.slice(0, 2))
    }
    for (let c = b + 1; c < n; c++) {
      const selected = [first, second, groups[c]], source = selected.flat(), occupiedRows = rows(source)
      if (selected.every((g) => rows(g).size >= 2) && occupiedRows.size === 3) {
        add('hall3', level, state, source, cells.filter((i) => occupiedRows.has(Math.floor(i / n)) && !source.includes(i)))
      }
    }
  }
}
function addTransposed(technique, level, state, sources, targets) {
  const n = level.size, rotate = (i) => i % n * n + Math.floor(i / n)
  const regions = Array(n * n), solution = Array(n)
  level.regions.forEach((r, i) => { regions[rotate(i)] = r })
  level.solution.forEach((c, r) => { solution[c] = r })
  add(technique, { ...level, regions, solution }, {
    candidates: new Set([...state.candidates].map(rotate)), placed: new Set([...state.placed].map(rotate)),
  }, sources.map(rotate), targets.map(rotate))
}
for (const level of levels) {
  scanFullRegions(level)
  const n = level.size, context = createLogicContext(level), state = initialLogicState(context)
  for (let turn = 0; turn < n * n; turn++) {
    for (let region = 0; region < n; region++) {
      const sources = [...state.candidates].filter((i) => level.regions[i] === region)
      if (sources.length < 2 || sources.length > 4) continue
      const rows = sources.map((i) => Math.floor(i / n)), cols = sources.map((i) => i % n)
      const h = Math.max(...rows) - Math.min(...rows), w = Math.max(...cols) - Math.min(...cols)
      const questions = [...state.candidates].filter((i) => level.regions[i] !== region)
      const adjacent = questions.filter((i) => sources.every((a) => Math.max(Math.abs(Math.floor(i / n) - Math.floor(a / n)), Math.abs(i % n - a % n)) <= 1))
      if (sources.length === 2 && h + w === 1 && adjacent.length === 4) add('pair', level, state, sources, adjacent)
      if (sources.length === 3 && ((h === 2 && w === 0) || (h === 0 && w === 2)) && adjacent.length === 2) add('triple', level, state, sources, adjacent)
      if (sources.length === 3 && h === 1 && w === 1) {
        const targets = commonExclusions(context, sources, level.regions.flatMap((r, i) => r !== region && !state.placed.has(i) ? [i] : []))
        // Show all three geometric exclusions, including already proven ones,
        // while retaining every remaining possibility of the L-shaped colour.
        if (targets.length === 3) add('bend', level, state, sources, targets)
      }
    }
    const step = nextLogicStep(context, state)
    if (!step) break
    const regionIds = new Set(step.sources.map((i) => level.regions[i]))
    const rowIds = new Set(step.sources.map((i) => Math.floor(i / n)))
    const columnIds = new Set(step.sources.map((i) => i % n))
    if (step.technique === 'line' && rowIds.size === 1) add('line', level, state, step.sources, step.targets)
    else if (step.technique === 'reverse' && rowIds.size === 1) add('reverse', level, state, step.sources, step.targets)
    else if (step.technique === 'hall2' && regionIds.size === 2 && rowIds.size === 2) add('hall2', level, state, step.sources, step.targets)
    else if (step.technique === 'hall3' && regionIds.size === 3 && rowIds.size === 3) add('hall3', level, state, step.sources, step.targets)
    else if (step.technique === 'hall3' && regionIds.size === 3 && columnIds.size === 3) addTransposed('hall3', level, state, step.sources, step.targets)
    else if (step.technique === 'zigzag') {
      const rs = step.sources.map((i) => Math.floor(i / n)), cs = step.sources.map((i) => i % n)
      const holes = level.regions.flatMap((_, i) => Math.floor(i / n) >= Math.min(...rs) && Math.floor(i / n) <= Math.max(...rs) && i % n >= Math.min(...cs) && i % n <= Math.max(...cs) && !step.sources.includes(i) ? [i] : [])
      if (holes.length === 2 && holes.every((i) => level.regions[i] !== level.regions[step.sources[0]] && !state.placed.has(i))) add('zigzag', level, state, step.sources, holes)
    }
    else if (step.technique === 'combination') {
      const groups = [...regionIds].map((r) => step.sources.filter((i) => level.regions[i] === r))
      const clearContradiction = step.targets.every((target) => {
        const survivors = groups.map((group) => group.filter((i) => !context.conflicts[target].has(i)))
        const remaining = survivors.flat()
        return survivors.every((group) => group.length) && (new Set(remaining.map((i) => i % n)).size === 1 || new Set(remaining.map((i) => Math.floor(i / n))).size === 1)
      })
      if (clearContradiction) add('combination', level, state, step.sources, step.targets)
    }
    applyLogicStep(context, state, step)
    if (state.placed.size === n) break
  }
}
const scenes = {}
for (const [technique, pool] of Object.entries(pools)) {
  pool.sort((a, b) => a.score - b.score)
  const first = pool[0]
  const second = pool.find((s) => s.level.id !== first?.level.id)
  if (!first || !second) throw new Error(`Need two actual puzzles for ${technique}; found ${pool.length}`)
  scenes[technique] = [first, second].map(({ score, ...scene }) => scene)
  console.log(technique, pool.length, scenes[technique].map((s) => s.level.id))
}
writeFileSync('src/data/teaching-scenes.json', JSON.stringify(scenes, null, 2) + '\n')
