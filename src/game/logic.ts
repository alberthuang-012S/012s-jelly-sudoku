import type { CellState, Level } from '../types/game'
import { REGION_PALETTE } from '../config/regionPalette'

export type Technique = 'single' | 'placed' | 'line' | 'reverse' | 'pair' | 'triple' | 'bend' | 'zigzag' | 'common' | 'hall2' | 'hall3' | 'combination'
export const TECHNIQUES: Record<Technique, { name: string; rank: number }> = {
  single: { name: '唯一位置', rank: 0 }, placed: { name: '水母周圍排除', rank: 0 },
  line: { name: '顏色一直線', rank: 1 }, reverse: { name: '橫排／直列反向鎖定', rank: 1 },
  pair: { name: '相鄰兩格', rank: 2 }, triple: { name: '三格直線', rank: 2 },
  bend: { name: 'L 形轉彎', rank: 2 }, zigzag: { name: 'Z 形缺角', rank: 2 }, common: { name: '共同禁區', rank: 2 },
  hall2: { name: '雙色雙排／雙列', rank: 3 }, hall3: { name: '三色三排／三列', rank: 3 },
  combination: { name: '兩區組合排除', rank: 4 },
}
export interface LogicStep {
  technique: Technique
  action: 'place' | 'exclude'
  sources: number[]
  targets: number[]
  observation: string
  reason: string
}
interface Unit { kind: 'row' | 'column' | 'region'; id: number; cells: number[] }
export interface LogicContext { level: Level; units: Unit[]; conflicts: Set<number>[] }
export interface LogicState { candidates: Set<number>; placed: Set<number> }

export function createLogicContext(level: Level): LogicContext {
  const n = level.size
  const cells = level.regions.map((_, i) => i)
  return {
    level,
    units: ['row', 'column', 'region'].flatMap((kind) => Array.from({ length: n }, (_, id) => ({
      kind: kind as Unit['kind'], id,
      cells: cells.filter((i) => kind === 'row' ? Math.floor(i / n) === id : kind === 'column' ? i % n === id : level.regions[i] === id),
    }))),
    conflicts: cells.map((a) => new Set(cells.filter((b) =>
      Math.floor(a / n) === Math.floor(b / n) || a % n === b % n || level.regions[a] === level.regions[b] ||
      Math.max(Math.abs(Math.floor(a / n) - Math.floor(b / n)), Math.abs(a % n - b % n)) <= 1))),
  }
}
export function initialLogicState(context: LogicContext): LogicState {
  return { candidates: new Set(context.level.regions.map((_, i) => i)), placed: new Set() }
}
export function applyLogicStep(context: LogicContext, state: LogicState, step: LogicStep) {
  if (step.action === 'place') {
    state.placed.add(step.targets[0])
    context.conflicts[step.targets[0]].forEach((i) => state.candidates.delete(i))
  } else step.targets.forEach((i) => state.candidates.delete(i))
}
function label(context: LogicContext, unit: Unit): string {
  if (unit.kind !== 'region') return `第 ${unit.id + 1} ${unit.kind === 'row' ? '橫排' : '直列'}`
  return `${REGION_PALETTE[context.level.palette?.[unit.id] ?? unit.id]?.name ?? ''}區域（${unit.id + 1}）`
}
function shape(choices: number[], n: number): Technique {
  const rows = choices.map((i) => Math.floor(i / n)), cols = choices.map((i) => i % n)
  const height = Math.max(...rows) - Math.min(...rows), width = Math.max(...cols) - Math.min(...cols)
  if (choices.length === 2 && height + width === 1) return 'pair'
  if (choices.length === 3 && ((height === 2 && width === 0) || (height === 0 && width === 2))) return 'triple'
  if (choices.length === 3 && height === 1 && width === 1) return 'bend'
  if (choices.length === 4 && ((height === 1 && width === 2) || (height === 2 && width === 1))) {
    const normalized = choices.map((i) => [Math.floor(i / n) - Math.min(...rows), i % n - Math.min(...cols)])
    const z = height === 1 ? normalized : normalized.map(([r, c]) => [c, r])
    if (z.filter(([r]) => r === 0).length === 2 && z.filter(([, c]) => c === 1).length === 2 &&
      !z.some(([r, c]) => c === 0 && z.some(([r2, c2]) => c2 === 2 && r2 === r))) return 'zigzag'
  }
  return 'common'
}
function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]]
  return items.flatMap((item, index) => combinations(items.slice(index + 1), count - 1).map((rest) => [item, ...rest]))
}

