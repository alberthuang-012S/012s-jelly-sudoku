import { expect, it } from 'vitest'
import { lessons, teachingScenes, teachingPoses, poseExclusions, boardCells, quizCell, conflict, LESSON_TIERS, combinationProof, trialFrame, inspectTrial } from './lessons'
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
      expect(scene.board.every((cell) => cell === 'empty'), `${technique}: no hidden prior deductions`).toBe(true)
      expect(scene.targets.length).toBeGreaterThan(0)
      expect(scene.targets.every((i) => !solution.has(i)), technique).toBe(true)
      expect(scene.board.every((state, i) => state !== 'jelly' || solution.has(i))).toBe(true)
      expect(scene.board.every((state, i) => state !== 'marked' || !solution.has(i))).toBe(true)
      if (technique !== 'reverse') for (const group of scene.groups) {
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
  for (const { technique } of lessons) for (const scene of teachingScenes[technique]) {
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
it('shows combination exclusions that neither colour can prove alone, with a verifiable contradiction', () => {
  for (const scene of teachingScenes.combination) for (const target of scene.targets) {
    expect(scene.groups.some((group) => group.every((a) => conflict(scene, a, target)))).toBe(false)
    const proof = combinationProof(scene, target)
    expect(proof.groups.every((group) => group.length > 0)).toBe(true)
    expect(proof.column !== undefined || proof.row !== undefined).toBe(true)
    expect(proof.groups[0].every((a) => proof.groups[1].every((b) => conflict(scene, a, b)))).toBe(true)
  }
})

it('separates temporary trial deductions from proven results and restores both trial outcomes', () => {
  for (const [exercise, scene] of teachingScenes.combination.entries()) {
    const snapshot = JSON.stringify(scene), q = quizCell(scene, 'combination', exercise)
    expect(inspectTrial(scene, q).contradiction).toBe(exercise === 0)
    expect(trialFrame(scene, q, 0).blocked).toEqual([])
    expect(trialFrame(scene, q, 1).pose).toEqual([q])
    expect(trialFrame(scene, q, 1).blocked).toEqual([])
    const rowOnly = trialFrame(scene, q, 2).blocked
    expect(rowOnly).toEqual(boardCells(scene).filter((i) => i !== q && Math.floor(i / scene.level.size) === Math.floor(q / scene.level.size)))
    for (let step = 2; step < 5; step++) expect(trialFrame(scene, q, step).blocked.every((i) => trialFrame(scene, q, step + 1).blocked.includes(i))).toBe(true)
    expect(trialFrame(scene, q, 5).blocked).toEqual(boardCells(scene).filter((i) => conflict(scene, q, i)))
    expect(trialFrame(scene, q, 7).pose).toEqual([])
    expect(trialFrame(scene, q, 7).hypothesis).toBeUndefined()
    expect(trialFrame(scene, q, 7).blocked).toEqual([])
    expect(trialFrame(scene, q, 8).blocked).toEqual(exercise === 0 ? [q] : [])
    if (exercise === 1) expect(teachingPoses(scene, 'combination').some((pose) => pose.every((i) => !conflict(scene, q, i)))).toBe(true)
    expect(JSON.stringify(scene)).toBe(snapshot)
  }
})
