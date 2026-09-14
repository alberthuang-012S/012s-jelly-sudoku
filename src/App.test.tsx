import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

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
  click('[aria-label="返回關卡列表"]')
  click('[aria-label="返回首頁"]')
  expect(host.querySelector('.resume-card')).not.toBeNull()
  click('.resume-card')
  expect(host.querySelectorAll('.state-jelly')).toHaveLength(1)
})
it('toggles automatic assistance immediately and remembers the choice', () => {
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
