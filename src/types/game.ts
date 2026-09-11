export type Difficulty = 'basic' | 'normal' | 'challenge'

export type CellState = 'empty' | 'jelly' | 'marked'

export type ModalName = 'restart' | 'settings' | 'rules' | 'clear' | null

export interface Level {
  id: string
  difficulty: Difficulty
  size: number
  regions: number[]
  /** Region ID → palette index. Generated with the level's adjacency graph. */
  palette?: number[]
  /** One column index for each row, in solution row order. */
  solution: number[]
  title: string
}

export interface PlacementConflict {
  type: 'row' | 'column' | 'region' | 'adjacent'
  cells: number[]
  message: string
}

export interface BestRecord {
  time: number
  mistakes: number
  hints: number
}

export interface LevelProgress {
  cells: CellState[]
  elapsedSeconds: number
  mistakes: number
  hintsRemaining: number
}

export interface Settings {
  sound: boolean
  vibration: boolean
  assist: boolean
}

export interface SaveData {
  version: 1
  completed: string[]
  unlocked: Record<Difficulty, number>
  best: Record<string, BestRecord>
  progress: Record<string, LevelProgress>
  settings: Settings
}

export const DIFFICULTY_META: Record<Difficulty, { label: string; english: string; size: number; accent: string }> = {
  basic: { label: '基礎', english: 'Calm Current', size: 6, accent: '#f7c96b' },
  normal: { label: '普通', english: 'Tide Trail', size: 8, accent: '#8fcfd1' },
  challenge: { label: '挑戰', english: 'Deep Dive', size: 10, accent: '#a99bdd' },
}

export const CELL_STATES: CellState[] = ['empty', 'jelly', 'marked']
