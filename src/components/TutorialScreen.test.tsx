import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { tutorialLevel, TUTORIAL_KEY } from '../data/tutorial'
import { STORAGE_KEY } from '../storage/storage'
let host: HTMLDivElement
let root: Root
const click = (selector: string) => act(() => { host.querySelector<HTMLButtonElement>(selector)!.click() })
beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<App />))
  click('.tutorial-entry')
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

it('teaches the click cycle and offers unlimited hints without scoring', () => {
  expect(host.querySelector('.tutorial-guide')?.textContent).toContain('點一下是 ×')
  click('.board-cell:nth-child(2)')
  expect(host.querySelector('.tutorial-guide')?.textContent).toContain('再點黃色格')
  click('.board-cell:nth-child(2)')
  expect(host.querySelector('.state-jelly')).not.toBeNull()
  for (let i = 0; i < 6; i++) click('.tutorial-actions .secondary')
  expect(host.querySelector('.is-hinted')).not.toBeNull()
  click('.tutorial-actions .primary')
  expect(host.querySelector('.tutorial-feedback')?.textContent).toContain('目前有')
  act(() => { vi.advanceTimersByTime(60000) })
  expect(host.querySelector('.timer-box')).toBeNull()
  expect(host.querySelector('.stat-mistake')).toBeNull()
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
})

it('finishes a single board, teaches all rules, and starts basic level one', () => {
  expect(host.querySelectorAll('.board-cell')).toHaveLength(16)
  expect(host.querySelector('.tutorial-steps')).toBeNull()
  tutorialLevel.solution.forEach((column, row) => {
    const selector = `.board-cell:nth-child(${row * 4 + column + 1})`
    click(selector); click(selector)
    if (row === 0) expect(host.querySelector('.tutorial-guide')?.textContent).toContain('每一橫排')
    if (row === 1) {
      expect(host.querySelector('.tutorial-guide')?.textContent).toContain('九宮格')
      expect(host.querySelectorAll('.nine-example span')).toHaveLength(9)
    }
  })
  expect(host.querySelector('.tutorial-success')).toBeNull()
  click('.tutorial-actions .primary')
  expect(host.querySelector('.tutorial-success')?.textContent).toContain('教學完成！')
  expect(localStorage.getItem(TUTORIAL_KEY)).toBe('true')
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  click('.tutorial-success .primary')
  expect(host.querySelector('.game-heading .eyebrow')?.textContent).toContain('LEVEL 01')
  click('[aria-label="返回關卡列表"]')
  click('[aria-label="返回首頁"]')
  click('.tutorial-entry')
  expect(host.querySelector('.tutorial-intro')?.textContent).toContain('已完成過')
  expect(host.querySelectorAll('.state-jelly')).toHaveLength(0)
})

it('allows free edits, assistance toggling, restart and skipping without early errors', () => {
  for (const i of [1, 2]) {
    click(`.board-cell:nth-child(${i})`); click(`.board-cell:nth-child(${i})`)
  }
  expect(host.querySelectorAll('.has-conflict')).toHaveLength(0)
  click('.assist-toggle')
  expect(host.querySelectorAll('.is-blocked')).toHaveLength(0)
  click('.tutorial-actions .text-button')
  expect(host.querySelectorAll('.state-jelly')).toHaveLength(0)
  expect(host.querySelector('.tutorial-guide')?.textContent).toContain('黃色只有一格')
  click('.game-header .text-button')
  expect(host.querySelector('.game-heading .eyebrow')?.textContent).toContain('LEVEL 01')
  expect(localStorage.getItem(TUTORIAL_KEY)).toBeNull()
})
