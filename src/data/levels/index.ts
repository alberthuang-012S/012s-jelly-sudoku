import type { Difficulty, Level } from '../../types/game'
import { solveLevel } from '../../game/solver'

interface DifficultyConfig {
  difficulty: Difficulty
  size: number
  count: number
}

const difficultyConfigs: DifficultyConfig[] = [
  { difficulty: 'basic', size: 6, count: 10 },
  { difficulty: 'normal', size: 8, count: 10 },
  { difficulty: 'challenge', size: 10, count: 10 },
]

function generateSolutions(size: number, count: number): number[][] {
  const results: number[][] = []
  const current: number[] = []
  const used = new Set<number>()

  function search(): void {
    if (results.length >= count) return
    if (current.length === size) {
      results.push([...current])
      return
    }
    const row = current.length
    const order = Array.from({ length: size }, (_, index) => (index + row * 2) % size)
    for (const column of order) {
      if (used.has(column)) continue
      if (current.length > 0 && Math.abs(current[current.length - 1] - column) <= 1) continue
      // A gentle look-ahead prevents the final row from becoming impossible.
      if (current.length === size - 1 && current.length > 0 && Math.abs(current[0] - column) === 1) continue
      current.push(column)
      used.add(column)
      search()
      used.delete(column)
      current.pop()
      if (results.length >= count) return
    }
  }

  search()
  return results
}

function createIrregularRegions(size: number, solution: number[], variant: number): number[] {
  const anchors = solution.map((column, row) => ({ row, column }))
  const regions = Array<number>(size * size).fill(-1)

  const frontiers = Array.from({ length: size }, () => new Set<number>())
  const addFrontier = (region: number, row: number, column: number) => {
    if (row < 0 || row >= size || column < 0 || column >= size) return
    const index = row * size + column
    if (regions[index] < 0) frontiers[region].add(index)
  }
  const addNeighbors = (region: number, index: number) => {
    const row = Math.floor(index / size)
    const column = index % size
    addFrontier(region, row - 1, column)
    addFrontier(region, row + 1, column)
    addFrontier(region, row, column - 1)
    addFrontier(region, row, column + 1)
  }
  const hash = (index: number, region: number, step: number) => {
    let value = (index + 1) * 374761393 + (region + 11) * 668265263 + (variant + step + 17) * 69069
    value = (value ^ (value >>> 13)) * 1274126177
    return (value ^ (value >>> 16)) >>> 0
  }

  for (const anchor of anchors) {
    const index = anchor.row * size + anchor.column
    regions[index] = anchor.row
    addNeighbors(anchor.row, index)
  }

  let step = 0
  while (regions.some((region) => region < 0)) {
    let assigned = false
    for (let offset = 0; offset < size; offset += 1) {
      const region = (variant + step + offset * 3) % size
      const candidates = [...frontiers[region]].filter((index) => regions[index] < 0)
      if (candidates.length === 0) continue
      candidates.sort((first, second) => hash(first, region, step) - hash(second, region, step))
      const index = candidates[0]
      regions[index] = region
      frontiers[region].delete(index)
      addNeighbors(region, index)
      step += 1
      assigned = true
      break
    }
    if (!assigned) {
      // This is only a defensive fallback for a fully enclosed final cell.
      const index = regions.findIndex((region) => region < 0)
      regions[index] = index % size
      addNeighbors(index % size, index)
      step += 1
    }
  }
  return regions
}

function titleFor(difficulty: Difficulty, number: number): string {
  const label = difficulty === 'basic' ? '基礎' : difficulty === 'normal' ? '普通' : '挑戰'
  const size = difficulty === 'basic' ? 6 : difficulty === 'normal' ? 8 : 10
  return `${label} ${size}×${size} · ${String(number).padStart(2, '0')}`
}

function buildUniqueLevel(difficulty: Difficulty, size: number, index: number, solution: number[]): Level {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const regions = createIrregularRegions(size, solution, index * 101 + attempt * 17)
    for (let repair = 0; repair < size * size; repair += 1) {
      const candidate: Level = {
        id: `${difficulty}-${String(index + 1).padStart(3, '0')}`,
        difficulty,
        size,
        regions: [...regions],
        solution,
        title: titleFor(difficulty, index + 1),
      }
      const result = solveLevel(candidate, 2)
      if (result.solutionCount === 1) return candidate

      const alternate = result.solutions.find((candidateSolution) => candidateSolution.some((column, row) => column !== solution[row]))
      if (!alternate) break
      const differentRows = alternate.flatMap((column, row) => column !== solution[row] ? [row] : [])
      const victimRow = differentRows[0]
      const victimIndex = victimRow * size + alternate[victimRow]
      const sourceRow = Array.from({ length: size }, (_, row) => row).find((row) => row !== victimRow && regions[row * size + alternate[row]] !== regions[victimIndex])
      if (sourceRow === undefined) break
      const duplicateRegion = regions[sourceRow * size + alternate[sourceRow]]
      // The alternate solution will now use this region twice. The intended solution
      // never touches victimIndex, so its one-per-region property stays intact.
      regions[victimIndex] = duplicateRegion
    }
  }
  throw new Error(`Unable to generate a unique ${difficulty} level ${index + 1}`)
}

function buildLevels(): Level[] {
  return difficultyConfigs.flatMap(({ difficulty, size, count }) => {
    const solutions = generateSolutions(size, count)
    return Array.from({ length: count }, (_, index) => buildUniqueLevel(difficulty, size, index, solutions[index]))
  })
}

export const levels: Level[] = buildLevels()

export const levelsByDifficulty: Record<Difficulty, Level[]> = {
  basic: levels.filter((level) => level.difficulty === 'basic'),
  normal: levels.filter((level) => level.difficulty === 'normal'),
  challenge: levels.filter((level) => level.difficulty === 'challenge'),
}

export function getLevel(levelId: string): Level | undefined {
  return levels.find((level) => level.id === levelId)
}
