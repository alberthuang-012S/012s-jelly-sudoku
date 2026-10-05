import { describe, expect, it } from 'vitest'
import { levels, levelsByDifficulty } from './levels'
import { validateAllLevels, validateLevel } from '../game/validator'
import { validateRegionConnectivity } from '../game/regions'
import { solveLogically } from '../game/logic'
import { layoutSimilarity, deductionOpening, openingLocation } from '../game/diversity'
import catalogueAudit from '../../scripts/catalogue-audit.json'

function canonical(regions: number[], n: number) {
  const variants: string[] = []
  for (let flip = 0; flip < 2; flip++) for (let turn = 0; turn < 4; turn++) {
    const grid = Array<number>(n * n)
    regions.forEach((v, i) => {
      let r = Math.floor(i / n), c = i % n
      if (flip) c = n - 1 - c
      for (let t = 0; t < turn; t++) [r, c] = [c, n - 1 - r]
      grid[r * n + c] = v
    })
    const ids = new Map<number, number>()
    variants.push(grid.map((v) => { if (!ids.has(v)) ids.set(v, ids.size); return ids.get(v) }).join(','))
  }
  return variants.sort()[0]
}

describe('300-level catalogue', () => {
  it('ships exactly 100 ordered IDs per board and rejects duplicate layouts including symmetry and recolouring', () => {
    expect(levels).toHaveLength(300)
    for (const [difficulty, group] of Object.entries(levelsByDifficulty)) {
      expect(group).toHaveLength(100)
      expect(new Set(group.map((l) => canonical(l.regions, l.size))).size).toBe(100)
      group.forEach((l, i) => expect(l.id).toBe(`${difficulty}-${String(i + 1).padStart(3, '0')}`))
      group.slice(1).forEach((level, i) => {
        const previous = group[i]
        if (previous.solution.join(',') === level.solution.join(',')) {
          const changed = previous.regions.filter((r, j) => r !== level.regions[j]).length
          expect(changed / level.regions.length, `${previous.id} → ${level.id}`).toBeGreaterThanOrEqual(.12)
        }
      })
    }
  })
  it('has a connected layout, distinct palette, valid answer and exactly one solution for every puzzle', () => {
    const results = validateAllLevels(levels)
    expect(results.filter((result) => !result.valid)).toEqual([])
    expect(results.every((result) => result.solutionCount === 1)).toBe(true)
  }, 30000)
  it('completes every puzzle by sound deductions and increases average difficulty by chapter', () => {
    for (const group of Object.values(levelsByDifficulty)) {
      const scores: number[] = []
      for (const level of group) {
        const proof = solveLogically(level)
        expect(proof.solved, level.id).toBe(true)
        const solution = new Set(level.solution.map((c, r) => r * level.size + c))
        for (const step of proof.steps) {
          expect(step.targets.length).toBeGreaterThan(0)
          step.targets.forEach((i) => expect(solution.has(i), `${level.id}: ${step.technique} at ${i}`).toBe(step.action === 'place'))
        }
        expect(new Set(proof.placed)).toEqual(solution)
        expect(level.rating).toEqual({ rank: proof.rank, score: proof.score, deductions: proof.deductions, steps: proof.rounds, techniques: [...new Set(proof.steps.map((s) => s.technique))] })
        scores.push(proof.score)
      }
      const chapterMeans = Array.from({ length: 10 }, (_, i) => scores.slice(i * 10, i * 10 + 10).reduce((sum, score) => sum + score, 0) / 10)
      expect(chapterMeans).toEqual([...chapterMeans].sort((a, b) => a - b))
      chapterMeans.slice(1).forEach((mean, i) => expect(mean).toBeGreaterThan(chapterMeans[i]))
    }
  }, 30000)
  it('requires the advertised advanced techniques rather than merely displaying their shapes', () => {
    for (const mode of ['basic', 'normal'] as const) expect(levelsByDifficulty[mode].filter((l) => l.rating!.rank === 3).length).toBeGreaterThanOrEqual(10)
    const advanced = levelsByDifficulty.challenge.filter((l) => l.rating!.rank === 4)
    expect(advanced.length).toBeGreaterThanOrEqual(20)
    for (const l of advanced) expect(solveLogically(l, 3).solved).toBe(false)
  })
  it('avoids similar layouts, repeated answers and repeated deduction openings within nearby levels', () => {
    for (const [mode, group] of Object.entries(levelsByDifficulty)) {
      const audit = catalogueAudit.modes[mode as keyof typeof catalogueAudit.modes]
      expect(audit.levels).toHaveLength(100)
      const proofs = group.map((level) => solveLogically(level))
      for (const [index, level] of group.entries()) {
        const record = audit.levels[index]
        expect(record.id).toBe(level.id)
        expect(record.opening).toBe(deductionOpening(proofs[index].steps))
        expect(record.location).toBe(openingLocation(proofs[index].steps, level.size))
        const recent = group.slice(Math.max(0, index - 10), index)
        expect(recent.every((previous) => previous.solution.join(',') !== level.solution.join(',')), level.id).toBe(true)
        recent.forEach((previous) => expect(layoutSimilarity(previous, level), `${previous.id} vs ${level.id}`).toBeLessThanOrEqual(.85))
        const previous = audit.levels[index - 1]
        if (previous) {
          expect(record.location, level.id).not.toBe(previous.location)
          if (record.opening !== 'single-only') expect(record.opening, level.id).not.toBe(previous.opening)
        }
        expect(audit.levels.slice(Math.max(0, index - 10), index).filter((p) => p.family === record.family).length).toBeLessThan(2)
        if (record.opening !== 'single-only') expect(audit.levels.slice(Math.max(0, index - 10), index).filter((p) => p.opening === record.opening).length).toBeLessThan(3)
      }
    }
  }, 30000)
  it('introduces useful techniques early instead of repeating the same easy start for twenty levels', () => {
    expect(levelsByDifficulty.basic.slice(0, 5).every((l) => l.rating!.rank === 0)).toBe(true)
    expect(levelsByDifficulty.basic.slice(5, 20).every((l) => l.rating!.rank > 0)).toBe(true)
    const basic = new Set(levelsByDifficulty.basic.slice(0, 20).flatMap((l) => l.rating!.techniques))
    for (const technique of ['line', 'pair', 'triple']) expect(basic.has(technique), technique).toBe(true)
    const normal = new Set(levelsByDifficulty.normal.slice(0, 10).flatMap((l) => l.rating!.techniques))
    for (const technique of ['line', 'reverse', 'pair', 'triple', 'bend']) expect(normal.has(technique), technique).toBe(true)
    expect(levelsByDifficulty.normal[22].rating!.techniques).toContain('hall3')
    expect(levelsByDifficulty.challenge.slice(0, 10).filter((l) => l.rating!.rank === 3)).toHaveLength(4)
    expect(levelsByDifficulty.challenge[2].rating!.techniques).toContain('hall2')
    expect(levelsByDifficulty.challenge.slice(80).every((l) => !solveLogically(l, 3).solved)).toBe(true)
  })
  it('rejects disconnected regions', () => {
    const regions = [0, 1, 2, 3, 4, 0, ...Array.from({ length: 30 }, (_, i) => i % 6 === 0 ? 1 : i % 6)]
    const level = { ...levels[0], regions }
    expect(validateRegionConnectivity(level).valid).toBe(false)
    expect(validateLevel(level).valid).toBe(false)
  })
})
