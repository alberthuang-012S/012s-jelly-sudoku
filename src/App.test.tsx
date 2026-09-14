import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { levelsByDifficulty } from './data/levels'

let host: HTMLDivElement
let root: Root
const click = (selector: string) => act(() => { host.querySelector<HTMLButtonElement>(selector)!.click() })
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<App />))
  click('.mode-basic')
  click('.level-card:not(:disabled)')
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

it('pauses in dialogs and hidden tabs, restores focus, and resumes the timer', () => {
  advance(2000)
  expect(host.querySelector('.timer-box strong')?.textContent).toBe('00:02')
  const settings = host.querySelector<HTMLButtonElement>('[aria-label="設定"]')!
  act(() => settings.focus())
  click('[aria-label="設定"]')
  expect(document.activeElement?.getAttribute('aria-label')).toBe('關閉')
  advance(3000)
  expect(host.querySelector('.timer-box strong')?.textContent).toBe('00:02')
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  expect(host.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(settings)
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  advance(3000)
  expect(host.querySelector('.timer-box strong')?.textContent).toBe('00:02')
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  advance(1000)
  expect(host.querySelector('.timer-box strong')?.textContent).toBe('00:03')
})

it('uses one keyboard tab stop and restores progress from the home resume action', () => {
  expect(host.querySelectorAll('.board-cell[tabindex="0"]')).toHaveLength(1)
  click('.board-cell')
  click('.board-cell')
  click('[aria-label="返回關卡列表"]')
  click('[aria-label="返回首頁"]')
  expect(host.querySelector('.resume-card')).not.toBeNull()
  click('.resume-card')
  expect(host.querySelectorAll('.state-jelly')).toHaveLength(1)
})
it('toggles automatic assistance immediately and remembers the choice', () => {
  click('.board-cell')
  click('.board-cell')
  expect(host.querySelectorAll('.is-blocked').length).toBeGreaterThan(0)
  click('.assist-toggle')
  expect(host.querySelector('.assist-toggle')?.getAttribute('aria-checked')).toBe('false')
  expect(host.querySelectorAll('.is-blocked')).toHaveLength(0)
  click('[aria-label="返回關卡列表"]')
  click('.level-card:not(:disabled)')
  expect(host.querySelector('.assist-toggle')?.getAttribute('aria-checked')).toBe('false')
  click('.assist-toggle')
  expect(host.querySelectorAll('.is-blocked').length).toBeGreaterThan(0)
  click('.board-cell')
  expect(host.querySelectorAll('.is-blocked')).toHaveLength(0)
})

it('cycles marks before jellies and only reports conflicts upon submission', () => {
  click('.board-cell')
  expect(host.querySelector('.board-cell')?.classList.contains('state-marked')).toBe(true)
  click('.board-cell')
  click('.board-cell:nth-child(2)')
  click('.board-cell:nth-child(2)')
  expect(host.querySelectorAll('.has-conflict')).toHaveLength(0)
  expect(host.querySelector('.stat-mistake strong')?.textContent).toBe('0')
  click('.submit-answer')
  expect(host.querySelector('.stat-mistake strong')?.textContent).toBe('1')
  expect(host.querySelectorAll('.has-conflict').length).toBeGreaterThan(0)
  click('.board-cell')
  expect(host.querySelector('.board-cell')?.classList.contains('state-empty')).toBe(true)
  expect(host.querySelectorAll('.has-conflict')).toHaveLength(0)
})

it('waits for submission before completing a correct board', () => {
  const level = levelsByDifficulty.basic[0]
  level.solution.forEach((column, row) => {
    const selector = `.board-cell:nth-child(${row * level.size + column + 1})`
    click(selector)
    click(selector)
  })
  advance(1000)
  expect(host.querySelector('[role="dialog"]')).toBeNull()
  expect(host.querySelector('.submit-answer')?.textContent).toBe('提交答案')
  click('.submit-answer')
  advance(600)
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('CLEAR!')
})

it('resets an old-layout board while preserving unlocked progress', () => {
  act(() => root.unmount())
  localStorage.setItem('jellySudokuSave.v1', JSON.stringify({ version: 1, completed: ['basic-001'], unlocked: { basic: 2, normal: 1, challenge: 1 }, best: {}, settings: { sound: false, vibration: false, assist: true }, progress: { 'basic-001': { cells: Array(36).fill('jelly'), elapsedSeconds: 99, mistakes: 2, hintsRemaining: 1 } } }))
  root = createRoot(host)
  act(() => root.render(<App />))
  click('.mode-basic')
  expect(host.querySelectorAll('.level-card:not(:disabled)')).toHaveLength(2)
  click('.level-card:not(:disabled)')
  expect(host.querySelectorAll('.state-jelly')).toHaveLength(0)
  expect(host.querySelector('.timer-box strong')?.textContent).toBe('00:00')
})

it('resets old normal layouts and restores a new normal board with its revision', () => {
  act(() => root.unmount())
  localStorage.setItem('jellySudokuSave.v1', JSON.stringify({ version: 1, completed: ['normal-001'], unlocked: { basic: 1, normal: 2, challenge: 1 }, best: {}, settings: { sound: false, vibration: false, assist: true }, progress: { 'normal-001': { cells: Array(64).fill('jelly'), elapsedSeconds: 99, mistakes: 2, hintsRemaining: 1 } } }))
  root = createRoot(host)
  act(() => root.render(<App />))
  click('.mode-normal')
  expect(host.querySelectorAll('.level-card:not(:disabled)')).toHaveLength(2)
  click('.level-card:not(:disabled)')
  expect(host.querySelectorAll('.state-jelly')).toHaveLength(0)
  expect(host.querySelector('.timer-box strong')?.textContent).toBe('00:00')
  click('.board-cell')
  click('.board-cell')
  click('[aria-label="返回關卡列表"]')
  click('.level-card:not(:disabled)')
  expect(host.querySelectorAll('.state-jelly')).toHaveLength(1)
})

it.each(['basic', 'normal', 'challenge'] as const)('closes every %s completion dialog and finishes level ten', (difficulty) => {
  act(() => root.unmount())
  localStorage.clear()
  root = createRoot(host)
  act(() => root.render(<App />))
  click(`.mode-${difficulty}`)
  levelsByDifficulty[difficulty].forEach((level, index) => {
    click(`.level-card:nth-child(${index + 1})`)
    level.solution.forEach((column, row) => {
      const selector = `.board-cell:nth-child(${row * level.size + column + 1})`
      click(selector)
      click(selector)
    })
    click('.submit-answer')
    advance(600)
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('CLEAR!')
    if (index === 9) {
      expect(host.querySelector('.clear-actions .primary')?.textContent).toContain('完成！')
      click('.clear-actions .primary')
    } else {
      click('[aria-label="關閉"]')
    }
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(host.querySelector('.levels-page')).not.toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
    advance(1000)
    expect(host.querySelector('[role="dialog"]')).toBeNull()
  })
})
