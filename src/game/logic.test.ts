import { expect, it } from 'vitest'
import { levelsByDifficulty } from '../data/levels'
import { getLogicalHint, solveLogically } from './logic'
import type { CellState } from '../types/game'

it('derives exactly the same proof when the stored answer is missing or deliberately wrong', () => {
  for (const mode of Object.values(levelsByDifficulty)) for (const level of [mode[0], mode[50], mode[99]]) {
    expect(solveLogically({ ...level, solution: [] }).placed).toEqual(solveLogically(level).placed)
    expect(solveLogically({ ...level, solution: Array(level.size).fill(0) }).steps).toEqual(solveLogically(level).steps)
  }
})
it('does not accept an arbitrary user cross as a valid premise', () => {
  const level = levelsByDifficulty.basic[0]
  const board: CellState[] = Array(36).fill('empty')
  const target = level.solution[0]
  board[target] = 'marked'
  expect(getLogicalHint(level, board)?.conflicts).toContain(target)
  board[target] = 'empty'
  board[(target + 1) % 6] = 'jelly'
  expect(getLogicalHint(level, board)?.conflicts).toContain((target + 1) % 6)
})
it('can advance from arbitrary correct player progress using supported deductions', () => {
  for (const group of Object.values(levelsByDifficulty)) for (const level of [group[0], group[50], group[99]]) {
    const board: CellState[] = Array(level.size ** 2).fill('empty')
    const solution = new Set(level.solution.map((c, r) => r * level.size + c))
    let steps = 0
    while (board.filter((s) => s === 'jelly').length < level.size && steps++ < 150) {
      const hint = getLogicalHint(level, board)
      expect(hint?.conflicts).toBeUndefined()
      expect(hint?.step, level.id).toBeDefined()
      for (const i of hint!.step!.targets) {
        expect(solution.has(i)).toBe(hint!.step!.action === 'place')
        board[i] = hint!.step!.action === 'place' ? 'jelly' : 'marked'
      }
    }
    expect(board.filter((s) => s === 'jelly')).toHaveLength(level.size)
  }
}, 30000)

it('identifies same-colour pairs and triples even when a row or column supplies the proof', () => {
  const shapes = Object.values(levelsByDifficulty).flat().flatMap((level) => solveLogically(level).steps
    .filter((step) => step.technique === 'pair' || step.technique === 'triple').map((step) => ({ level, step })))
  expect(shapes.some(({ step }) => step.technique === 'pair')).toBe(true)
  expect(shapes.some(({ step }) => step.technique === 'triple')).toBe(true)
  for (const { level, step } of shapes) {
    expect(new Set(step.sources.map((i) => level.regions[i])).size).toBe(1)
    expect(step.sources).toHaveLength(step.technique === 'pair' ? 2 : 3)
  }
})