export function commonExclusions(context: LogicContext, sources: number[], candidates: number[]) {
  return sources.length ? candidates.filter((i) => !sources.includes(i) && sources.every((a) => context.conflicts[a].has(i))) : []
}
export function combinationExclusions(context: LogicContext, first: number[], second: number[], candidates: number[]) {
  const pairs = first.flatMap((a) => second.filter((b) => !context.conflicts[a].has(b)).map((b) => [a, b]))
  return pairs.length ? candidates.filter((i) => pairs.every(([a, b]) => i !== a && i !== b && (context.conflicts[a].has(i) || context.conflicts[b].has(i)))) : []
}

/** Each step is a proof from remaining candidates; never consults level.solution or searches a full board. */
export function nextLogicStep(context: LogicContext, state: LogicState, maxRank = 4): LogicStep | null {
  const { candidates, placed } = state
  const { level } = context
  const units = context.units.filter((u) => !u.cells.some((i) => placed.has(i)))
  const choices = (u: Unit) => u.cells.filter((i) => candidates.has(i))
  if (units.some((u) => choices(u).length === 0)) return null
  for (const unit of units) {
    const remaining = choices(unit)
    if (remaining.length === 1) return {
      technique: 'single', action: 'place', sources: unit.cells, targets: remaining,
      observation: `看看${label(context, unit)}。`, reason: `${label(context, unit)}只剩一格能放水母，所以水母一定在這裡。`,
    }
  }
  if (maxRank >= 1) {
    for (const unit of units) {
      const remaining = choices(unit)
      const axes = unit.kind === 'region' ? ['row', 'column'] as const : ['region'] as const
      for (const axis of axes) {
        const ids = new Set(remaining.map((i) => axis === 'row' ? Math.floor(i / level.size) : axis === 'column' ? i % level.size : level.regions[i]))
        if (ids.size !== 1) continue
        const targetUnit = context.units.find((u) => u.kind === axis && u.id === [...ids][0])!
        const targets = targetUnit.cells.filter((i) => candidates.has(i) && !remaining.includes(i))
        if (targets.length) return {
          technique: unit.kind === 'region' ? 'line' : 'reverse', action: 'exclude', sources: remaining, targets,
          observation: `看看${label(context, unit)}剩下的候選位置。`,
          reason: `${label(context, unit)}的水母一定在${label(context, targetUnit)}，因此${label(context, targetUnit)}的其他候選格可以畫叉。`,
        }
      }
    }
  }
  if (maxRank >= 2) {
    for (const unit of units) {
      const remaining = choices(unit)
      const targets = commonExclusions(context, remaining, [...candidates].filter((i) => !unit.cells.includes(i)))
      if (targets.length) return {
        technique: unit.kind === 'region' || new Set(remaining.map((i) => level.regions[i])).size === 1 ? shape(remaining, level.size) : 'common', action: 'exclude', sources: remaining, targets,
        observation: `看看${label(context, unit)}的 ${remaining.length} 個候選位置。`,
        reason: `${label(context, unit)}一定有一隻水母。不論選哪個候選格，亮起的格子都會違反同排、同列、同區或相鄰規則，所以可以畫叉。`,
      }
    }
  }
  if (maxRank >= 3) {
    for (const count of [2, 3]) for (const from of ['region', 'row', 'column'] as const) {
      const axes = from === 'region' ? ['row', 'column'] as const : ['region'] as const
      for (const group of combinations(units.filter((u) => u.kind === from), count)) for (const axis of axes) {
        const source = group.flatMap(choices)
        const ids = new Set(source.map((i) => axis === 'row' ? Math.floor(i / level.size) : axis === 'column' ? i % level.size : level.regions[i]))
        if (ids.size !== count) continue
        const targets = [...candidates].filter((i) => ids.has(axis === 'row' ? Math.floor(i / level.size) : axis === 'column' ? i % level.size : level.regions[i]) && !source.includes(i))
        if (targets.length) return {
          technique: count === 2 ? 'hall2' : 'hall3', action: 'exclude', sources: source, targets,
          observation: `一起看看${group.map((u) => label(context, u)).join('、')}。`,
          reason: `這 ${count} 個${from === 'region' ? '區域' : from === 'row' ? '橫排' : '直列'}必須放 ${count} 隻水母，候選位置只占 ${count} 個${axis === 'region' ? '區域' : axis === 'row' ? '橫排' : '直列'}，因此這些位置必須留給它們，其他候選格可以畫叉。`,
        }
      }
    }
  }
  if (maxRank >= 4) {
    for (const [first, second] of combinations(units.filter((u) => u.kind === 'region'), 2)) {
      const source = [...choices(first), ...choices(second)]
      const targets = combinationExclusions(context, choices(first), choices(second), [...candidates])
      if (targets.length) return {
        technique: 'combination', action: 'exclude', sources: source, targets,
        observation: `比較${label(context, first)}與${label(context, second)}可以同時放置的組合。`,
        reason: `這兩區各需要一隻水母。排除互相衝突的組合後，每一種合法組合都會封住亮起的格子，因此可以畫叉。`,
      }
    }
  }
  return null
}

