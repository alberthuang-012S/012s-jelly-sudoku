import type { CellState, Level, PlacementConflict } from '../types/game'

export function toIndex(row: number, column: number, size: number): number {
  return row * size + column
}

export function toPosition(index: number, size: number): { row: number; column: number } {
  return { row: Math.floor(index / size), column: index % size }
}

export function isSameRow(firstIndex: number, secondIndex: number, size: number): boolean {
  return Math.floor(firstIndex / size) === Math.floor(secondIndex / size)
}

export function isSameColumn(firstIndex: number, secondIndex: number, size: number): boolean {
  return firstIndex % size === secondIndex % size
}

export function isSameRegion(firstIndex: number, secondIndex: number, level: Level): boolean {
  return level.regions[firstIndex] === level.regions[secondIndex]
}

export function isAdjacent(firstIndex: number, secondIndex: number, size: number): boolean {
  const first = toPosition(firstIndex, size)
  const second = toPosition(secondIndex, size)
  return firstIndex !== secondIndex && Math.max(Math.abs(first.row - second.row), Math.abs(first.column - second.column)) === 1
}

function jellyIndices(board: CellState[]): number[] {
  return board.flatMap((state, index) => (state === 'jelly' ? [index] : []))
}

export function getConflicts(board: CellState[], level: Level): PlacementConflict[] {
  const { size } = level
  const jellies = jellyIndices(board)
  const conflicts: PlacementConflict[] = []
  const rows = new Map<number, number[]>()
  const columns = new Map<number, number[]>()
  const regions = new Map<number, number[]>()

  for (const index of jellies) {
    const { row, column } = toPosition(index, size)
    const region = level.regions[index]
    rows.set(row, [...(rows.get(row) ?? []), index])
    columns.set(column, [...(columns.get(column) ?? []), index])
    regions.set(region, [...(regions.get(region) ?? []), index])
  }

  for (const cells of rows.values()) {
    if (cells.length > 1) conflicts.push({ type: 'row', cells, message: '每行只能有一隻水母' })
  }
  for (const cells of columns.values()) {
    if (cells.length > 1) conflicts.push({ type: 'column', cells, message: '每列只能有一隻水母' })
  }
  for (const cells of regions.values()) {
    if (cells.length > 1) conflicts.push({ type: 'region', cells, message: '同一區域只能有一隻水母' })
  }
  for (let first = 0; first < jellies.length; first += 1) {
    for (let second = first + 1; second < jellies.length; second += 1) {
      const firstIndex = jellies[first]
      const secondIndex = jellies[second]
      if (isAdjacent(firstIndex, secondIndex, size)) {
        conflicts.push({ type: 'adjacent', cells: [firstIndex, secondIndex], message: '水母不能相鄰' })
      }
    }
  }
  return conflicts
}

export function validatePlacement(index: number, board: CellState[], level: Level): { valid: boolean; conflicts: PlacementConflict[] } {
  if (board[index] !== 'jelly') return { valid: true, conflicts: [] }
  const conflicts = getConflicts(board, level).filter((conflict) => conflict.cells.includes(index))
  return { valid: conflicts.length === 0, conflicts }
}

export function getConstraintOverlay(board: CellState[], level: Level): Set<number> {
  const overlay = new Set<number>()
  for (const index of jellyIndices(board)) {
    const { row, column } = toPosition(index, level.size)
    for (let current = 0; current < level.size; current += 1) {
      overlay.add(toIndex(row, current, level.size))
      overlay.add(toIndex(current, column, level.size))
    }
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const nextRow = row + rowOffset
        const nextColumn = column + columnOffset
        if (nextRow >= 0 && nextRow < level.size && nextColumn >= 0 && nextColumn < level.size) {
          overlay.add(toIndex(nextRow, nextColumn, level.size))
        }
      }
    }
  }
  for (const index of jellyIndices(board)) overlay.delete(index)
  return overlay
}

export function isBoardSolved(board: CellState[], level: Level): boolean {
  if (board.length !== level.size * level.size) return false
  if (jellyIndices(board).length !== level.size) return false
  if (getConflicts(board, level).length > 0) return false
  const rows = new Set<number>()
  const columns = new Set<number>()
  const regions = new Set<number>()
  for (const index of jellyIndices(board)) {
    const { row, column } = toPosition(index, level.size)
    rows.add(row)
    columns.add(column)
    regions.add(level.regions[index])
  }
  return rows.size === level.size && columns.size === level.size && regions.size === level.size
}

export function solutionToBoard(level: Level): CellState[] {
  return Array.from({ length: level.size * level.size }, (_, index) => {
    const { row, column } = toPosition(index, level.size)
    return level.solution[row] === column ? 'jelly' : 'empty'
  })
}
