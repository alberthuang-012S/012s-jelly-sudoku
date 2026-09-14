import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { tutorialLevels, TUTORIAL_KEY } from '../data/tutorial'
import { assets } from '../config/assets'
import { REGION_PALETTE } from '../config/regionPalette'
import { getConflicts, getConstraintOverlay, isAdjacent, isBoardSolved } from '../game/rules'
import { getBrowserStorage } from '../storage/storage'
import type { CellState } from '../types/game'

function initialBoard(index: number): CellState[] {
  const level = tutorialLevels[index]
  return Array.from({ length: level.size ** 2 }, (_, i) => index === 2 && i === 7 ? 'jelly' : 'empty')
}
function readCompleted(): number[] {
  try {
    const value: unknown = JSON.parse(getBrowserStorage()?.getItem(TUTORIAL_KEY) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < 4))] : []
  } catch { return [] }
}

export function TutorialScreen({ onExit, onStart }: { onExit: () => void; onStart: () => void }) {
  const [index, setIndex] = useState(0)
  const [board, setBoard] = useState<CellState[]>(() => initialBoard(0))
  const [completed, setCompleted] = useState(readCompleted)
  const [assist, setAssist] = useState(true)
  const [step, setStep] = useState(0)
  const [hint, setHint] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [conflicts, setConflicts] = useState<number[]>([])
  const [solved, setSolved] = useState(false)
  const [focus, setFocus] = useState(0)
  const cells = useRef<Array<HTMLButtonElement | null>>([])
  const feedback = useRef<HTMLHeadingElement>(null)
  const level = tutorialLevels[index]
  const overlay = assist ? getConstraintOverlay(board, level) : new Set<number>()
  useEffect(() => { if (solved) feedback.current?.focus() }, [solved])

  const open = (next: number) => {
    setIndex(next); setBoard(initialBoard(next)); setStep(0); setHint(null)
    setMessage(''); setConflicts([]); setSolved(false); setFocus(0)
  }
  const cycle = (i: number) => {
    if (solved || (index === 2 && i === 7)) return
    setBoard((current) => current.map((state, cell) => cell === i ? state === 'empty' ? 'marked' : state === 'marked' ? 'jelly' : 'empty' : state))
    setMessage(''); setConflicts([]); setHint(null)
  }
  const submit = () => {
    if (solved) return
    if (!isBoardSolved(board, level)) {
      const errors = getConflicts(board, level)
      setConflicts([...new Set(errors.flatMap((error) => error.cells))])
      const count = board.filter((cell) => cell === 'jelly').length
      setMessage(errors[0]?.message ?? `這一關需要 ${level.size} 隻水母，目前有 ${count} 隻。可以繼續修改或使用提示。`)
      return
    }
    setSolved(true); setConflicts([]); setMessage('')
    const next = [...new Set([...completed, index])]
    setCompleted(next)
    try { getBrowserStorage()?.setItem(TUTORIAL_KEY, JSON.stringify(next)) } catch { /* Tutorial remains usable without storage. */ }
  }
  const requestHint = () => {
    const target = level.solution.map((column, row) => row * level.size + column).find((i) => board[i] !== 'jelly')
    if (target === undefined) { setMessage('水母位置已齊全，請按「提交答案」確認。'); return }
    setHint(target)
    setMessage(`試試第 ${Math.floor(target / level.size) + 1} 行、第 ${target % level.size + 1} 列的發亮格子。`)
  }
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const offsets: Record<string, number> = { ArrowUp: -level.size, ArrowDown: level.size, ArrowLeft: -1, ArrowRight: 1 }
    if (!(event.key in offsets)) return
    event.preventDefault()
    const next = i + offsets[event.key]
    if (next < 0 || next >= board.length || ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && Math.floor(next / level.size) !== Math.floor(i / level.size))) return
    setFocus(next); cells.current[next]?.focus()
  }
  const directions = index === 0 ? [
    board[1] === 'empty' ? '先點箭頭指向的單格區域：第一次點擊會出現 ×，代表排除標記。' : board[1] === 'marked' ? '再點同一格一次，× 就會變成水母；再點一次則回到空白。' : '這個顏色只有一格，所以水母就在這裡；接著讓其他顏色也各有一隻。',
  ] : index === 1 ? [
    '看框起來的直條區域：水母一定在這一列，因此同列其他顏色不能放水母。',
    '看框起來的橫條區域：水母一定在這一行，因此同行其他顏色不能放水母。',
    '可以點一下加上 ×，也可以切換輔助標示，看看自動排除的位置。',
  ] : index === 2 ? [
    '以水母為中心，九宮格內不能有另一隻水母；周圍八格都要空出來。',
    '棋盤已放好一隻水母，框起來的是牠周圍的格子；棋盤外的部分不用考慮。',
  ] : ['用區域、行列與九宮格規則完成排列，準備好再按「提交答案」。']
  const highlighted = (i: number) => index === 0 ? i === 1 : index === 1 ? step === 0 ? level.regions[i] === 1 : step === 1 && level.regions[i] === 3 : index === 2 && (i === 7 || isAdjacent(i, 7, level.size))

  return <main className="tutorial-page game-page page-wrap">
    <header className="game-header"><button className="icon-button" aria-label="返回首頁" onClick={onExit}>←</button><span>教學模式 · 不計時</span><button className="text-button" onClick={onStart}>跳過教學</button></header>
    <nav className="tutorial-steps" aria-label="教學關卡">{tutorialLevels.map((item, i) => <button key={item.id} onClick={() => open(i)} aria-current={index === i ? 'step' : undefined}>{i + 1}. {item.title}{completed.includes(i) ? ' ✓' : ''}</button>)}</nav>
    <h1>{level.title}</h1>
    <section className="tutorial-guide" aria-label="教學說明"><p aria-live="polite">{directions[Math.min(step, directions.length - 1)]}</p>{directions.length > 1 && <button className="text-button" onClick={() => setStep((step + 1) % directions.length)}>下一個說明 →</button>}</section>
    {index === 2 && <div className="nine-example" role="img" aria-label="九宮格示意：水母位於正中央，周圍八格都不能放另一隻">{Array.from({ length: 9 }, (_, i) => <span key={i}>{i === 4 ? <img src={assets.jellyCute} alt="" /> : '×'}</span>)}</div>}
    <div className="assist-toolbar"><span>第 {index + 1} / 4 關 · 每個顏色各一隻</span><button className="assist-toggle" role="switch" aria-checked={assist} onClick={() => setAssist(!assist)}>輔助標示 {assist ? '開' : '關'}</button></div>
    <div className="board-shell"><div className="game-board" style={{ '--board-size': level.size } as CSSProperties} role="group" aria-label="教學棋盤">{board.map((state, i) => {
      const region = level.regions[i], row = Math.floor(i / level.size), column = i % level.size
      const fixed = index === 2 && i === 7
      return <button key={`${index}-${i}`} ref={(el) => { cells.current[i] = el }} className={`board-cell state-${state} ${overlay.has(i) && state === 'empty' ? 'is-blocked' : ''} ${highlighted(i) ? 'tutorial-highlight' : ''} ${hint === i ? 'is-hinted' : ''} ${conflicts.includes(i) ? 'has-conflict' : ''}`} style={{ '--region-color': REGION_PALETTE[level.palette?.[region] ?? region].color, borderTop: row === 0 || level.regions[i - level.size] !== region ? '3px solid #554e67' : undefined, borderLeft: column === 0 || level.regions[i - 1] !== region ? '3px solid #554e67' : undefined } as CSSProperties} tabIndex={focus === i ? 0 : -1} aria-disabled={fixed || solved} aria-label={`第 ${row + 1} 行，第 ${column + 1} 列，${REGION_PALETTE[level.palette?.[region] ?? region].name}區域，${fixed ? '預先放好的水母' : state === 'jelly' ? '水母' : state === 'marked' ? '排除標記' : '空白'}`} onFocus={() => setFocus(i)} onKeyDown={(e) => keyDown(e, i)} onClick={() => cycle(i)}>
        {state === 'jelly' && <img className="jelly-token" src={assets.jellyCute} alt="" />}{state === 'marked' && <span className="mark-x" aria-hidden="true">×</span>}{overlay.has(i) && state === 'empty' && <span className="constraint-dot" aria-hidden="true" />}{hint === i && <span className="hint-star" aria-hidden="true">✦</span>}{index === 0 && i === 1 && state === 'empty' && <span className="tutorial-arrow" aria-hidden="true">↓</span>}
      </button>
    })}</div></div>
    <p className="board-help">點擊循環：空白 → × → 水母 → 空白</p>
    <p className="tutorial-feedback" role="status">{message || '作答途中不判定對錯，提交後才檢查。'}</p>
    {solved ? <section className="tutorial-success"><h2 ref={feedback} tabIndex={-1}>{index === 3 ? '教學完成！' : '這一關完成了！'}</h2><p>{index === 3 ? '準備好讓更多水母找到位置了嗎？' : '記住這個線索，接著練習下一個規則。'}</p><button className="button primary" onClick={() => index === 3 ? onStart() : open(index + 1)}>{index === 3 ? '開始基礎第一關' : '下一個教學'}</button><button className="text-button" onClick={onExit}>返回首頁</button></section> : <div className="tutorial-actions"><button className="button primary" onClick={submit}>提交答案</button><button className="button secondary" onClick={requestHint}>提示（不限次數）</button><button className="text-button" onClick={() => open(index)}>重新練習</button></div>}
  </main>
}
