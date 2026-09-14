import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { assets } from './config/assets'
import { REGION_PALETTE } from './config/regionPalette'
import { levelsByDifficulty, getLevel } from './data/levels'
import { playSound, vibrate } from './audio/soundAdapter'
import { getConflicts, getConstraintOverlay, isBoardSolved, toPosition } from './game/rules'
import {
  createEmptyProgress,
  getBrowserStorage,
  loadSave,
  markLevelCompleted,
  saveData,
  updateLevelProgress,
  updateSettings,
} from './storage/storage'
import type { CellState, Difficulty, Level, LevelProgress, ModalName, SaveData, Settings } from './types/game'
import { DIFFICULTY_META } from './types/game'
import { formatTime } from './utils/format'

type Screen = 'home' | 'levels' | 'game'

function normalizedProgress(level: Level, progress: LevelProgress | undefined): LevelProgress {
  const fallback = createEmptyProgress(level.size)
  if (!progress || progress.cells.length !== level.size * level.size) return fallback
  return { ...progress, cells: [...progress.cells] }
}

function difficultyNumber(level: Level): number {
  return Number(level.id.split('-')[1])
}

function App() {
  const storage = useMemo(() => getBrowserStorage(), [])
  const [save, setSave] = useState<SaveData>(() => loadSave(storage))
  const saveRef = useRef(save)
  const [isVisible, setIsVisible] = useState(() => !document.hidden)
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('basic')
  const [selectedLevelId, setSelectedLevelId] = useState<string>(levelsByDifficulty.basic[0].id)
  const selectedLevel = getLevel(selectedLevelId) ?? levelsByDifficulty.basic[0]
  const [board, setBoard] = useState<CellState[]>(() => createEmptyProgress(selectedLevel.size).cells)
  const [elapsed, setElapsed] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [hintsRemaining, setHintsRemaining] = useState(3)
  const [hintIndex, setHintIndex] = useState<number | null>(null)
  const [conflictIndices, setConflictIndices] = useState<number[]>([])
  const [toast, setToast] = useState('')
  const [focusedCell, setFocusedCell] = useState(0)
  const [modal, setModal] = useState<ModalName>(null)
  const [isSolved, setIsSolved] = useState(false)
  const [isClearOpen, setIsClearOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const boardRef = useRef(board)
  const elapsedRef = useRef(elapsed)
  const mistakesRef = useRef(mistakes)
  const hintsRef = useRef(hintsRemaining)
  const solvedRef = useRef(isSolved)
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => { saveRef.current = save }, [save])
  useEffect(() => { boardRef.current = board }, [board])
  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])
  useEffect(() => { mistakesRef.current = mistakes }, [mistakes])
  useEffect(() => { hintsRef.current = hintsRemaining }, [hintsRemaining])
  useEffect(() => { solvedRef.current = isSolved }, [isSolved])

  const persist = useCallback((nextSave: SaveData) => {
    saveRef.current = nextSave
    setSave(nextSave)
    saveData(storage, nextSave)
  }, [storage])

  const persistCurrentProgress = useCallback((next: Partial<LevelProgress> = {}) => {
    const progress: LevelProgress = {
      cells: [...(next.cells ?? boardRef.current)],
      elapsedSeconds: next.elapsedSeconds ?? elapsedRef.current,
      mistakes: next.mistakes ?? mistakesRef.current,
      hintsRemaining: next.hintsRemaining ?? hintsRef.current,
    }
    persist(updateLevelProgress(saveRef.current, selectedLevel.id, progress))
  }, [persist, selectedLevel.id])

  useEffect(() => {
    if (screen !== 'game' || isSolved || isClearOpen || modal || !isVisible) return
    let lastTick = Date.now()
    const timerId = window.setInterval(() => {
      const now = Date.now()
      const seconds = Math.floor((now - lastTick) / 1000)
      if (seconds < 1) return
      lastTick += seconds * 1000
      elapsedRef.current += seconds
      setElapsed(elapsedRef.current)
    }, 1000)
    return () => window.clearInterval(timerId)
  }, [isClearOpen, isSolved, modal, isVisible, screen])

  useEffect(() => {
    const flush = () => {
      if (screen === 'game' && !solvedRef.current) persistCurrentProgress()
    }
    const onVisibility = () => {
      setIsVisible(!document.hidden)
      if (document.hidden) flush()
    }
    const saveTimer = window.setInterval(flush, 10000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      window.clearInterval(saveTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [persistCurrentProgress, screen])

  useEffect(() => {
    if (!isSolved || screen !== 'game') return
    const timeout = window.setTimeout(() => setIsClearOpen(true), 520)
    return () => window.clearTimeout(timeout)
  }, [isSolved, screen, selectedLevelId])

  useEffect(() => {
    if (!toast) return undefined
    const timeoutId = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    if (hintIndex === null) return undefined
    const timeoutId = window.setTimeout(() => setHintIndex(null), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [hintIndex])

  const openDifficulty = (difficulty: Difficulty) => {
    setSelectedDifficulty(difficulty)
    setScreen('levels')
    playSound('button', saveRef.current.settings.sound)
  }

  const openLevel = useCallback((level: Level) => {
    const currentSave = saveRef.current
    const progress = normalizedProgress(level, currentSave.progress[level.id])
    setSelectedDifficulty(level.difficulty)
    setSelectedLevelId(level.id)
    setBoard(progress.cells)
    setElapsed(progress.elapsedSeconds)
    setMistakes(progress.mistakes)
    setHintsRemaining(progress.hintsRemaining)
    boardRef.current = progress.cells
    elapsedRef.current = progress.elapsedSeconds
    mistakesRef.current = progress.mistakes
    hintsRef.current = progress.hintsRemaining
    setHintIndex(null)
    setConflictIndices([...new Set(getConflicts(progress.cells, level).flatMap((conflict) => conflict.cells))])
    setToast('')
    setFocusedCell(0)
    setIsSolved(false)
    solvedRef.current = false
    setIsClearOpen(false)
    setModal(null)
    setScreen('game')
    playSound('button', currentSave.settings.sound)
  }, [])

  const goHome = () => {
    if (screen === 'game' && !isSolved) persistCurrentProgress()
    setModal(null)
    setScreen('home')
    playSound('button', saveRef.current.settings.sound)
  }

  const goToLevels = () => {
    if (screen === 'game' && !isSolved) persistCurrentProgress()
    setModal(null)
    setScreen('levels')
    playSound('button', saveRef.current.settings.sound)
  }

  const handleSettings = (settings: Settings) => {
    persist(updateSettings(saveRef.current, settings))
  }

  const handleCellAction = useCallback((index: number) => {
    if (isSolved || isClearOpen) return
    const current = boardRef.current[index]
    const nextState: CellState = current === 'empty' ? 'jelly' : current === 'jelly' ? 'marked' : 'empty'
    const nextBoard = [...boardRef.current]
    nextBoard[index] = nextState
    boardRef.current = nextBoard
    setBoard(nextBoard)
    setFocusedCell(index)

    const settings = saveRef.current.settings
    playSound(nextState === 'jelly' ? 'placeJelly' : nextState === 'marked' ? 'placeMark' : 'button', settings.sound)
    vibrate(nextState === 'jelly' ? 8 : 4, settings.vibration)

    let nextMistakes = mistakesRef.current
    const allConflicts = getConflicts(nextBoard, selectedLevel)
    setConflictIndices([...new Set(allConflicts.flatMap((conflict) => conflict.cells))])
    const conflicts = allConflicts.filter((conflict) => conflict.cells.includes(index))
    if (conflicts.length > 0 && nextState === 'jelly') {
      nextMistakes += 1
      mistakesRef.current = nextMistakes
      setMistakes(nextMistakes)
      setToast(conflicts[0].message)
      setAnnouncement(conflicts[0].message)
      playSound('error', settings.sound)
      vibrate([35, 25, 35], settings.vibration)
    } else {
      setToast('')
      setAnnouncement(nextState === 'jelly' ? '放置一隻水母' : nextState === 'marked' ? '加上排除標記' : '清除格子')
    }

    persistCurrentProgress({ cells: nextBoard, mistakes: nextMistakes })
    if (isBoardSolved(nextBoard, selectedLevel) && !solvedRef.current) {
      solvedRef.current = true
      setIsSolved(true)
      setConflictIndices([])
      setToast('太棒了，所有水母都找到位置了！')
      setAnnouncement('過關！所有水母都找到位置了')
      playSound('clear', settings.sound)
      vibrate([25, 30, 60], settings.vibration)
      const levelNumber = difficultyNumber(selectedLevel)
      const completedSave = markLevelCompleted(
        saveRef.current,
        selectedLevel.id,
        selectedLevel.difficulty,
        levelNumber,
        { time: elapsedRef.current, mistakes: nextMistakes, hints: 3 - hintsRef.current },
        levelsByDifficulty[selectedLevel.difficulty].length,
      )
      persist(completedSave)
    }
  }, [isClearOpen, isSolved, persist, persistCurrentProgress, selectedLevel])

  const restartLevel = () => {
    const progress = createEmptyProgress(selectedLevel.size)
    setBoard(progress.cells)
    setElapsed(0)
    setMistakes(0)
    setHintsRemaining(3)
    setHintIndex(null)
    setConflictIndices([])
    setToast('')
    setIsSolved(false)
    solvedRef.current = false
    setIsClearOpen(false)
    boardRef.current = progress.cells
    elapsedRef.current = 0
    mistakesRef.current = 0
    hintsRef.current = 3
    persistCurrentProgress(progress)
    setModal(null)
    playSound('button', saveRef.current.settings.sound)
  }

  const requestHint = () => {
    if (isSolved || hintsRemaining <= 0) return
    const target = selectedLevel.solution
      .map((column, row) => row * selectedLevel.size + column)
      .find((index) => boardRef.current[index] !== 'jelly')
    if (target === undefined) return
    const nextHints = hintsRemaining - 1
    setHintsRemaining(nextHints)
    hintsRef.current = nextHints
    setHintIndex(target)
    setToast('看看這個閃閃發亮的位置')
    setAnnouncement(`提示：第 ${toPosition(target, selectedLevel.size).row + 1} 行、第 ${toPosition(target, selectedLevel.size).column + 1} 列`)
    vibrate(10, saveRef.current.settings.vibration)
    persistCurrentProgress({ hintsRemaining: nextHints })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCellAction(index)
      return
    }
    if (event.key === 'Escape') {
      setModal(null)
      setIsClearOpen(false)
      return
    }
    const { row, column } = toPosition(index, selectedLevel.size)
    const deltas: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    }
    const delta = deltas[event.key]
    if (!delta) return
    event.preventDefault()
    const nextRow = Math.min(selectedLevel.size - 1, Math.max(0, row + delta[0]))
    const nextColumn = Math.min(selectedLevel.size - 1, Math.max(0, column + delta[1]))
    const nextIndex = nextRow * selectedLevel.size + nextColumn
    setFocusedCell(nextIndex)
    cellRefs.current[nextIndex]?.focus()
  }

  const overlay = useMemo(() => save.settings.assist ? getConstraintOverlay(board, selectedLevel) : new Set<number>(), [board, selectedLevel, save.settings.assist])
  const resumableLevel = Object.keys(save.progress).reverse().map(getLevel).find((level) => level && (save.progress[level.id]?.elapsedSeconds > 0 || save.progress[level.id]?.cells.some((cell) => cell !== 'empty')) && difficultyNumber(level) <= save.unlocked[level.difficulty])
  const completedCount = levelsByDifficulty[selectedDifficulty].filter((level) => save.completed.includes(level.id)).length
  const levelNumber = difficultyNumber(selectedLevel)
  const nextLevel = levelsByDifficulty[selectedLevel.difficulty].find((level) => difficultyNumber(level) === levelNumber + 1)
  const bestRecord = save.best[selectedLevel.id]

  return (
    <div className={`app-shell screen-${screen}`}>
      <div className="ambient-orb orb-one" />
      <div className="ambient-orb orb-two" />
      <div className="sr-only" aria-live="polite">{announcement}</div>

      {screen === 'home' && (
        <HomeScreen onDifficulty={openDifficulty} completed={save.completed} resumeLevel={resumableLevel} onResume={openLevel} />
      )}

      {screen === 'levels' && (
        <LevelSelectScreen
          difficulty={selectedDifficulty}
          completed={save.completed}
          unlocked={save.unlocked[selectedDifficulty]}
          onBack={goHome}
          onSelect={openLevel}
          onDifficulty={openDifficulty}
          completedCount={completedCount}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          level={selectedLevel}
          board={board}
          elapsed={elapsed}
          mistakes={mistakes}
          hintsRemaining={hintsRemaining}
          focusedCell={focusedCell}
          hintIndex={hintIndex}
          conflictIndices={conflictIndices}
          overlay={overlay}
          assist={save.settings.assist}
          onToggleAssist={() => handleSettings({ ...saveRef.current.settings, assist: !saveRef.current.settings.assist })}
          toast={toast}
          cellRefs={cellRefs}
          bestRecord={bestRecord}
          onBack={goToLevels}
          onCellAction={handleCellAction}
          onKeyDown={handleKeyDown}
          onFocus={setFocusedCell}
          onHint={requestHint}
          onRestart={() => setModal('restart')}
          onSettings={() => setModal('settings')}
          onRules={() => setModal('rules')}
        />
      )}

      {modal === 'restart' && (
        <Modal title="重新整理這一關？" onClose={() => setModal(null)}>
          <p className="modal-copy">目前的水母、計時與推理標記都會被清除。</p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>取消</button>
            <button className="button primary" onClick={restartLevel}>重新開始</button>
          </div>
        </Modal>
      )}

      {modal === 'settings' && (
        <SettingsModal settings={save.settings} onChange={handleSettings} onRules={() => setModal('rules')} onClose={() => setModal(null)} />
      )}

      {modal === 'rules' && (
        <Modal title="水母數獨怎麼玩？" onClose={() => setModal(null)}>
          <RuleList />
          <div className="modal-actions"><button className="button primary" onClick={() => setModal(null)}>知道了</button></div>
        </Modal>
      )}

      {isClearOpen && (
        <ClearModal
          level={selectedLevel}
          elapsed={elapsed}
          mistakes={mistakes}
          hintsUsed={3 - hintsRemaining}
          nextLevel={nextLevel}
          onNext={() => nextLevel ? openLevel(nextLevel) : goToLevels()}
          onReplay={() => { setIsClearOpen(false); restartLevel() }}
          onLevels={goToLevels}
        />
      )}
    </div>
  )
}

interface HomeScreenProps {
  onDifficulty: (difficulty: Difficulty) => void
  completed: string[]
  resumeLevel?: Level
  onResume: (level: Level) => void
}

function HomeScreen({ onDifficulty, completed, resumeLevel, onResume }: HomeScreenProps) {
  return (
    <main className="home-page page-wrap">
      <header className="home-header">
        <div className="brand-mark"><span className="brand-dot" /><span>012S</span><span className="brand-word">JELLY WORLD</span></div>
        <span className="edition-pill">PUZZLE EDITION</span>
      </header>
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">A little logic, a lot of jelly</p>
          <h1>Jelly<br /><span>Sudoku</span></h1>
          <p className="hero-zh">水母數獨</p>
          <p className="hero-description">把水母送回每一個區域。每行、每列一隻，還要記得留一點距離。</p>
          <div className="hero-note"><span className="note-dot" /> 30 個精心設計的潮汐謎題</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-ring ring-back" />
          <div className="art-ring ring-front" />
          <img src={assets.jellyPlayful} alt="" />
          <span className="sparkle sparkle-one">✦</span><span className="sparkle sparkle-two">✧</span><span className="sparkle sparkle-three">·</span>
        </div>
      </section>
      {resumeLevel && <button className="resume-card" onClick={() => onResume(resumeLevel)}><span><small>接著上次的潮汐</small><strong>{resumeLevel.title} · {resumeLevel.size}×{resumeLevel.size}</strong></span><span>繼續遊戲 →</span></button>}
      <section className="mode-section" aria-labelledby="mode-title">
        <div className="section-heading"><div><p className="eyebrow">Choose your current</p><h2 id="mode-title">選擇難度</h2></div><span className="progress-caption">{completed.length} / 30 完成</span></div>
        <div className="mode-grid">
          <ModeCard difficulty="basic" onClick={onDifficulty} />
          <ModeCard difficulty="normal" onClick={onDifficulty} />
          <ModeCard difficulty="challenge" onClick={onDifficulty} />
        </div>
      </section>
      <section className="home-rules" aria-label="遊戲規則">
        <div className="rule-intro"><span className="rule-icon">✦</span><div><p className="eyebrow">Three simple rules</p><h2>找到唯一的水母排列</h2></div></div>
        <RuleList compact />
      </section>
      <footer className="home-footer"><span>012S Jelly World</span><span>Made for calm minds · v1.0</span></footer>
    </main>
  )
}

function ModeCard({ difficulty, onClick }: { difficulty: Difficulty; onClick: (difficulty: Difficulty) => void }) {
  const meta = DIFFICULTY_META[difficulty]
  return (
    <button className={`mode-card mode-${difficulty}`} onClick={() => onClick(difficulty)}>
      <span className="mode-index">0{difficulty === 'basic' ? 1 : difficulty === 'normal' ? 2 : 3}</span>
      <span className="mode-badge" style={{ backgroundColor: meta.accent }} />
      <span className="mode-label">{meta.label}</span>
      <span className="mode-size">{meta.size}×{meta.size}</span>
      <span className="mode-subtitle">{meta.english}</span>
      <span className="mode-arrow">↗</span>
    </button>
  )
}

interface LevelSelectProps {
  difficulty: Difficulty
  completed: string[]
  unlocked: number
  onBack: () => void
  onSelect: (level: Level) => void
  onDifficulty: (difficulty: Difficulty) => void
  completedCount: number
}

function LevelSelectScreen({ difficulty, completed, unlocked, onBack, onSelect, onDifficulty, completedCount }: LevelSelectProps) {
  const meta = DIFFICULTY_META[difficulty]
  const modeLevels = levelsByDifficulty[difficulty]
  return (
    <main className="levels-page page-wrap">
      <header className="subpage-header">
        <button className="icon-button" aria-label="返回首頁" onClick={onBack}>←</button>
        <div className="mini-brand"><span className="brand-dot" /> 012S <span>JELLY SUDOKU</span></div>
        <span className="header-spacer" />
      </header>
      <section className="levels-intro">
        <div><p className="eyebrow">Choose a level</p><h1>{meta.label} <span>{meta.size}×{meta.size}</span></h1><p>沿著潮汐的節奏，慢慢找出每隻水母的位置。</p></div>
        <div className="completion-ring" style={{ '--ring-progress': `${(completedCount / modeLevels.length) * 100}%` } as CSSProperties}><strong>{completedCount}</strong><span>/ {modeLevels.length}</span></div>
      </section>
      <nav className="difficulty-tabs" aria-label="切換難度">
        {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((item) => <button key={item} className={item === difficulty ? 'active' : ''} onClick={() => onDifficulty(item)}>{DIFFICULTY_META[item].label}<small>{DIFFICULTY_META[item].size}×{DIFFICULTY_META[item].size}</small></button>)}
      </nav>
      <section className="level-list" aria-label={`${meta.label}關卡`}>
        {modeLevels.map((level, index) => {
          const number = index + 1
          const isCompleted = completed.includes(level.id)
          const isUnlocked = number <= unlocked
          return <button key={level.id} className={`level-card ${isCompleted ? 'completed' : ''} ${isUnlocked ? '' : 'locked'}`} disabled={!isUnlocked} onClick={() => onSelect(level)}>
            <span className="level-number">{String(number).padStart(2, '0')}</span>
            <span className="level-info"><strong>{isCompleted ? '已完成' : number === unlocked ? '準備好了嗎？' : '潮汐謎題'}</strong><small>{number === 1 ? '從這裡開始你的水母旅程' : `${meta.label} · ${meta.size}×${meta.size}`}</small></span>
            <span className="level-status">{isCompleted ? '✓' : isUnlocked ? '→' : '🔒'}</span>
          </button>
        })}
      </section>
      <p className="levels-footnote">完成目前關卡後，下一個潮汐會為你開放。</p>
    </main>
  )
}

interface GameScreenProps {
  level: Level
  board: CellState[]
  elapsed: number
  mistakes: number
  hintsRemaining: number
  focusedCell: number
  hintIndex: number | null
  conflictIndices: number[]
  assist: boolean
  onToggleAssist: () => void
  overlay: Set<number>
  toast: string
  cellRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>
  bestRecord?: { time: number; mistakes: number; hints: number }
  onBack: () => void
  onCellAction: (index: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
  onFocus: (index: number) => void
  onHint: () => void
  onRestart: () => void
  onSettings: () => void
  onRules: () => void
}

function GameScreen({ level, board, elapsed, mistakes, hintsRemaining, focusedCell, hintIndex, conflictIndices, overlay, assist, onToggleAssist, toast, cellRefs, bestRecord, onBack, onCellAction, onKeyDown, onFocus, onHint, onRestart, onSettings, onRules }: GameScreenProps) {
  const jellyCount = board.filter((state) => state === 'jelly').length
  return (
    <main className="game-page page-wrap">
      <header className="game-header">
        <button className="icon-button" aria-label="返回關卡列表" onClick={onBack}>←</button>
        <div className="mini-brand"><span className="brand-dot" /> 012S <span>JELLY SUDOKU</span></div>
        <button className="icon-button" aria-label="設定" onClick={onSettings}>☼</button>
      </header>
      <section className="game-heading">
        <div><p className="eyebrow">{DIFFICULTY_META[level.difficulty].english} · LEVEL {String(Number(level.id.split('-')[1])).padStart(2, '0')}</p><h1>{DIFFICULTY_META[level.difficulty].label} <span>{level.size}×{level.size}</span></h1></div>
        <div className="timer-box"><span>TIME</span><strong>{formatTime(elapsed)}</strong>{bestRecord && <small>BEST {formatTime(bestRecord.time)}</small>}</div>
      </section>
      <section className="game-stats" aria-label="遊戲進度">
        <div className="stat-block"><span className="stat-icon jelly-mini">✦</span><div><small>水母進度</small><strong>{jellyCount} <em>/ {level.size}</em></strong></div></div>
        <div className="stat-divider" />
        <div className="stat-block"><span className="stat-icon hint-mini">✦</span><div><small>提示剩餘</small><strong>{hintsRemaining} <em>次</em></strong></div></div>
        <div className="stat-divider" />
        <div className="stat-block stat-mistake"><span className="stat-icon">○</span><div><small>錯誤</small><strong>{mistakes}</strong></div></div>
      </section>
      <section className="rule-banner"><div className="rule-banner-icon">✦</div><div><strong>一個區域一隻水母</strong><span>每行、每列各一隻，水母不能相鄰</span></div><button aria-label="查看規則" onClick={onRules}>?</button></section>
      <div className="assist-toolbar"><span id="assist-description">{assist ? '斜線＋圓點：目前不能放水母' : '輔助已關閉，自行推理'}</span><button className="assist-toggle" role="switch" aria-checked={assist} aria-describedby="assist-description" onClick={onToggleAssist}><span className="assist-switch" aria-hidden="true" />輔助標示 {assist ? '開' : '關'}</button></div>
      <section className="board-wrap" aria-label={`${level.title}遊戲棋盤`}>
        <div className="board-shell"><div className="game-board" style={{ '--board-size': level.size } as CSSProperties} role="grid" aria-label={`${level.size}乘${level.size}水母數獨棋盤`}>
          {board.map((state, index) => {
            const region = level.regions[index]
            const paletteIndex = level.palette?.[region] ?? region % REGION_PALETTE.length
            const { row, column } = toPosition(index, level.size)
            const hasConflict = conflictIndices.includes(index)
            const isHinted = hintIndex === index
            const isBlocked = overlay.has(index) && state === 'empty'
            const cellLabel = `${row + 1} 行，第 ${column + 1} 列，第 ${region + 1} 區（${REGION_PALETTE[paletteIndex].name}），${state === 'jelly' ? '水母' : state === 'marked' ? '排除標記' : '空白'}${isBlocked ? '，系統提示暫不可放置' : ''}`
            return <button
              key={`${level.id}-${index}`}
              ref={(element) => { cellRefs.current[index] = element }}
              className={`board-cell region-${region} state-${state} ${hasConflict ? 'has-conflict' : ''} ${isHinted ? 'is-hinted' : ''} ${isBlocked ? 'is-blocked' : ''} ${focusedCell === index ? 'is-focused' : ''}`}
              style={{
                '--region-color': REGION_PALETTE[paletteIndex].color,
                borderTopWidth: row === 0 || level.regions[index - level.size] !== region ? 3 : 1,
                borderLeftWidth: column === 0 || level.regions[index - 1] !== region ? 3 : 1,
                borderRightWidth: column === level.size - 1 ? 3 : 1,
                borderBottomWidth: row === level.size - 1 ? 3 : 1,
                borderTopColor: row === 0 || level.regions[index - level.size] !== region ? '#554e67' : undefined,
                borderLeftColor: column === 0 || level.regions[index - 1] !== region ? '#554e67' : undefined,
              } as CSSProperties}
              role="gridcell"
              aria-label={cellLabel}
              aria-selected={focusedCell === index}
              tabIndex={focusedCell === index ? 0 : -1}
              onClick={() => onCellAction(index)}
              onFocus={() => onFocus(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="region-number" aria-hidden="true">{region + 1}</span>
              {state === 'jelly' && <img className="jelly-token" src={assets.jellyCute} alt="" />}
              {state === 'marked' && <span className="mark-x" aria-hidden="true">×</span>}
              {isHinted && <span className="hint-star" aria-hidden="true">✦</span>}
              {isBlocked && <span className="constraint-dot" aria-hidden="true" />}
            </button>
          })}
        </div></div>
        <p className="board-help">點擊循環：<b>空白</b><span>→</span><b className="help-jelly">水母</b><span>→</span><b className="help-x">×</b></p>
        <div className="toast" role="status" aria-live="polite" data-visible={Boolean(toast)}>{toast || '　'}</div>
      </section>
      <nav className="game-actions" aria-label="遊戲操作">
        <button className="action-button" onClick={onRestart}><span>↺</span><small>重新開始</small></button>
        <button className="action-button hint-action" onClick={onHint} disabled={hintsRemaining <= 0}><span>✦<sup>{hintsRemaining}</sup></span><small>提示</small></button>
        <button className="action-button" onClick={onSettings}><span>☼</span><small>設定</small></button>
      </nav>
    </main>
  )
}

function RuleList({ compact = false }: { compact?: boolean }) {
  return <ul className={`rule-list ${compact ? 'compact' : ''}`}>
    <li><span>01</span><div><strong>一個區域一隻水母</strong>{!compact && <small>同一種柔和顏色裡只能放一隻。</small>}</div></li>
    <li><span>02</span><div><strong>每行、每列各一隻</strong>{!compact && <small>讓整座棋盤的水母保持平衡。</small>}</div></li>
    <li><span>03</span><div><strong>水母不能相鄰</strong>{!compact && <small>上下左右與四個斜角都要留一格距離。</small>}</div></li>
  </ul>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex="0"]') ?? [])
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = oldOverflow
      document.removeEventListener('keydown', handleKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={dialogRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby={titleId}><button className="modal-close" onClick={onClose} aria-label="關閉">×</button><p className="eyebrow">012S JELLY WORLD</p><h2 id={titleId}>{title}</h2>{children}</section></div>
}

function SettingsModal({ settings, onChange, onRules, onClose }: { settings: Settings; onChange: (settings: Settings) => void; onRules: () => void; onClose: () => void }) {
  return <Modal title="小小設定" onClose={onClose}>
    <div className="settings-list">
      <ToggleRow label="音效" description="放置與過關時的輕柔提示音" checked={settings.sound} onChange={(checked) => onChange({ ...settings, sound: checked })} />
      <ToggleRow label="震動" description="在支援的手機上提供微小回饋" checked={settings.vibration} onChange={(checked) => onChange({ ...settings, vibration: checked })} />
      <ToggleRow label="輔助標示" description="自動標示同行、同列、同區及相鄰格；可隨時開關" checked={settings.assist} onChange={(checked) => onChange({ ...settings, assist: checked })} />
    </div>
    <button className="rules-link" onClick={onRules}>查看完整規則 <span>→</span></button>
  </Modal>
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>
}

function ClearModal({ level, elapsed, mistakes, hintsUsed, nextLevel, onNext, onReplay, onLevels }: { level: Level; elapsed: number; mistakes: number; hintsUsed: number; nextLevel?: Level; onNext: () => void; onReplay: () => void; onLevels: () => void }) {
  return <Modal title="CLEAR!" onClose={onLevels}>
    <div className="clear-art"><img src={assets.jellySparkle} alt="開心的水母" /><span>✦</span><span>✧</span></div>
    <p className="clear-copy">水母們都找到自己的位置了！<br /><small>這一片潮汐，完成得剛剛好。</small></p>
    <div className="clear-stats"><div><small>完成時間</small><strong>{formatTime(elapsed)}</strong></div><div><small>錯誤</small><strong>{mistakes}</strong></div><div><small>提示</small><strong>{hintsUsed}</strong></div></div>
    <div className="modal-actions clear-actions"><button className="button primary" onClick={onNext}>{nextLevel ? '下一關' : '完成！'} <span>→</span></button><button className="button secondary" onClick={onReplay}>再玩一次</button><button className="text-button" onClick={onLevels}>返回關卡</button></div>
    <p className="clear-level-label">{level.title}</p>
  </Modal>
}

export default App
