import type { Difficulty, Level } from '../../types/game'
import staticLevelData from './generated-levels.json'

// Authored offline by scripts/generate_catalogue.mjs; loading never generates puzzles.
export const levels: Level[] = staticLevelData as Level[]
export const levelsByDifficulty: Record<Difficulty, Level[]> = {
  basic: levels.filter((level) => level.difficulty === 'basic'),
  normal: levels.filter((level) => level.difficulty === 'normal'),
  challenge: levels.filter((level) => level.difficulty === 'challenge'),
}
export function getLevel(levelId: string): Level | undefined {
  return levels.find((level) => level.id === levelId)
}
