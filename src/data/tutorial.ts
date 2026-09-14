import type { Level } from '../types/game'
import layouts from './tutorial-layouts.json'
import { levelsByDifficulty } from './levels'

export const tutorialLevels: Level[] = [
  ...layouts.map((regions, index) => ({ id: `tutorial-${index + 1}`, difficulty: 'basic' as const, size: 4, regions, solution: [1, 3, 0, 2], palette: [0, 6, 4, 8], title: ['第一隻水母', '直條與橫條', '水母的九宮格'][index] })),
  { ...levelsByDifficulty.basic[2], id: 'tutorial-4', title: '自己完成一關' },
]
export const TUTORIAL_KEY = 'jellySudokuTutorial.v1'
