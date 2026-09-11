import { describe, expect, it } from 'vitest'
import { levels } from '../data/levels'
import type { Level } from '../types/game'
import { solveLevel } from './solver'
import { validateLevel } from './validator'

const uniqueLevel = levels[0]

describe('solver and validator', () => {
  it('finds a valid solution', () => {
    const result = solveLevel(uniqueLevel, 2)
    expect(result.solutionCount).toBeGreaterThan(0)
  })

  it('returns no solution for an impossible region layout', () => {
    const impossible: Level = {
      ...uniqueLevel,
      regions: Array(36).fill(0),
    }
    expect(solveLevel(impossible, 2).solutionCount).toBe(0)
  })

  it('validates structure and reports uniqueness', () => {
    const result = validateLevel(uniqueLevel)
    expect(result.solutionCount).toBeGreaterThan(0)
    expect(result.errors).toEqual([])
  })
})
