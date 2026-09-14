import { describe, expect, it } from 'vitest'
import type { Level } from '../types/game'
import { getConflicts, getConstraintOverlay, isAdjacent, isBoardSolved, isSameColumn, isSameRegion, isSameRow, solutionToBoard, validatePlacement } from './rules'

const level: Level = {
  id: 'test',
  difficulty: 'basic',
  size: 6,
  regions: Array.from({ length: 36 }, (_, index) => Math.floor(index / 6)),
  solution: [0, 2, 4, 1, 3, 5],
  title: 'Test',
}

const regionConflictLevel: Level = {
  ...level,
  regions: level.regions.map((region, index) => index === 6 ? 0 : region),
}

function boardWith(indices: number[]): ReturnType<typeof solutionToBoard> {
  const board = Array(36).fill('empty') as ReturnType<typeof solutionToBoard>
  for (const index of indices) board[index] = 'jelly'
  return board
}

describe('rules engine', () => {
  it('recognizes row, column, and region relationships', () => {
    expect(isSameRow(1, 5, 6)).toBe(true)
    expect(isSameColumn(1, 7, 6)).toBe(true)
    expect(isSameRegion(0, 5, level)).toBe(true)
  })

  it('detects horizontal, vertical, and diagonal adjacency', () => {
    expect(isAdjacent(0, 1, 6)).toBe(true)
    expect(isAdjacent(0, 6, 6)).toBe(true)
    expect(isAdjacent(0, 7, 6)).toBe(true)
    expect(isAdjacent(0, 8, 6)).toBe(false)
  })

  it('reports row, column, region, and adjacency conflicts', () => {
    expect(getConflicts(boardWith([0, 1]), level).some((conflict) => conflict.type === 'row')).toBe(true)
    expect(getConflicts(boardWith([0, 6]), level).some((conflict) => conflict.type === 'column')).toBe(true)
    expect(getConflicts(boardWith([0, 6]), regionConflictLevel).some((conflict) => conflict.type === 'region')).toBe(true)
    expect(getConflicts(boardWith([0, 7]), level).some((conflict) => conflict.type === 'adjacent')).toBe(true)
  })

  it('accepts a valid placement', () => {
    const board = boardWith([0])
    expect(validatePlacement(0, board, level).valid).toBe(true)
    expect(isBoardSolved(solutionToBoard(level), level)).toBe(true)
  })
})

it('marks distant cells in the same region without hiding placed jellies', () => {
  const custom = { ...level, regions: level.regions.map((region, index) => index === 16 ? 0 : region) }
  const overlay = getConstraintOverlay(boardWith([0]), custom)
  expect(overlay.has(16)).toBe(true)
  expect(overlay.has(0)).toBe(false)
  expect(overlay.has(20)).toBe(false)
})

it('does not attribute an existing conflict to an unrelated placement', () => {
  expect(validatePlacement(16, boardWith([0, 1, 16]), level).valid).toBe(true)
})
