import { describe, expect, it } from 'vitest'
import { tutorialLevels } from './tutorial'
import { validateLevel } from '../game/validator'
import { analyzeLogicalDifficulty } from '../game/difficulty'

describe('tutorial puzzles', () => {
  it('has four connected, unique and no-guess puzzles', () => {
    expect(tutorialLevels.map((level) => level.size)).toEqual([4, 4, 4, 6])
    tutorialLevels.forEach((level) => {
      expect(validateLevel(level).valid).toBe(true)
      expect(analyzeLogicalDifficulty(level).solved).toBe(true)
    })
  })
  it('introduces one singleton and both strip directions', () => {
    const first = tutorialLevels[0]
    expect(Array.from({ length: 4 }, (_, r) => first.regions.filter((region) => region === r).length).filter((n) => n === 1)).toHaveLength(1)
    const strips = tutorialLevels[1]
    const groups = Array.from({ length: 4 }, (_, r) => strips.regions.flatMap((region, i) => region === r ? [i] : []))
    expect(groups.some((g) => g.length > 1 && new Set(g.map((i) => i % 4)).size === 1)).toBe(true)
    expect(groups.some((g) => g.length > 1 && new Set(g.map((i) => Math.floor(i / 4))).size === 1)).toBe(true)
  })
})
