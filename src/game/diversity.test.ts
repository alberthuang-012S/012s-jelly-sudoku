import { expect, it } from 'vitest'
import { layoutKey, layoutSimilarity, layoutVariants } from './diversity'

it('compares shape independently of rotation, reflection and region labels', () => {
  const a = { size: 3, regions: [0, 0, 1, 0, 1, 1, 2, 2, 2] }
  for (const variant of layoutVariants(a.regions, a.size)) {
    const b = { size: 3, regions: variant.map((r) => [2, 0, 1][r]) }
    expect(layoutKey(b)).toBe(layoutKey(a))
    expect(layoutSimilarity(a, b)).toBe(1)
  }
})

it('finds the optimal colour assignment rather than comparing raw region IDs', () => {
  const a = { size: 3, regions: [0, 0, 1, 0, 1, 1, 2, 2, 2] }
  const b = { size: 3, regions: [2, 2, 0, 2, 0, 1, 1, 1, 1] }
  expect(layoutSimilarity(a, b)).toBeCloseTo(8 / 9)
  expect(layoutSimilarity(a, { size: 2, regions: [0, 0, 1, 1] })).toBe(0)
})
