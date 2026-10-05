import type { Difficulty, Level } from '../../types/game'
import staticLevelData from './generated-levels.json'

// Authored offline by scripts/generate_catalogue.mjs; loading never generates puzzles.
export const levels: Level[] = staticLevelData as Level[]
export const levelsByDifficulty: Record<Difficulty, Level[]> = {
  basic: levels.filter((level) => level.difficulty === 'basic'),
  normal: levels.filter((level) => level.difficulty === 'normal'),
  challenge: levels.filter((level) => level.difficulty === 'challenge'),
}
export const chapterDescriptions: Record<Difficulty, string[]> = {
  basic: ['從唯一位置到直線', '兩格與三格排除', '交錯觀察形狀', '把排除接起來', '換個位置找線索', '延長推理連鎖', '比較多處線索', '形狀與鎖定綜合', '初探多色鎖定', '基礎綜合練習'],
  normal: ['直線與形狀交錯', '接上雙色鎖定', '加入三色鎖定', '多處線索交接', '形狀與多色排除', '延長推理連鎖', '交替使用鎖定', '找出關鍵排除', '多色鎖定綜合', '普通綜合練習'],
  challenge: ['雙色鎖定起步', '加入三色鎖定', '交錯多色推理', '深化鎖定連鎖', '初探兩區組合', '穿插組合排除', '多處組合線索', '鎖定與組合交接', '兩區組合進階', '挑戰綜合練習'],
}
export function getLevel(levelId: string): Level | undefined {
  return levels.find((level) => level.id === levelId)
}
