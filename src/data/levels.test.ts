import { describe, expect, it } from 'vitest'
import { levels, levelsByDifficulty } from './levels'
import { validateAllLevels, validateLevel } from '../game/validator'
import { validateRegionConnectivity } from '../game/regions'

describe('official level data', () => {
  it('contains 10 levels for each official mode', () => {
    expect(levels).toHaveLength(30)
    expect(levelsByDifficulty.basic).toHaveLength(10)
    expect(levelsByDifficulty.normal).toHaveLength(10)
    expect(levelsByDifficulty.challenge).toHaveLength(10)
  })

  it('passes validation for every official level', () => {
    const results = validateAllLevels(levels)
    expect(results.every((result) => result.valid)).toBe(true)
    expect(results.every((result) => result.solutionCount === 1)).toBe(true)
    expect(results.every((result) => result.regionConnectivity.valid)).toBe(true)
    expect(results.every((result) => result.regionPalette.valid)).toBe(true)
  })

  it('fails a level when one region is split into separate orthogonal components', () => {
    const disconnectedRegions = [
      0, 1, 2, 3, 4, 0,
      1, 1, 2, 3, 4, 5,
      1, 1, 2, 3, 4, 5,
      1, 1, 2, 3, 4, 5,
      1, 1, 2, 3, 4, 5,
      1, 1, 2, 3, 4, 5,
    ]
    const disconnectedLevel = { ...levels[0], regions: disconnectedRegions }
    const connectivityResult = validateRegionConnectivity(disconnectedLevel)
    const levelResult = validateLevel(disconnectedLevel)
    expect(connectivityResult.valid).toBe(false)
    expect(connectivityResult.errors[0]).toContain('Region 0')
    expect(levelResult.valid).toBe(false)
    expect(levelResult.errors.join(' ')).toContain('Region 0')
  })
})

function regionShapes(level: typeof levels[number]) {
  return Array.from({ length: level.size }, (_, region) => {
    const cells = level.regions.flatMap((r, i) => r === region ? [i] : [])
    return { single: cells.length === 1, vertical: cells.length > 1 && new Set(cells.map((i) => i % level.size)).size === 1, horizontal: cells.length > 1 && new Set(cells.map((i) => Math.floor(i / level.size))).size === 1 }
  })
}

it('provides exactly one singleton in each of the first three levels and none later', () => {
  levelsByDifficulty.basic.forEach((level, index) => {
    expect(regionShapes(level).filter((shape) => shape.single)).toHaveLength(index < 3 ? 1 : 0)
  })
})

it('introduces vertical strips followed by mixed vertical and horizontal strips', () => {
  levelsByDifficulty.basic.slice(3, 7).forEach((level) => {
    expect(regionShapes(level).some((shape) => shape.vertical)).toBe(true)
  })
  levelsByDifficulty.basic.slice(5, 7).forEach((level) => {
    expect(regionShapes(level).some((shape) => shape.horizontal)).toBe(true)
  })
})

it('solves every beginner puzzle without guessing and preserves the requested opening swap', async () => {
  const { analyzeLogicalDifficulty } = await import('../game/difficulty')
  const ratings = levelsByDifficulty.basic.map(analyzeLogicalDifficulty)
  expect(ratings.every((rating) => rating.solved)).toBe(true)
  // The user explicitly swapped the first two puzzles; later progression stays ordered.
  const authoredOrder = [ratings[1], ratings[0], ...ratings.slice(2)].map((rating) => rating.deductions)
  expect(authoredOrder).toEqual([...authoredOrder].sort((a, b) => a - b))
})

it('gives normal levels strip-based openings without singleton regions', () => {
  levelsByDifficulty.normal.forEach((level) => {
    expect(regionShapes(level).some((shape) => shape.single)).toBe(false)
    expect(level.revision).toBe(2)
  })
  levelsByDifficulty.normal.slice(0, 6).forEach((level) => {
    expect(regionShapes(level).some((shape) => shape.vertical)).toBe(true)
  })
  levelsByDifficulty.normal.slice(0, 3).forEach((level) => {
    expect(regionShapes(level).some((shape) => shape.horizontal)).toBe(true)
  })
})

it('solves the normal progression by deductions alone in nondecreasing difficulty order', async () => {
  const { analyzeLogicalDifficulty } = await import('../game/difficulty')
  const ratings = levelsByDifficulty.normal.map(analyzeLogicalDifficulty)
  expect(ratings.every((rating) => rating.solved)).toBe(true)
  const deductions = ratings.map((rating) => rating.deductions)
  expect(deductions).toEqual([...deductions].sort((a, b) => a - b))
})

it('uses a distinct solution for each normal puzzle', () => {
  expect(new Set(levelsByDifficulty.normal.map((level) => level.solution.join(','))).size).toBe(10)
})
