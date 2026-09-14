import { expect, it } from 'vitest'
import { tutorialLevel } from './tutorial'
import { validateLevel } from '../game/validator'
import { analyzeLogicalDifficulty } from '../game/difficulty'

it('offers one small, connected, uniquely solvable tutorial with exactly one singleton', () => {
  expect(tutorialLevel.size).toBe(4)
  expect(validateLevel(tutorialLevel).valid).toBe(true)
  expect(analyzeLogicalDifficulty(tutorialLevel).solved).toBe(true)
  expect(Array.from({ length: 4 }, (_, r) => tutorialLevel.regions.filter((region) => region === r).length).filter((n) => n === 1)).toHaveLength(1)
})
