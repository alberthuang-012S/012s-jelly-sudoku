import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { tutorialLevels, TUTORIAL_KEY } from '../data/tutorial'
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
  expect(host.querySelector('.tutorial-guide')?.textContent).toContain('第一次點擊')
  click('.board-cell:nth-child(2)')
  expect(host.querySelector('.tutorial-guide')?.textContent).toContain('再點同一格')
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

it('completes all four tutorials independently and starts basic level one', () => {
  tutorialLevels.forEach((level, index) => {
    level.solution.forEach((column, row) => {
      const i = row * level.size + column
      if (index === 2 && i === 7) return
      const selector = `.board-cell:nth-child(${i + 1})`
      click(selector); click(selector)
    })
    expect(host.querySelector('.tutorial-success')).toBeNull()
    click('.tutorial-actions .primary')
    expect(host.querySelector('.tutorial-success')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(TUTORIAL_KEY)!)).toContain(index)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    click('.tutorial-success .primary')
  })
  expect(host.querySelector('.tutorial-page')).toBeNull()
  expect(host.querySelector('.game-heading .eyebrow')?.textContent).toContain('LEVEL 01')
  expect(host.querySelectorAll('.board-cell')).toHaveLength(36)
  click('[aria-label="返回關卡列表"]')
  click('[aria-label="返回首頁"]')
  click('.tutorial-entry')
  expect(host.querySelector('.tutorial-steps')?.textContent?.match(/✓/g)).toHaveLength(4)
})

it('keeps the demonstration jelly fixed and permits assistance toggling and skipping', () => {
  click('.tutorial-steps button:nth-child(3)')
  expect(host.querySelectorAll('.nine-example span')).toHaveLength(9)
  click('.board-cell:nth-child(8)')
  expect(host.querySelector('.board-cell:nth-child(8)')?.classList.contains('state-jelly')).toBe(true)
  click('.assist-toggle')
  expect(host.querySelectorAll('.is-blocked')).toHaveLength(0)
  click('.game-header .text-button')
  expect(host.querySelector('.game-heading .eyebrow')?.textContent).toContain('LEVEL 01')
  expect(localStorage.getItem(TUTORIAL_KEY)).toBeNull()
})
