import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { lessons, teachingScenes, teachingPoses, boardCells, poseExclusions, quizCell, colourName, LESSON_TIERS, lessonTierFor, canTeach, trialFrame, TRIAL_STAGES, type TeachingScene, type Lesson, type LessonTechnique } from '../data/lessons'
import { TECHNIQUES, type Technique } from '../game/logic'
import { REGION_PALETTE } from '../config/regionPalette'
import { assets } from '../config/assets'
import { getBrowserStorage } from '../storage/storage'

const KEY = 'jellySudokuAcademy.v1'
function readCompleted(): string[] {
  try { const value: unknown = JSON.parse(getBrowserStorage()?.getItem(KEY) ?? '[]'); return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string' && Object.hasOwn(TECHNIQUES, x)))] : [] } catch { return [] }
}
function reducedMotion() { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false }
function position(i: number, n: number) { return `第 ${Math.floor(i / n) + 1} 橫排、第 ${i % n + 1} 直列` }
function comparePositions(t: LessonTechnique) { return ['line', 'pair', 'triple', 'bend', 'zigzag'].includes(t) }

function TeachingBoard({ scene, technique, pose = [], blocked = [], question, hypothesis, focusColumn, focusRow, attention = [] }: {
  scene: TeachingScene; technique: LessonTechnique; pose?: number[]; blocked?: number[]; question?: number; hypothesis?: number; focusColumn?: number; focusRow?: number; attention?: number[]
}) {
  const cells = boardCells(scene), n = scene.level.size
  const activeRows = new Set(scene.sources.map((i) => Math.floor(i / n)))
  const crossCount = cells.filter((i) => i !== question && blocked.includes(i)).length
  return <div className="teaching-board" role="img" aria-label={`${scene.level.size}乘${scene.level.size}正式關卡完整盤面，${hypothesis !== undefined ? `假設水母住${position(hypothesis, n)}` : pose.length ? `水母試住${pose.map((i) => position(i, n)).join('、')}` : technique === 'reverse' ? '圈起的位置是這排同色的格子' : '圈起的位置是本課顏色的所有格子'}${crossCount ? `，本次排除 ${crossCount} 格畫叉` : ''}${question !== undefined ? `，問題格在${position(question, n)}` : ''}`}>
    <div className="teaching-matrix" style={{ '--teaching-columns': n } as CSSProperties}>{cells.map((i) => {
      const region = scene.level.regions[i], row = Math.floor(i / n), column = i % n
      const isSource = scene.sources.includes(i), isPose = pose.includes(i), oldJelly = scene.board[i] === 'jelly'
      const isBlocked = blocked.includes(i)
      const isQuestion = question === i
      const isMarked = !isQuestion && isBlocked
      const isRow = ['line', 'hall2', 'hall3', 'reverse'].includes(technique) && activeRows.has(row)
      const isHypothesis = hypothesis === i, isFocusedUnit = column === focusColumn || row === focusRow
      const rule = technique === 'bend' && isBlocked && scene.targets.includes(i) && pose.length ? Math.floor(pose[0] / n) === row ? '同排' : pose[0] % n === column ? '同列' : '相鄰' : null
      const palette = scene.level.palette?.[region] ?? region
      return <span key={i} data-cell={i} className={`teaching-cell ${isSource ? 'source' : ''} ${isPose ? 'trial' : ''} ${isMarked ? 'blocked' : ''} ${isQuestion ? 'question' : ''} ${isRow ? 'reserved-row' : ''} ${isHypothesis ? 'hypothesis' : ''} ${isFocusedUnit ? 'contradiction-unit' : ''} ${attention.includes(i) ? 'attention' : ''}`} style={{
        '--teaching-colour': REGION_PALETTE[palette].color,
        borderTopWidth: row === 0 || scene.level.regions[i - n] !== region ? 2 : 1,
        borderLeftWidth: column === 0 || scene.level.regions[i - 1] !== region ? 2 : 1,
      } as CSSProperties}>
        {(isPose || oldJelly) && <img className={isPose || isSource ? '' : 'earlier-jelly'} src={assets.jellyCute} alt="" />}
        {isSource && !isPose && !oldJelly && !isMarked && <span className="candidate-ring" />}
        {isMarked && <span className="teaching-x">×</span>}
        {isQuestion && <span className="question-bubble">?</span>}
        {rule && <span className="teaching-rule">{rule}</span>}
        {isHypothesis && <span className="hypothesis-label">假設</span>}
      </span>
    })}</div>
    <small>完整盤面 · {n}×{n}</small>
  </div>
}
function intro(scene: TeachingScene, lesson: Lesson) {
  const colour = colourName(scene, scene.sources[0])
  if (lesson.technique === 'reverse') return `這一整橫排都是${colour}，水母一定會住在這排。`
  if (lesson.technique === 'hall2' || lesson.technique === 'hall3') return `圈圈標出${scene.groups.map((g) => colourName(scene, g[0])).join('、')}的所有格子。`
  return `${colour}一共 ${scene.sources.length} 格，全部圈起來了。水母會住其中一格。`
}

export function AcademyScreen({ onExit, onPlay, playLabel = '開始遊戲', initialTechnique }: { onExit: () => void; onPlay: () => void; playLabel?: string; initialTechnique?: Technique }) {
  const [technique, setTechnique] = useState<LessonTechnique>(() => canTeach(initialTechnique) ? initialTechnique : 'line')
  const [completed, setCompleted] = useState(readCompleted)
  const [phase, setPhase] = useState<'demo' | 'practice'>('demo')
  const [step, setStep] = useState(0)
  const [exercise, setExercise] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotion())
  const [answer, setAnswer] = useState<boolean | null>(null)
  const [passed, setPassed] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [comparison, setComparison] = useState(-1)
  const tier = lessonTierFor(technique)
  const nextTechnique = tier.techniques[tier.techniques.indexOf(technique) + 1]
  const nextTier = LESSON_TIERS[LESSON_TIERS.indexOf(tier) + 1]
  const tierEnd = passed && exercise === 1 && !nextTechnique
  const lesson = lessons.find((l) => l.technique === technique)!
  const scene = teachingScenes[technique][exercise], poses = teachingPoses(scene, technique)
  const structural = technique === 'hall2' || technique === 'hall3'
  const trial = technique === 'combination'
  const shownPoses = structural ? poses.slice(0, 2) : poses
  const question = quizCell(scene, technique, exercise)
  const trialState = trial ? trialFrame(scene, question, phase === 'demo' ? step : comparison === 0 ? 5 : comparison === 1 ? 6 : comparison === 2 ? 7 : 0) : undefined
  const lastStep = trial ? TRIAL_STAGES.length - 1 : shownPoses.length + 1
  const isLast = step === lastStep
  const hypothesis = trialState?.hypothesis
  const comparing = isLast && comparePositions(technique)
  const activePose = trialState?.pose ?? (comparing && comparison >= 0 ? shownPoses[comparison] : step > 0 && !isLast ? shownPoses[step - 1] : [])
  const activeBlocks = trialState?.blocked ?? (step === 0 ? [] : isLast ? scene.targets : poseExclusions(scene, technique, activePose))
  const expected = trialState?.contradiction ?? scene.targets.includes(question)
  const answered = answer !== null

  useEffect(() => {
    if (!pickerOpen) return
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setPickerOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [pickerOpen])

  useEffect(() => {
    if (phase !== 'demo' || !playing || isLast) return
    const timer = window.setTimeout(() => setStep((s) => s + 1), 3500)
    return () => window.clearTimeout(timer)
  }, [phase, playing, step, isLast, technique, exercise])
  function choose(next: LessonTechnique, closePicker = true) {
    setTechnique(next); setPhase('demo'); setStep(0); setExercise(0); setPlaying(!reducedMotion() && (closePicker || !pickerOpen)); setAnswer(null); setPassed(false); setComparison(-1)
    if (closePicker) setPickerOpen(false)
  }
  function practice() { setPhase('practice'); setPlaying(false); setAnswer(null); setPassed(false); setComparison(-1) }
  function respond(value: boolean) {
    setAnswer(value)
    const correct = value === expected
    setPassed(correct)
    if (correct && exercise === 1) {
      const next = [...new Set([...completed, technique])]
      setCompleted(next)
      try { getBrowserStorage()?.setItem(KEY, JSON.stringify(next)) } catch { /* Practice remains available without storage. */ }
    }
  }
  const menuLabels: Partial<Record<LessonTechnique, string>> = { line: '直線', pair: '相鄰兩格', triple: '三格直線', bend: '轉一個彎', zigzag: 'Z 型', reverse: '這一排' }
  let caption = intro(scene, lesson)
  if (step > 0 && !isLast) {
    if (structural) caption = `${step === 1 ? '一種可能的安排' : '換一種安排'}：${scene.groups.length} 隻水母必須分占 ${scene.groups.length} 個橫排。`
    else if (technique === 'bend') caption = '如果水母住這格，同排、同列與周圍都不能再住另一隻。'
    else caption = `如果水母住這一格，${technique === 'line' ? '這排其他顏色' : technique === 'reverse' ? '同色區域的其他位置' : '打叉的位置'}就不能再住另一隻。`
  }
  if (isLast) caption = structural ? `${scene.groups.length} 種顏色剛好需要這 ${scene.groups.length} 排，其他顏色不能放進來。` : `不管選哪個位置，這 ${scene.targets.length} 格每次都不能住，所以可以先畫叉。`
  if (trialState) caption = trialState.caption
  const practicePrompt = trial ? comparison === -1 ? '照順序試放問號格、檢查矛盾，再回復盤面。' : comparison === 0 ? '依序排除同排、同列、同色與周圍八格。這些叉叉都只是暫時的。' : comparison === 1 ? trialState!.caption : '已回復盤面，這次能確定把問號格畫叉嗎？' : `${exercise === 1 ? '換一個盤面。' : ''}只用剛剛的線索，圈起的問號格能確定畫叉嗎？`

  return <main className="academy-page academy-v2 page-wrap">
    <header className="subpage-header"><button className="icon-button" aria-label="離開定石教室" onClick={onExit}>←</button><strong>定石教室</strong><span>{completed.filter((t) => lessons.some((l) => l.technique === t)).length} / {lessons.length} 已學會</span></header>
    <h1 className="sr-only">看水母試住，就知道哪裡能畫叉。</h1>
    <button className="course-toggle" aria-expanded={pickerOpen} aria-controls="course-picker" onClick={() => { setPlaying(false); setPickerOpen(!pickerOpen) }}>{tier.name} / {menuLabels[technique] ?? lesson.title}<span>{pickerOpen ? '收起選課 ×' : '換課 ▾'}</span></button>
    {pickerOpen && <button className="course-backdrop" aria-label="關閉選課" onClick={() => setPickerOpen(false)} />}
    <div className="academy-workspace">
    <section id="course-picker" className={`learning-levels ${pickerOpen ? 'is-open' : ''}`} aria-labelledby="learning-levels-title">
      <h2 id="learning-levels-title">選擇學習難度</h2>
      <nav className="lesson-tiers" aria-label="選擇學習難度">{LESSON_TIERS.map((item) => <button key={item.id} data-tier={item.id} aria-pressed={tier.id === item.id} onClick={() => choose(item.techniques[0], false)}><strong>{item.name}</strong><span>{item.description}</span><small>{item.techniques.filter((t) => completed.includes(t)).length} / {item.techniques.length} 已學會</small></button>)}</nav>
      <p className="tier-description">{tier.name} · {tier.techniques.length} 個技巧 <span>自由選課，不必依序解鎖</span></p>
      <nav className="tier-lessons" aria-label={`${tier.name}課程`}>{tier.techniques.map((t, i) => <button key={t} data-technique={t} aria-pressed={technique === t} onClick={() => choose(t)}><small>0{i + 1}</small>{menuLabels[t] ?? lessons.find((l) => l.technique === t)!.title}{completed.includes(t) && ' ✓'}</button>)}</nav>
    </section>
    <section className={`lesson-card phase-${phase}`}>
      <div className="lesson-card-heading"><h2>{lesson.title}</h2><span>{phase === 'demo' ? '看示範' : `小練習 ${exercise + 1} / 2`}</span></div>
      {phase === 'demo' ? <>
        <div className="demo-progress"><progress max={lastStep + 1} value={step + 1} aria-label="示範進度" /><small>第 {step + 1} / {lastStep + 1} 步{trial && ` · ${TRIAL_STAGES[step]}`}</small><button className="text-button playback-toggle" onClick={() => { if (isLast) { setStep(0); setComparison(-1) }; setPlaying(isLast ? true : !playing) }}>{isLast ? '重播' : playing ? '暫停播放' : '播放示範'}</button></div>
        <p className={`teaching-caption ${isLast ? 'is-conclusion' : ''}`} aria-live="polite"><span className="demo-caption">{caption}</span>{isLast && <span className="mobile-takeaway">{trial ? caption : lesson.takeaway}</span>}</p>
        <div className="comparison-switcher">{comparing && <nav aria-label="比較每一種可能">{shownPoses.map((_, i) => <button key={i} data-pose={i} aria-pressed={comparison === i} onClick={() => setComparison(i)}>位置 {i + 1}</button>)}<button data-pose="common" aria-pressed={comparison === -1} onClick={() => setComparison(-1)}>共同禁區</button></nav>}</div>
        <TeachingBoard scene={scene} technique={technique} pose={activePose} blocked={activeBlocks} hypothesis={hypothesis} focusColumn={trialState?.column} focusRow={trialState?.row} attention={trialState?.attention} />
        <div className="board-context"><span>{hypothesis !== undefined ? '圈圈＝假設後還能住的位置' : technique === 'reverse' ? '圈圈＝這排同色的格子' : '圈圈＝該顏色所有格子'}</span><span>{trial ? hypothesis !== undefined ? '×＝假設下暫時排除' : '×＝確定不能住' : '×＝本次排除的位置'}</span></div>
        {isLast && <p className="takeaway">{lesson.takeaway}</p>}
        <div className="lesson-actions demo-controls"><button className="button secondary previous-step" disabled={step === 0} onClick={() => { setPlaying(false); setComparison(-1); setStep(step - 1) }}>上一步</button><button className="button primary next-step" onClick={() => { setPlaying(false); setComparison(-1); if (isLast) practice(); else setStep(step + 1) }}>{isLast ? '判斷一格，試試看' : '下一步'}</button></div>
      </> : <>
        <div className="demo-progress"><small>小練習 {exercise + 1} / 2 · 判斷問號格</small></div>
        <div className="teaching-caption">{answered ? <div className={`quiz-feedback ${passed ? 'correct' : ''}`} role="status"><strong>{passed ? '判斷正確！' : '再看一次線索。'}</strong><p>{trial ? passed ? expected ? '假設出現矛盾，所以原本試放的這格可以畫叉。' : '暫時沒有矛盾，先保留；不能直接認定水母就在這格。' : '有矛盾才能排除；沒有矛盾還不能認定答案。' : passed ? expected ? lesson.takeaway : '這格還不能確定排除，先保留。' : '只有每次都不能住的格子，才能確定畫叉。'}</p>{passed && exercise === 1 && <details className="lesson-caution"><summary>什麼情況不能直接套用？</summary><p>{lesson.caution}</p></details>}</div> : <p>{practicePrompt}</p>}</div>
        <div className="comparison-switcher">{trial && !passed && <nav aria-label="嘗試順序"><button className="trial-place" aria-pressed={comparison === 0} disabled={comparison === 0 || comparison === 1} onClick={() => setComparison(0)}>① 試放</button><button className="trial-check" aria-pressed={comparison === 1} disabled={comparison !== 0} onClick={() => setComparison(1)}>② 檢查</button><button className="trial-restore" aria-pressed={comparison === 2} disabled={comparison !== 1} onClick={() => setComparison(2)}>③ 回復</button></nav>}</div>
        <TeachingBoard scene={scene} technique={technique} question={hypothesis === undefined ? question : undefined} pose={trialState?.pose} blocked={trialState?.blocked} hypothesis={hypothesis} focusColumn={trialState?.column} focusRow={trialState?.row} attention={trialState?.attention} />
        <div className="board-context"><span>{hypothesis !== undefined ? '圈圈＝假設後還能住的位置' : technique === 'reverse' ? '圈圈＝這排同色的格子' : '圈圈＝該顏色所有格子'}</span><span>{hypothesis !== undefined ? '×＝假設下暫時排除' : '問號＝這次要判斷的格子'}</span></div>
        <div className="lesson-actions">
        <div className="quiz-actions" hidden={passed}><button className="button primary answer-yes" disabled={passed || (trial && comparison !== 2)} onClick={() => respond(true)}>可以確定畫叉</button><button className="button secondary answer-no" disabled={passed || (trial && comparison !== 2)} onClick={() => respond(false)}>還不能確定</button></div>
        <div className={`practice-controls ${tierEnd ? 'tier-end-controls' : ''}`}><button className="text-button replay-example" onClick={() => { setPhase('demo'); setStep(0); setPlaying(!reducedMotion()); setAnswer(null); setPassed(false); setComparison(-1) }}>回看這個例子</button>{passed && <button className="button primary continue-practice" onClick={() => {
          if (exercise === 0) { setExercise(1); setAnswer(null); setPassed(false); setComparison(-1) }
          else if (nextTechnique) choose(nextTechnique)
          else if (nextTier) choose(nextTier.techniques[0])
          else onPlay()
        }}>{exercise === 0 ? '換一個例子，再試一格' : nextTechnique ? `下一個${tier.name}技巧 →` : nextTier ? `繼續學${nextTier.name} →` : playLabel}</button>}{tierEnd && nextTier && <button className="button secondary academy-play" onClick={onPlay}>{playLabel}</button>}{passed && exercise === 1 && <button className="text-button change-learning-level" onClick={() => { setPlaying(false); setPickerOpen(true) }}>換個學習難度</button>}</div>
        </div>
      </>}
    </section>
    </div>
    <p className="academy-footnote">練習不計時、不扣提示。隨時可以暫停或重播。</p>
  </main>
}

