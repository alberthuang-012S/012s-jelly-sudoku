import type { Level } from '../types/game'
import { isAdjacent } from './rules'

/** Only forced placements and shared exclusions; never search or read the solution. */
export function analyzeLogicalDifficulty(level: Level) {
  const { size, regions } = level
  let candidates = new Set(regions.map((_, index) => index))
  const placed = new Set<number>()
  const units = [
    ...Array.from({ length: size }, (_, row) => regions.flatMap((_, i) => Math.floor(i / size) === row ? [i] : [])),
    ...Array.from({ length: size }, (_, column) => regions.flatMap((_, i) => i % size === column ? [i] : [])),
    ...Array.from({ length: size }, (_, region) => regions.flatMap((r, i) => r === region ? [i] : [])),
  ]
  const conflicts = (a: number, b: number) => Math.floor(a / size) === Math.floor(b / size) || a % size === b % size || regions[a] === regions[b] || isAdjacent(a, b, size)
  let deductions = 0
  let rounds = 0
  while (placed.size < size) {
    rounds += 1
    let changed = false
    for (const unit of units) {
      if (unit.some((index) => placed.has(index))) continue
      const choices = unit.filter((index) => candidates.has(index))
      if (!choices.length) return { solved: false, deductions, rounds }
      if (choices.length === 1) {
        placed.add(choices[0])
        candidates = new Set([...candidates].filter((index) => !conflicts(choices[0], index)))
        changed = true
      } else {
        const removed = [...candidates].filter((index) => !unit.includes(index) && choices.every((choice) => conflicts(choice, index)))
        if (removed.length) {
          removed.forEach((index) => candidates.delete(index))
          deductions += 1
          changed = true
        }
      }
    }
    if (!changed) return { solved: false, deductions, rounds }
  }
  return { solved: true, deductions, rounds }
}
