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
