import type { Level } from '../types/game'
import { solveLogically } from './logic'

export function analyzeLogicalDifficulty(level: Level, maxRank = 4) {
  const { solved, deductions, rounds, rank, score, steps } = solveLogically(level, maxRank)
  return { solved, deductions, rounds, rank, score, techniques: [...new Set(steps.map((step) => step.technique))] }
}
