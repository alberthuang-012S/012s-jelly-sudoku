import type { Difficulty, Level } from '../../types/game'
import { REGION_PALETTE } from '../../config/regionPalette'
import { areAllRegionsConnected, getOrthogonalNeighbors, isRegionConnected } from '../../game/regions'
import { solveLevel } from '../../game/solver'
import staticLevelData from './generated-levels.json'

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
  let randomState = (variant * 2654435761 + 1013904223) >>> 0
  const random = () => {
    randomState = (randomState + 0x6d2b79f5) >>> 0
    let value = randomState
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  for (const anchor of anchors) {
    const index = anchor.row * size + anchor.column
    regions[index] = anchor.row
    addNeighbors(anchor.row, index)
  }

  let step = 0
  while (regions.some((region) => region < 0)) {
    const activeRegions = frontiers
      .map((frontier, region) => ({ region, hasCells: [...frontier].some((index) => regions[index] < 0) }))
      .filter((entry) => entry.hasCells)
      .map((entry) => entry.region)
    if (activeRegions.length > 0) {
      const region = activeRegions[Math.floor(random() * activeRegions.length)]
      const candidates = [...frontiers[region]].filter((index) => regions[index] < 0)
      const index = candidates[Math.floor(random() * candidates.length)]
      regions[index] = region
      frontiers[region].delete(index)
      addNeighbors(region, index)
    } else {
      // Defensive fallback: attach a remaining cell to one of its assigned neighbours,
      // which keeps the newly grown region orthogonally connected as well.
      const index = regions.findIndex((region) => region < 0)
      const neighbour = getOrthogonalNeighbors(index, size).find((candidate) => regions[candidate] >= 0)
      const region = neighbour === undefined ? index % size : regions[neighbour]
      regions[index] = region
      addNeighbors(region, index)
    }
    step += 1
  }
  return regions
}

function titleFor(difficulty: Difficulty, number: number): string {
  const label = difficulty === 'basic' ? '基礎' : difficulty === 'normal' ? '普通' : '挑戰'
  const size = difficulty === 'basic' ? 6 : difficulty === 'normal' ? 8 : 10
  return `${label} ${size}×${size} · ${String(number).padStart(2, '0')}`
}

function createRegionAdjacency(size: number, regions: number[]): Set<number>[] {
  const adjacency = Array.from({ length: size }, () => new Set<number>())
  for (let index = 0; index < regions.length; index += 1) {
    for (const neighbor of getOrthogonalNeighbors(index, size)) {
      const firstRegion = regions[index]
      const secondRegion = regions[neighbor]
      if (firstRegion !== secondRegion) adjacency[firstRegion].add(secondRegion)
    }
  }
  return adjacency
}

function hueDistance(first: number, second: number): number {
  const distance = Math.abs(first - second)
  return Math.min(distance, 360 - distance)
}

function assignRegionPalette(size: number, regions: number[], variant: number): number[] {
  const adjacency = createRegionAdjacency(size, regions)
  const assignments = Array<number>(size).fill(-1)
  const usedColorIndices = new Set<number>()
  const regionOrder = Array.from({ length: size }, (_, region) => region).sort((first, second) => {
    const degreeDifference = adjacency[second].size - adjacency[first].size
    return degreeDifference !== 0 ? degreeDifference : ((first + variant) % size) - ((second + variant) % size)
  })

  for (const region of regionOrder) {
    const assignedNeighborColors = [...adjacency[region]]
      .map((neighbor) => assignments[neighbor])
      .filter((colorIndex) => colorIndex >= 0)
    const assignedNeighborFamilies = new Set(assignedNeighborColors.map((colorIndex) => REGION_PALETTE[colorIndex].family))
    const candidates = REGION_PALETTE.map((_, colorIndex) => colorIndex)
      .filter((colorIndex) => !usedColorIndices.has(colorIndex) && !assignedNeighborFamilies.has(REGION_PALETTE[colorIndex].family))
      .sort((first, second) => {
        const firstScore = assignedNeighborColors.length === 0
          ? ((first + variant) % REGION_PALETTE.length)
          : Math.min(...assignedNeighborColors.map((neighborColor) => hueDistance(REGION_PALETTE[first].hue, REGION_PALETTE[neighborColor].hue)))
        const secondScore = assignedNeighborColors.length === 0
          ? ((second + variant) % REGION_PALETTE.length)
          : Math.min(...assignedNeighborColors.map((neighborColor) => hueDistance(REGION_PALETTE[second].hue, REGION_PALETTE[neighborColor].hue)))
        return secondScore - firstScore
      })
    const colorIndex = candidates[0] ?? REGION_PALETTE.findIndex((_, index) => !usedColorIndices.has(index))
    assignments[region] = colorIndex >= 0 ? colorIndex : region % REGION_PALETTE.length
    usedColorIndices.add(assignments[region])
  }
  return assignments
}

