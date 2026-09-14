import { describe, expect, it } from 'vitest'
import { STORAGE_KEY, createDefaultSave, loadSave, saveData } from './storage'

function memoryStorage(initial: string | null = null) {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
    get value() { return value },
  }
}

describe('save adapter', () => {
  it('round trips a save', () => {
    const storage = memoryStorage()
    const save = createDefaultSave()
    save.completed.push('basic-001')
    saveData(storage, save)
    expect(JSON.parse(storage.value ?? '{}')).toHaveProperty('version', 1)
    expect(loadSave(storage).completed).toContain('basic-001')
  })

  it('falls back on corrupted or missing data', () => {
    expect(loadSave(memoryStorage('{bad json'))).toEqual(createDefaultSave())
    expect(loadSave(memoryStorage(null))).toEqual(createDefaultSave())
  })

  it('falls back on an incompatible schema version', () => {
    const storage = memoryStorage(JSON.stringify({ version: 99 }))
    expect(loadSave(storage)).toEqual(createDefaultSave())
    expect(STORAGE_KEY).toBe('jellySudokuSave.v1')
  })
})

it('discards malformed records and non-finite progress while preserving valid data', () => {
  const raw = JSON.stringify({ ...createDefaultSave(), best: { broken: { time: 'bad' }, valid: { time: 12, mistakes: 0, hints: 1 } }, progress: { broken: { cells: ['empty'], elapsedSeconds: 1, mistakes: 0, hintsRemaining: 3 } }, unlocked: { basic: 999, normal: -1, challenge: 'bad' } }).replace('"elapsedSeconds":1', '"elapsedSeconds":1e400')
  const loaded = loadSave(memoryStorage(raw))
  expect(loaded.best).toEqual({ valid: { time: 12, mistakes: 0, hints: 1 } })
  expect(loaded.progress).toEqual({})
  expect(loaded.unlocked).toEqual({ basic: 10, normal: 1, challenge: 1 })
})

it('preserves the puzzle revision in saved progress', () => {
  const save = createDefaultSave()
  save.progress['basic-001'] = { revision: 2, cells: ['marked'], elapsedSeconds: 5, mistakes: 0, hintsRemaining: 3 }
  const storage = memoryStorage()
  saveData(storage, save)
  expect(loadSave(storage).progress['basic-001'].revision).toBe(2)
})