export function solveLogically(level: Level, maxRank = 4) {
  const context = createLogicContext(level), state = initialLogicState(context)
  const steps: LogicStep[] = []
  while (state.placed.size < level.size) {
    const step = nextLogicStep(context, state, maxRank)
    if (!step) break
    steps.push(step)
    applyLogicStep(context, state, step)
  }
  const rank = Math.max(0, ...steps.map((s) => TECHNIQUES[s.technique].rank))
  const deductions = steps.filter((s) => s.action === 'exclude').length
  const score = rank * 1000 + deductions * 20 + steps.reduce((sum, s) => sum + (s.action === 'exclude' ? s.sources.length : 0), 0)
  return { solved: state.placed.size === level.size, steps, placed: [...state.placed], rank, deductions, rounds: steps.length, score }
}

export type HintResult = { step: LogicStep; conflicts?: never } | { step?: never; conflicts: number[]; message: string }
/** Verify user actions with an independent logical proof before treating them as premises. */
export function getLogicalHint(level: Level, board: CellState[]): HintResult | null {
  const proof = solveLogically(level)
  if (!proof.solved) return null
  const confirmed = new Set(proof.placed)
  const errors = board.flatMap((cell, i) => (cell === 'jelly' && !confirmed.has(i)) || (cell === 'marked' && confirmed.has(i)) ? [i] : [])
  if (errors.length) return { conflicts: errors, message: '這些水母或叉號與可推導的排列不一致。先清除亮起的格子，再繼續推理；本次不扣提示。' }
  const context = createLogicContext(level), state = initialLogicState(context)
  board.forEach((cell, i) => {
    if (cell === 'marked') state.candidates.delete(i)
    if (cell === 'jelly') {
      state.placed.add(i)
      context.conflicts[i].forEach((j) => state.candidates.delete(j))
    }
  })
  const blocked = board.flatMap((cell, i) => cell === 'empty' && !state.candidates.has(i) ? [i] : [])
  if (blocked.length) return { step: { technique: 'placed', action: 'exclude', sources: board.flatMap((s, i) => s === 'jelly' ? [i] : []), targets: blocked, observation: '看看已放置水母的橫排、直列、區域及周圍八格。', reason: '這些格子與已確認的水母衝突，可以畫叉。' } }
  const step = nextLogicStep(context, state)
  return step ? { step } : null
}
