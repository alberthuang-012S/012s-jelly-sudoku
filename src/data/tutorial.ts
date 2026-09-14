import type { Level } from '../types/game'

export const tutorialLevel: Level = {
  id: 'tutorial-single', difficulty: 'basic', size: 4,
  regions: [2, 0, 1, 1, 2, 1, 1, 1, 2, 2, 2, 3, 2, 2, 3, 3],
  solution: [1, 3, 0, 2], palette: [0, 6, 4, 8], title: '一關學會水母數獨',
}
export const TUTORIAL_KEY = 'jellySudokuTutorial.v2'
