import type { Level } from '../types/game'

export interface SolveResult {
  solutionCount: number
  solutions: number[][]
  nodes: number
}

export function solveLevel(level: Level, limit = 2): SolveResult {
  const { size, regions } = level
  const rows = Array.from({ length: size }, (_, row) => row)
  const assignments = Array<number>(size).fill(-1)
  const usedColumns = new Set<number>()
  const usedRegions = new Set<number>()
  const solutions: number[][] = []
  let nodes = 0

  function canPlace(row: number, column: number): boolean {
    const index = row * size + column
    const region = regions[index]
    if (usedColumns.has(column) || usedRegions.has(region)) return false
    if (row > 0 && assignments[row - 1] >= 0 && Math.abs(assignments[row - 1] - column) <= 1) return false
    if (row < size - 1 && assignments[row + 1] >= 0 && Math.abs(assignments[row + 1] - column) <= 1) return false
    return true
  }

  function search(rowIndex: number): void {
    if (solutions.length >= limit) return
    nodes += 1
    if (rowIndex === size) {
      solutions.push([...assignments])
      return
    }

    const row = rows[rowIndex]
    const candidates: number[] = []
    for (let column = 0; column < size; column += 1) {
      if (canPlace(row, column)) candidates.push(column)
    }
    // A simple forward check keeps the search fast on 10×10 boards.
    if (candidates.length === 0) return
    for (const column of candidates) {
      const region = regions[row * size + column]
      assignments[row] = column
      usedColumns.add(column)
      usedRegions.add(region)

      let possible = true
      for (let nextRow = row + 1; nextRow < size; nextRow += 1) {
        let nextHasCandidate = false
        for (let nextColumn = 0; nextColumn < size; nextColumn += 1) {
          const nextRegion = regions[nextRow * size + nextColumn]
          if (usedColumns.has(nextColumn) || usedRegions.has(nextRegion)) continue
          if (Math.abs(nextColumn - column) <= 1 && nextRow === row + 1) continue
          nextHasCandidate = true
          break
        }
        if (!nextHasCandidate) {
          possible = false
          break
        }
      }
      if (possible) search(rowIndex + 1)
      usedColumns.delete(column)
      usedRegions.delete(region)
      assignments[row] = -1
      if (solutions.length >= limit) return
    }
  }

  search(0)
  return { solutionCount: solutions.length, solutions, nodes }
}

export function findSolution(level: Level): number[] | null {
  return solveLevel(level, 1).solutions[0] ?? null
}
