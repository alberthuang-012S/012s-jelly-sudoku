import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { tutorialLevel, TUTORIAL_KEY } from '../data/tutorial'
import { assets } from '../config/assets'
import { REGION_PALETTE } from '../config/regionPalette'
import { getConflicts, getConstraintOverlay, isBoardSolved } from '../game/rules'
import { getBrowserStorage } from '../storage/storage'
import type { CellState } from '../types/game'

function initialBoard(): CellState[] {
  return Array<CellState>(16).fill('empty')
}
function readCompleted(): boolean {
  try { return getBrowserStorage()?.getItem(TUTORIAL_KEY) === 'true' } catch { return false }
}

export function TutorialScreen({ onExit, onStart }: { onExit: () => void; onStart: () => void }) {
  const [board, setBoard] = useState<CellState[]>(() => initialBoard())
  const [completed, setCompleted] = useState(readCompleted)
  const [assist, setAssist] = useState(true)
  const [hint, setHint] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [conflicts, setConflicts] = useState<number[]>([])
  const [solved, setSolved] = useState(false)
  const [focus, setFocus] = useState(0)
  const cells = useRef<Array<HTMLButtonElement | null>>([])
  const feedback = useRef<HTMLHeadingElement>(null)
  const level = tutorialLevel
  const overlay = assist ? getConstraintOverlay(board, level) : new Set<number>()
  useEffect(() => { if (solved) feedback.current?.focus() }, [solved])

  const restart = () => {
    setBoard(initialBoard()); setHint(null)
    setMessage(''); setConflicts([]); setSolved(false); setFocus(0)
  }
  const cycle = (i: number) => {
    if (solved) return
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
    setCompleted(true)
    try { getBrowserStorage()?.setItem(TUTORIAL_KEY, 'true') } catch { /* Tutorial remains usable without storage. */ }
  }
  const requestHint = () => {
    const target = level.solution.map((column, row) => row * level.size + column).find((i) => board[i] !== 'jelly')
    if (target === undefined) { setMessage('準備好就按「提交答案」，一起看看排列吧。'); return }
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
  const target = level.solution.map((column, row) => row * level.size + column).find((i) => board[i] !== 'jelly')
  const direction = target === 1
    ? board[1] === 'marked' ? '再點黃色格一次，× 就變成水母。' : '黃色只有一格。點一下是 ×，再點一下就放上水母。'
    : target === 7 ? '每一橫排、每一直排都只能有一隻。接著把水母放到箭頭格。'
    : target === 8 ? '以水母為中心，九宮格內不能有另一隻。四個斜角也算喔！'
    : target === 14 ? '最後一隻！讓每種顏色都有一隻水母，再按「提交答案」。'
    : '準備好了嗎？按「提交答案」一起檢查。'

  return <main className="tutorial-page game-page page-wrap">
    <header className="game-header"><button className="icon-button" aria-label="返回首頁" onClick={onExit}>←</button><span>教學模式 · 不計時</span><button className="text-button" onClick={onStart}>跳過教學</button></header>
    <h1>{level.title}</h1>
    <p className="tutorial-intro">把 4 隻水母放進棋盤，就學會了。{completed && ' 已完成過，可以再練一次。'}</p>
    <ul className="tutorial-rules"><li>每種顏色一隻</li><li>每橫排、直排一隻</li><li>水母周圍八格不能有另一隻</li></ul>
    <section className="tutorial-guide" aria-label="教學說明"><p aria-live="polite">{direction}</p></section>
    {target === 8 && <div className="nine-example" role="img" aria-label="以水母為中心的九宮格：周圍八格都不能放另一隻">{Array.from({ length: 9 }, (_, i) => <span key={i}>{i === 4 ? <img src={assets.jellyCute} alt="" /> : '×'}</span>)}</div>}
    <div className="assist-toolbar"><span>箭頭指的格子，可以試試看</span><button className="assist-toggle" role="switch" aria-checked={assist} aria-describedby="tutorial-assist-help" onClick={() => setAssist(!assist)}>輔助標示 {assist ? '開' : '關'}</button></div>
    <div className="tutorial-assist-help" id="tutorial-assist-help">
      <span className="assist-sample" aria-hidden="true"><span className="constraint-dot" /></span>
      <div><p><strong>斜線＋圓點＝這裡先別放。</strong>放上水母後，系統會依牠的位置，自動標出不能再放的空格。</p><p>移動或移除水母，標示也會跟著更新。試試上方開關：關掉後，自己加的 × 還會保留。</p><small>輔助只幫忙排除位置，不代表答案正確；按「提交答案」才檢查。</small></div>
    </div>
    <div className="board-shell"><div className="game-board" style={{ '--board-size': level.size } as CSSProperties} role="group" aria-label="教學棋盤">{board.map((state, i) => {
      const region = level.regions[i], row = Math.floor(i / level.size), column = i % level.size
      return <button key={i} ref={(el) => { cells.current[i] = el }} className={`board-cell state-${state} ${overlay.has(i) && state === 'empty' ? 'is-blocked' : ''} ${target === i ? 'tutorial-highlight' : ''} ${hint === i ? 'is-hinted' : ''} ${conflicts.includes(i) ? 'has-conflict' : ''}`} style={{ '--region-color': REGION_PALETTE[level.palette?.[region] ?? region].color, borderTop: row === 0 || level.regions[i - level.size] !== region ? '3px solid #554e67' : undefined, borderLeft: column === 0 || level.regions[i - 1] !== region ? '3px solid #554e67' : undefined } as CSSProperties} tabIndex={focus === i ? 0 : -1} aria-disabled={solved} aria-label={`第 ${row + 1} 行，第 ${column + 1} 列，${REGION_PALETTE[level.palette?.[region] ?? region].name}區域，${state === 'jelly' ? '水母' : state === 'marked' ? '排除標記' : '空白'}`} onFocus={() => setFocus(i)} onKeyDown={(e) => keyDown(e, i)} onClick={() => cycle(i)}>
        {state === 'jelly' && <img className="jelly-token" src={assets.jellyCute} alt="" />}{state === 'marked' && <span className="mark-x" aria-hidden="true">×</span>}{overlay.has(i) && state === 'empty' && <span className="constraint-dot" aria-hidden="true" />}{hint === i && <span className="hint-star" aria-hidden="true">✦</span>}{target === i && state !== 'jelly' && <span className="tutorial-arrow" aria-hidden="true">↓</span>}
      </button>
    })}</div></div>
    <p className="board-help">點擊循環：空白 → × → 水母 → 空白</p>
    <p className="tutorial-feedback" role="status">{message || '作答途中不判定對錯，提交後才檢查。'}</p>
    {solved ? <section className="tutorial-success"><h2 ref={feedback} tabIndex={-1}>教學完成！</h2><p>你學會了！接下來試試基礎第一關。</p><button className="button primary" onClick={onStart}>開始基礎第一關</button><button className="text-button" onClick={onExit}>返回首頁</button></section> : <div className="tutorial-actions"><button className="button primary" onClick={submit}>提交答案</button><button className="button secondary" onClick={requestHint}>提示（不限次數）</button><button className="text-button" onClick={restart}>重新練習</button></div>}
  </main>
}
