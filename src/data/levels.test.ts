import { describe, expect, it } from 'vitest'
import { levels, levelsByDifficulty } from './levels'
import { validateAllLevels } from '../game/validator'

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
  })
})