function canMoveRegionCell(regions: number[], size: number, index: number, targetRegion: number): boolean {
  const sourceRegion = regions[index]
  if (sourceRegion === targetRegion) return false
  if (!getOrthogonalNeighbors(index, size).some((neighbor) => regions[neighbor] === targetRegion)) return false
  const nextRegions = [...regions]
  nextRegions[index] = targetRegion
  return isRegionConnected(nextRegions, size, sourceRegion) && isRegionConnected(nextRegions, size, targetRegion)
}

function buildUniqueLevel(difficulty: Difficulty, size: number, index: number, solution: number[]): Level {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const regions = createIrregularRegions(size, solution, index * 101 + attempt * 17)
    if (!areAllRegionsConnected(regions, size)) continue
    for (let repair = 0; repair < size * size; repair += 1) {
      const candidate: Level = {
        id: `${difficulty}-${String(index + 1).padStart(3, '0')}`,
        difficulty,
        size,
        regions: [...regions],
        palette: assignRegionPalette(size, regions, index * 101 + attempt * 17),
        solution,
        title: titleFor(difficulty, index + 1),
      }
      const result = solveLevel(candidate, 2)
      if (result.solutionCount === 1) return candidate

      const alternate = result.solutions.find((candidateSolution) => candidateSolution.some((column, row) => column !== solution[row]))
      if (!alternate) break
      const differentRows = alternate.flatMap((column, row) => column !== solution[row] ? [row] : [])
      let repaired = false
      for (const victimRow of differentRows) {
        const victimIndex = victimRow * size + alternate[victimRow]
        for (const sourceRow of Array.from({ length: size }, (_, row) => row)) {
          if (sourceRow === victimRow) continue
          const duplicateRegion = regions[sourceRow * size + alternate[sourceRow]]
          // The alternate solution will now use this region twice. The intended solution
          // never touches victimIndex, so its one-per-region property stays intact.
          if (!canMoveRegionCell(regions, size, victimIndex, duplicateRegion)) continue
          regions[victimIndex] = duplicateRegion
          repaired = true
          break
        }
        if (repaired) break
      }
      if (!repaired) break
    }
  }
  throw new Error(`Unable to generate a unique ${difficulty} level ${index + 1}`)
}

export function buildLevels(): Level[] {
  return difficultyConfigs.flatMap(({ difficulty, size, count }) => {
    // Beginner levels follow the curated, no-guess teaching sequence.
    if (difficulty === 'basic') return (staticLevelData as Level[]).filter((level) => level.difficulty === 'basic')
    const solutions = generateSolutions(size, count)
    return Array.from({ length: count }, (_, index) => buildUniqueLevel(difficulty, size, index, solutions[index]))
  })
}

// The generator above is kept as the checked-in authoring path. The shipped app
// consumes the generated catalogue so page load never performs level synthesis.
export const levels: Level[] = staticLevelData as Level[]

export const levelsByDifficulty: Record<Difficulty, Level[]> = {
  basic: levels.filter((level) => level.difficulty === 'basic'),
  normal: levels.filter((level) => level.difficulty === 'normal'),
  challenge: levels.filter((level) => level.difficulty === 'challenge'),
}

export function getLevel(levelId: string): Level | undefined {
  return levels.find((level) => level.id === levelId)
}
