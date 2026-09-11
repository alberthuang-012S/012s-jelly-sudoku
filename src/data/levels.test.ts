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
