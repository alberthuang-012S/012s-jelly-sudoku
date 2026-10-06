import { expect, it } from 'vitest'
import { lessons, teachingScenes, teachingPoses, poseExclusions, boardCells, quizCell, conflict, LESSON_TIERS, trialFrames, confirmedCells, outsideProof } from './lessons'
import { traceTrial, trialStart } from '../game/trial'
import { isBoardSolved } from '../game/rules'
import { validateLevel } from '../game/validator'

it('uses two distinct valid untouched puzzles and every cell of each teaching colour', () => {
  expect(lessons).toHaveLength(9)
  for (const { technique } of lessons) {
    const scenes = teachingScenes[technique]
    expect(scenes[0].level.id).not.toBe(scenes[1].level.id)
    for (const scene of scenes) {
      expect(validateLevel(scene.level).errors, technique).toEqual([])
      const solution = new Set(scene.level.solution.map((c, r) => r * scene.level.size + c))
      expect(scene.board).toHaveLength(scene.level.size ** 2)
      if (technique !== 'combination') expect(scene.board.every((cell) => cell === 'empty'), `${technique}: no hidden prior deductions`).toBe(true)
      expect(scene.targets.length).toBeGreaterThan(0)
      expect(scene.targets.every((i) => !solution.has(i)), technique).toBe(true)
      expect(scene.board.every((state, i) => state !== 'jelly' || solution.has(i))).toBe(true)
      expect(scene.board.every((state, i) => state !== 'marked' || !solution.has(i))).toBe(true)
      if (!['reverse', 'combination'].includes(technique)) for (const group of scene.groups) {
        const region = scene.level.regions[group[0]]
        const entireColour = scene.level.regions.flatMap((id, i) => id === region ? [i] : [])
        expect(entireColour.sort((a, b) => a - b), `${technique}: the entire colour`).toEqual([...group].sort((a, b) => a - b))
      }
      if (technique === 'reverse') {
        const row = Math.floor(scene.sources[0] / scene.level.size)
        expect(scene.sources).toEqual(boardCells(scene).filter((i) => Math.floor(i / scene.level.size) === row))
        expect(new Set(scene.sources.map((i) => scene.level.regions[i])).size).toBe(1)
      }
    }
  }
})
it('never shows a shared cross that a displayed legal arrangement could occupy', () => {
  for (const { technique } of lessons.filter((l) => l.technique !== 'combination')) for (const scene of teachingScenes[technique]) {
    const poses = teachingPoses(scene, technique)
    expect(poses.length, technique).toBeGreaterThan(0)
    for (const pose of poses) {
      expect(pose.every((a, j) => pose.slice(j + 1).every((b) => !conflict(scene, a, b)))).toBe(true)
      const blocked = poseExclusions(scene, technique, pose)
      expect(scene.targets.every((i) => blocked.includes(i)), technique).toBe(true)
    }
  }
})
it('teaches four pair side cells, two triple side cells, and genuine two/three-row reservations', () => {
  for (const scene of teachingScenes.pair) expect(scene.targets).toHaveLength(4)
  for (const scene of teachingScenes.triple) expect(scene.targets).toHaveLength(2)
  for (const scene of teachingScenes.zigzag) expect(scene.targets).toHaveLength(2)
  for (const technique of ['hall2', 'hall3'] as const) for (const scene of teachingScenes[technique]) {
    expect(teachingPoses(scene, technique).length).toBeGreaterThanOrEqual(2)
    const rows = new Set(scene.sources.map((i) => Math.floor(i / scene.level.size)))
    expect(rows.size).toBe(scene.groups.length)
    expect(scene.groups.length).toBe(technique === 'hall2' ? 2 : 3)
    expect(scene.targets.every((i) => rows.has(Math.floor(i / scene.level.size)))).toBe(true)
  }
})
it('keeps each question visible and ensures negative answers survive a possible arrangement', () => {
  let negativeExamples = 0
  for (const { technique } of lessons) for (let exercise = 0; exercise < 2; exercise++) {
    const scene = teachingScenes[technique][exercise], i = quizCell(scene, technique, exercise)
    expect(boardCells(scene)).toContain(i)
    expect(scene.board[i]).toBe('empty')
    if (exercise === 0) expect(scene.targets).toContain(i)
    if (!scene.targets.includes(i)) {
      negativeExamples++
      expect(teachingPoses(scene, technique).some((pose) => pose.every((a) => !conflict(scene, a, i))), technique).toBe(true)
    }
  }
  expect(negativeExamples).toBeGreaterThanOrEqual(6)
})
it('uses the requested basic and advanced curriculum without an introductory level or common-zone lesson', () => {
  expect(LESSON_TIERS.map((tier) => tier.id)).toEqual(['basic', 'advanced', 'challenge'])
  expect(LESSON_TIERS[0].techniques).toEqual(['line', 'pair', 'triple'])
  expect(LESSON_TIERS[1].techniques).toEqual(['bend', 'zigzag', 'reverse'])
  const assigned = LESSON_TIERS.flatMap((tier) => tier.techniques)
  expect(assigned).toHaveLength(9)
  expect(new Set(assigned).size).toBe(9)
  expect(assigned.sort()).toEqual(lessons.map((lesson) => lesson.technique).sort())
})
it('includes both outside L cells in addition to its inner corner', () => {
  for (const scene of teachingScenes.bend) {
    expect(scene.targets).toHaveLength(3)
    const n = scene.level.size
    const adjacentToAll = scene.targets.filter((i) => scene.sources.every((a) => Math.max(Math.abs(Math.floor(i / n) - Math.floor(a / n)), Math.abs(i % n - a % n)) <= 1))
    expect(adjacentToAll).toHaveLength(1)
    const omitted = boardCells(scene).filter((i) => !scene.sources.includes(i) && scene.level.regions[i] !== scene.level.regions[scene.sources[0]] && scene.sources.every((a) => conflict(scene, a, i)))
    expect([...scene.targets].sort((a, b) => a - b)).toEqual(omitted.sort((a, b) => a - b))
  }
})
it('uses a two-choice endgame, follows forced deductions, disproves A and solves from B', () => {
  for (const scene of teachingScenes.combination) {
    const snapshot = JSON.stringify(scene), confirmed = confirmedCells(scene), [a, b] = scene.sources
    const { context, state } = trialStart(scene.level, confirmed)
    expect(scene.endgame).toBe(true)
    expect(confirmed).toHaveLength(scene.level.size - 3)
    expect(scene.board).not.toContain('marked')
    expect(scene.level.regions[a]).toBe(scene.level.regions[b])
    expect([...state.candidates].filter((i) => scene.level.regions[i] === scene.level.regions[a])).toEqual([...scene.sources].sort((x, y) => x - y))
    expect(context.units.filter((u) => !u.cells.some((i) => state.placed.has(i))).every((u) => u.cells.filter((i) => state.candidates.has(i)).length >= 2)).toBe(true)
    const bad = traceTrial(scene.level, confirmed, a), good = traceTrial(scene.level, confirmed, b)
    expect(bad.additions.length).toBeGreaterThan(1)
    expect(bad.failure).toBeDefined()
    const failed = trialStart(scene.level, [...confirmed, ...bad.additions.map((x) => x.cell)]).state
    expect(bad.failure!.cells.some((i) => failed.candidates.has(i) || failed.placed.has(i))).toBe(false)
    expect(good.solved).toBe(true)
    const completed = new Set([...confirmed, ...good.additions.map((x) => x.cell)])
    expect(isBoardSolved(scene.board.map((_, i) => completed.has(i) ? 'jelly' : 'empty'), scene.level)).toBe(true)
    // Runtime inference must not use the stored answer.
    expect(traceTrial({ ...scene.level, solution: [] }, confirmed, a)).toEqual(bad)
    expect(traceTrial({ ...scene.level, solution: [] }, confirmed, b)).toEqual(good)
    expect(() => traceTrial(scene.level, confirmed, confirmed[0])).toThrow('not a candidate')
    for (const trace of [bad, good]) {
      for (let j = 1; j < trace.additions.length; j++) {
        const prior = trialStart(scene.level, [...confirmed, ...trace.additions.slice(0, j).map((x) => x.cell)]).state
        const addition = trace.additions[j]
        expect(addition.unit.filter((i) => prior.candidates.has(i))).toEqual([addition.cell])
      }
    }
    const frames = trialFrames(scene), restored = frames.find((f) => f.kind === 'restore')!
    expect(restored.pose).toEqual([])
    expect(restored.blocked).toEqual([])
    expect(restored.hypothesis).toBeUndefined()
    expect(frames.find((f) => f.kind === 'confirm')!.pose).toEqual([b])
    expect(frames.find((f) => f.kind === 'confirm')!.blocked).toEqual([a])
    expect(frames.at(-1)!.kind).toBe('finish')
    expect(frames.filter((f) => f.confirmed).every((f) => f.blocked.includes(a) && !f.blocked.includes(b))).toBe(true)
    expect(JSON.stringify(scene)).toBe(snapshot)
  }
})

it('proves L and Z outside exclusions by blocking their entire colour, but leaves negative examples possible', () => {
  for (const technique of ['bend', 'zigzag'] as const) for (const [exercise, scene] of teachingScenes[technique].entries()) {
    for (const cell of scene.targets) {
      const proof = outsideProof(scene, cell)
      expect(proof.contradiction).toBe(true)
      expect(proof.blocked).toEqual(scene.sources)
      expect(scene.level.regions[cell]).not.toBe(scene.level.regions[scene.sources[0]])
    }
    if (exercise === 1) {
      const proof = outsideProof(scene, quizCell(scene, technique, exercise))
      expect(proof.contradiction).toBe(false)
      expect(proof.blocked.length).toBeLessThan(scene.sources.length)
    }
  }
})
