import type { Level } from '../types/game'
import { applyLogicStep, createLogicContext, initialLogicState, nextLogicStep } from './logic'

export function trialStart(level: Level, confirmed: number[]) {
  const context = createLogicContext(level), state = initialLogicState(context)
  for (const i of confirmed) {
    state.placed.add(i)
    context.conflicts[i].forEach((cell) => state.candidates.delete(cell))
  }
  return { context, state }
}

/** Follow only visible rules and forced single positions, without consulting the answer. */
export function traceTrial(level: Level, confirmed: number[], choice: number) {
  const { context, state } = trialStart(level, confirmed)
  const additions: { cell: number; reason: string; unit: number[] }[] = []
  if (!state.candidates.has(choice)) throw new Error('Trial choice is not a candidate')
  state.placed.add(choice)
  context.conflicts[choice].forEach((i) => state.candidates.delete(i))
  additions.push({ cell: choice, reason: '', unit: [] })
  for (let turn = 0; turn < level.size; turn++) {
    const failure = context.units.find((unit) => !unit.cells.some((i) => state.placed.has(i)) && !unit.cells.some((i) => state.candidates.has(i)))
    if (failure) return { additions, failure, solved: false }
    if (state.placed.size === level.size) return { additions, solved: true }
    const step = nextLogicStep(context, state, 0)
    if (!step) break
    additions.push({ cell: step.targets[0], reason: step.reason, unit: step.sources })
    applyLogicStep(context, state, step)
  }
  return { additions, solved: false }
}
