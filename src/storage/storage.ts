import type { BestRecord, CellState, Difficulty, LevelProgress, SaveData, Settings } from '../types/game'

export const STORAGE_KEY = 'jellySudokuSave.v1'
export const SAVE_VERSION = 1 as const

const defaultSettings: Settings = { sound: true, vibration: true, assist: true }

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    completed: [],
    unlocked: { basic: 1, normal: 1, challenge: 1 },
    best: {},
    progress: {},
    settings: { ...defaultSettings },
  }
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function isCellState(value: unknown): value is CellState {
  return value === 'empty' || value === 'jelly' || value === 'marked'
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function normalizeProgress(value: unknown): LevelProgress | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<LevelProgress>
  if (!Array.isArray(candidate.cells) || !candidate.cells.every(isCellState)) return null
  if (!isCount(candidate.elapsedSeconds)) return null
  if (!isCount(candidate.mistakes)) return null
  if (!isCount(candidate.hintsRemaining) || candidate.hintsRemaining > 3) return null
  return {
    cells: [...candidate.cells],
    elapsedSeconds: Math.floor(candidate.elapsedSeconds),
    mistakes: Math.floor(candidate.mistakes),
    hintsRemaining: Math.floor(candidate.hintsRemaining),
  }
}

export function loadSave(storage: StorageLike | null | undefined): SaveData {
  const fallback = createDefaultSave()
  if (!storage) return fallback
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return fallback
    const candidate = parsed as Partial<SaveData>
    if (candidate.version !== SAVE_VERSION) return fallback
    const unlocked = candidate.unlocked
    if (!unlocked || typeof unlocked !== 'object') return fallback
    const settings = candidate.settings
    if (!settings || typeof settings !== 'object') return fallback
    const completed = Array.isArray(candidate.completed) && candidate.completed.every((id) => typeof id === 'string') ? candidate.completed : []
    const best: Record<string, BestRecord> = {}
    if (candidate.best && typeof candidate.best === 'object') {
      for (const [id, record] of Object.entries(candidate.best)) {
        if (record && isCount(record.time) && isCount(record.mistakes) && isCount(record.hints) && record.hints <= 3) {
          best[id] = { time: Math.floor(record.time), mistakes: Math.floor(record.mistakes), hints: Math.floor(record.hints) }
        }
      }
    }
    const progress: Record<string, LevelProgress> = {}
    if (candidate.progress && typeof candidate.progress === 'object') {
      for (const [levelId, value] of Object.entries(candidate.progress)) {
        const normalized = normalizeProgress(value)
        if (normalized) progress[levelId] = normalized
      }
    }
    return {
      version: SAVE_VERSION,
      completed: [...new Set(completed)],
      unlocked: {
        basic: isCount(unlocked.basic) ? Math.min(10, Math.max(1, Math.floor(unlocked.basic))) : 1,
        normal: isCount(unlocked.normal) ? Math.min(10, Math.max(1, Math.floor(unlocked.normal))) : 1,
        challenge: isCount(unlocked.challenge) ? Math.min(10, Math.max(1, Math.floor(unlocked.challenge))) : 1,
      },
      best: { ...best },
      progress,
      settings: {
        sound: settings.sound !== false,
        vibration: settings.vibration !== false,
        assist: settings.assist !== false,
      },
    }
  } catch {
    return fallback
  }
}

export function saveData(storage: StorageLike | null | undefined, data: SaveData): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage can be unavailable in private browsing or when quota is exhausted.
  }
}

export function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

export function createEmptyProgress(size: number): LevelProgress {
  return { cells: Array<CellState>(size * size).fill('empty'), elapsedSeconds: 0, mistakes: 0, hintsRemaining: 3 }
}

export function updateLevelProgress(save: SaveData, levelId: string, progress: LevelProgress): SaveData {
  const remaining = Object.fromEntries(Object.entries(save.progress).filter(([id]) => id !== levelId))
  return { ...save, progress: { ...remaining, [levelId]: { ...progress, cells: [...progress.cells] } } }
}

export function updateSettings(save: SaveData, settings: Settings): SaveData {
  return { ...save, settings: { ...settings } }
}

export function markLevelCompleted(save: SaveData, levelId: string, difficulty: Difficulty, levelNumber: number, record: { time: number; mistakes: number; hints: number }, levelCount: number): SaveData {
  const completed = save.completed.includes(levelId) ? save.completed : [...save.completed, levelId]
  const previous = save.best[levelId]
  const shouldUpdate = !previous || record.time < previous.time || (record.time === previous.time && record.mistakes < previous.mistakes)
  return {
    ...save,
    completed,
    unlocked: { ...save.unlocked, [difficulty]: Math.min(levelCount, Math.max(save.unlocked[difficulty], levelNumber + 1)) },
    best: shouldUpdate ? { ...save.best, [levelId]: record } : save.best,
    progress: Object.fromEntries(Object.entries(save.progress).filter(([id]) => id !== levelId)),
  }
}
