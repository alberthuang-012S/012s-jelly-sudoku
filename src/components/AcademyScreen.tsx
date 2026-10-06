import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { lessons, teachingScenes, teachingPoses, boardCells, poseExclusions, quizCell, colourName, LESSON_TIERS, lessonTierFor, canTeach, trialFrames, outsideProof, shapeFrames, type TeachingScene, type Lesson, type LessonTechnique } from '../data/lessons'
import { TECHNIQUES, type Technique } from '../game/logic'
import { getConstraintOverlay } from '../game/rules'
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

function TeachingBoard({ scene, technique, pose = [], blocked = [], question, hypothesis, focusColumn, focusRow, attention = [], confirmedPose = false, assist = false }: {
  scene: TeachingScene; technique: LessonTechnique; pose?: number[]; blocked?: number[]; question?: number; hypothesis?: number; focusColumn?: number; focusRow?: number; attention?: number[]; confirmedPose?: boolean; assist?: boolean
}) {
  const cells = boardCells(scene), n = scene.level.size
  const activeRows = new Set(scene.sources.map((i) => Math.floor(i / n)))
  const visibleBoard = scene.board.map((cell, i) => pose.includes(i) ? 'jelly' as const : cell)
  const hasAssist = scene.endgame || assist
  const overlay = hasAssist ? getConstraintOverlay(visibleBoard, scene.level) : new Set<number>()
  const displayedBlocks = new Set([...blocked, ...overlay].filter((i) => visibleBoard[i] !== 'jelly'))
  const crossCount = cells.filter((i) => i !== question && displayedBlocks.has(i)).length
  return <div className="teaching-board" role="img" aria-label={`${scene.level.size}乘${scene.level.size}正式關卡完整盤面，${hypothesis !== undefined ? `假設水母住${position(hypothesis, n)}` : pose.length ? `${confirmedPose ? '已確認水母' : '水母試住'}${pose.map((i) => position(i, n)).join('、')}` : scene.endgame ? '原本已確認的水母保留，A、B 是同色僅剩的兩個候選位置' : technique === 'reverse' ? '圈起的位置是這排同色的格子' : '圈起的位置是本課顏色的所有格子'}${crossCount ? hasAssist ? `，輔助標示 ${crossCount} 格不能住` : `，本次排除 ${crossCount} 格畫叉` : ''}${question !== undefined ? `，問題格在${position(question, n)}` : ''}`}>
    <div className="teaching-matrix" style={{ '--teaching-columns': n } as CSSProperties}>{cells.map((i) => {
      const region = scene.level.regions[i], row = Math.floor(i / n), column = i % n
      const isSource = scene.sources.includes(i), isPose = pose.includes(i), oldJelly = scene.board[i] === 'jelly'
      const isBlocked = displayedBlocks.has(i)
      const isQuestion = question === i
      const isMarked = !isQuestion && isBlocked
      const isRow = ['line', 'hall2', 'hall3', 'reverse'].includes(technique) && activeRows.has(row)
      const isHypothesis = hypothesis === i, isFocusedUnit = column === focusColumn || row === focusRow
      const reverseProof = hypothesis !== undefined && !scene.sources.includes(hypothesis) && ['bend', 'zigzag'].includes(technique)
      const rule = isBlocked && pose.length && ((technique === 'bend' && scene.targets.includes(i) && !reverseProof) || (reverseProof && isSource)) ? Math.floor(pose[0] / n) === row ? '同排' : pose[0] % n === column ? '同列' : '相鄰' : null
      const palette = scene.level.palette?.[region] ?? region
      return <span key={i} data-cell={i} className={`teaching-cell ${scene.endgame ? 'endgame-cell' : ''} ${hasAssist ? 'assist-cell' : ''} ${isSource ? 'source' : ''} ${isPose ? confirmedPose ? 'confirmed-placement' : 'trial' : ''} ${isMarked ? 'blocked' : ''} ${isQuestion ? 'question' : ''} ${isRow ? 'reserved-row' : ''} ${isHypothesis ? 'hypothesis' : ''} ${isFocusedUnit ? 'contradiction-unit' : ''} ${attention.includes(i) ? 'attention' : ''}`} style={{
        '--teaching-colour': REGION_PALETTE[palette].color,
        borderTopWidth: row === 0 || scene.level.regions[i - n] !== region ? 2 : 1,
        borderLeftWidth: column === 0 || scene.level.regions[i - 1] !== region ? 2 : 1,
      } as CSSProperties}>
        {(isPose || oldJelly) && <img className={isPose || isSource ? '' : scene.endgame ? 'known-jelly' : 'earlier-jelly'} src={assets.jellyCute} alt="" />}
        {isSource && !isPose && !oldJelly && !isMarked && <span className="candidate-ring" />}
        {isMarked && <span className="teaching-x">×</span>}
        {isQuestion && <span className="question-bubble">?</span>}
        {rule && <span className="teaching-rule">{rule}</span>}
        {scene.endgame && isSource && <span className="candidate-letter">{i === scene.sources[0] ? 'A' : 'B'}</span>}
        {scene.endgame && isPose && !confirmedPose && !isHypothesis && <span className="hypothesis-label">暫時推導</span>}
        {isHypothesis && <span className="hypothesis-label">{scene.endgame ? '假設 A' : '假設'}</span>}
      </span>
    })}</div>
    <small>{scene.endgame ? confirmedPose && pose.length + scene.board.filter((cell) => cell === 'jelly').length === n ? '殘局完成 · 每排、每列、每色各一隻' : '殘局 · 水母已確認，A／B 待判斷' : `完整盤面 · ${n}×${n}`} </small>
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
  const [proofView, setProofView] = useState<'colour' | 'outside'>('colour')
  const [reviewView, setReviewView] = useState<'colour' | 'outside'>('outside')
  const tier = lessonTierFor(technique)
  const nextTechnique = tier.techniques[tier.techniques.indexOf(technique) + 1]
  const nextTier = LESSON_TIERS[LESSON_TIERS.indexOf(tier) + 1]
  const lesson = lessons.find((l) => l.technique === technique)!
  const scene = teachingScenes[technique][exercise], poses = teachingPoses(scene, technique)
  const structural = technique === 'hall2' || technique === 'hall3'
  const trial = technique === 'combination'
  const shapeProof = technique === 'bend' || technique === 'zigzag'
  const shapes = shapeProof ? shapeFrames(scene, technique) : []
  const question = quizCell(scene, technique, exercise)
  const frames = trial ? trialFrames(scene) : []
  const goodFrames = frames.filter((frame) => frame.kind === 'confirm' || frame.kind === 'finish')
  const failureIndex = frames.findIndex((frame) => frame.kind === 'failure')
  const trialState = trial ? phase === 'demo' ? frames[step] : comparison >= 3 ? goodFrames[comparison - 3] : frames[comparison === 0 ? failureIndex - 1 : comparison === 1 ? failureIndex : comparison === 2 ? failureIndex + 1 : 0] : undefined
  const trialFinished = trial && comparison === goodFrames.length + 2
  const tierEnd = passed && exercise === 1 && !nextTechnique && (!trial || trialFinished)
  const lastStep = trial ? frames.length - 1 : shapeProof ? shapes.length - 1 : (structural ? poses.slice(0, 2) : poses).length + 1
  const isLast = step === lastStep
  const shapeBase = shapeProof && phase === 'demo' ? isLast && reviewView === 'colour' ? shapes.find((frame) => frame.view === 'colour' && frame.kind === 'conclusion') : shapes[step] : undefined
  const fromOutside = shapeProof && (phase === 'demo' ? shapeBase?.view === 'outside' : proofView === 'outside')
  const shownPoses = fromOutside ? scene.targets.map((i) => [i]) : structural ? poses.slice(0, 2) : poses
  const comparing = phase === 'demo' && (shapeBase ? shapeBase.kind === 'conclusion' : isLast && comparePositions(technique))
  const outsideState = fromOutside ? phase === 'practice' ? outsideProof(scene, question) : shapeBase?.hypothesis !== undefined ? outsideProof(scene, shapeBase.hypothesis) : comparing && comparison >= 0 ? outsideProof(scene, scene.targets[comparison]) : undefined : undefined
  const shapeState = shapeBase && comparing && comparison >= 0 && !fromOutside ? { ...shapeBase, pose: shownPoses[comparison], caption: '從顏色看：住在這個位置，也會擋住這些共同禁放格。' } : shapeBase
  const hypothesis = trialState?.hypothesis ?? outsideState?.hypothesis
  const activePose = outsideState?.pose ?? shapeState?.pose ?? trialState?.pose ?? (comparing && comparison >= 0 ? shownPoses[comparison] : step > 0 && !isLast ? shownPoses[step - 1] : [])
  const activeBlocks = outsideState?.blocked ?? shapeState?.blocked ?? trialState?.blocked ?? (step === 0 ? [] : isLast ? scene.targets : poseExclusions(scene, technique, activePose))
  const expected = trial || scene.targets.includes(question)
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
    setTechnique(next); setPhase('demo'); setStep(0); setExercise(0); setPlaying(!reducedMotion() && (closePicker || !pickerOpen)); setAnswer(null); setPassed(false); setComparison(-1); setProofView('colour'); setReviewView('outside')
    if (closePicker) setPickerOpen(false)
  }
  function practice() { setPhase('practice'); setPlaying(false); setAnswer(null); setPassed(false); setComparison(-1); setProofView('colour'); setReviewView('outside') }
  function reviewDirection(view: 'colour' | 'outside') { setReviewView(view); setComparison(-1); setPlaying(false) }
  function respond(value: boolean) {
    setAnswer(value)
    const correct = value === expected
    setPassed(correct)
    if (correct && shapeProof) { setProofView('colour'); setReviewView('outside') }
    if (correct && trial) setComparison(3)
    if (correct && exercise === 1 && !trial) recordCompletion()
  }
  function recordCompletion() {
    const next = [...new Set([...completed, technique])]
    setCompleted(next)
    try { getBrowserStorage()?.setItem(KEY, JSON.stringify(next)) } catch { /* Practice remains available without storage. */ }
  }
  const menuLabels: Partial<Record<LessonTechnique, string>> = { line: '直線', pair: '相鄰兩格', triple: '三格直線', bend: '轉一個彎', zigzag: 'Z 型', reverse: '這一排' }
  let caption = intro(scene, lesson)
  if (step > 0 && !isLast) {
    if (structural) caption = `${step === 1 ? '一種可能的安排' : '換一種安排'}：${scene.groups.length} 隻水母必須分占 ${scene.groups.length} 個橫排。`
    else if (technique === 'bend') caption = '如果水母住這格，同排、同列與周圍都不能再住另一隻。'
    else caption = `如果水母住這一格，${technique === 'line' ? '這排其他顏色' : technique === 'reverse' ? '同色區域的其他位置' : '打叉的位置'}就不能再住另一隻。`
  }
  if (isLast) caption = structural ? `${scene.groups.length} 種顏色剛好需要這 ${scene.groups.length} 排，其他顏色不能放進來。` : `不管選哪個位置，這 ${scene.targets.length} 格每次都不能住，所以可以先畫叉。`
  if (shapeState) caption = outsideState?.caption ?? shapeState.caption
  if (trialState) caption = trialState.caption
  const practicePrompt = outsideState ? outsideState.caption : trial ? comparison === -1 ? '先試 A，順著假設推導；找到矛盾後，全部撤回，再決定選哪格。' : comparison === 0 ? trialState!.caption : comparison === 1 ? trialState!.caption : '已回復原本殘局。A 出現矛盾，這個顏色只剩 A、B，接下來應該選哪格？' : `${exercise === 1 ? '換一個盤面。' : ''}只用剛剛的線索，圈起的問號格能確定畫叉嗎？`
  const clueLegend = outsideState ? '框起＝該顏色所有格子' : trial ? trialState?.confirmed ? 'A 已排除 · B 已確認' : 'A、B＝同色僅剩的兩格' : technique === 'reverse' ? '圈圈＝這排同色的格子' : '圈圈＝該顏色所有格子'


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
    <section className={`lesson-card phase-${phase} ${trial ? 'endgame-lesson' : ''}`}>
      <div className="lesson-card-heading"><h2>{lesson.title}</h2><span>{phase === 'demo' ? '看示範' : `小練習 ${exercise + 1} / 2`}</span></div>
      {phase === 'demo' ? <>
        <div className="demo-progress"><progress max={lastStep + 1} value={step + 1} aria-label="示範進度" /><small>第 {step + 1} / {lastStep + 1} 步{trial ? ` · ${frames[step].name}` : shapeProof ? isLast ? ' · 兩種都看了' : fromOutside ? ' · ② 從旁邊看' : ' · ① 從顏色看' : ''}</small><button className="text-button playback-toggle" onClick={() => { if (isLast) { setStep(0); setComparison(-1); setReviewView('outside') }; setPlaying(isLast ? true : !playing) }}>{isLast ? '重播' : playing ? '暫停播放' : '播放示範'}</button></div>
        <p className={`teaching-caption ${isLast ? 'is-conclusion' : ''}`} aria-live="polite"><span className="demo-caption">{caption}</span>{isLast && <span className="mobile-takeaway">{trial || shapeProof ? caption : lesson.takeaway}</span>}</p>
        <div className="comparison-switcher">{shapeProof && !comparing && <div className="proof-directions" aria-label="依序學習兩種看法"><span aria-current={!fromOutside ? 'step' : undefined}>① 從顏色看{fromOutside && ' ✓'}</span><span aria-current={fromOutside ? 'step' : undefined}>② 從旁邊試放</span></div>}{comparing && <nav aria-label="比較每一種可能">{shownPoses.map((_, i) => <button key={i} data-pose={i} aria-pressed={comparison === i} onClick={() => setComparison(i)}>{fromOutside ? '旁邊' : '位置'} {i + 1}</button>)}<button data-pose="common" aria-pressed={comparison === -1} onClick={() => setComparison(-1)}>{fromOutside ? '撤回畫叉' : '共同禁區'}</button>{shapeProof && isLast && <button className={fromOutside ? 'view-colour' : 'view-outside'} onClick={() => reviewDirection(fromOutside ? 'colour' : 'outside')}>{fromOutside ? '從顏色看' : '從旁邊看'}</button>}</nav>}</div>
        <TeachingBoard scene={scene} technique={technique} pose={activePose} blocked={activeBlocks} hypothesis={hypothesis} assist={fromOutside} confirmedPose={trialState?.confirmed} focusColumn={trialState?.column} focusRow={trialState?.row} attention={outsideState?.attention ?? shapeState?.attention ?? trialState?.attention} />
        <div className="board-context"><span>{clueLegend}</span><span>{trial ? '輔助開 · 斜線＋× 隨水母更新' : fromOutside ? '輔助開 · 斜線＋× 隨試放更新' : '×＝本次排除的位置'}</span></div>
        {isLast && <p className="takeaway">{lesson.takeaway}</p>}
        <div className="lesson-actions demo-controls"><button className="button secondary previous-step" disabled={step === 0} onClick={() => { setPlaying(false); setComparison(-1); setStep(step - 1) }}>上一步</button><button className="button primary next-step" onClick={() => { setPlaying(false); setComparison(-1); if (isLast) practice(); else setStep(step + 1) }}>{isLast ? trial ? '換你解殘局，試試看' : shapeProof ? '兩種都看了，試試看' : '判斷一格，試試看' : shapeBase?.view === 'colour' && shapeBase.kind === 'conclusion' ? '接著看另一種方法 →' : '下一步'}</button></div>
      </> : <>
        <div className="demo-progress"><small>小練習 {exercise + 1} / 2 · {trial ? '解開殘局' : '判斷問號格'}</small></div>
        <div className="teaching-caption">{answered ? <div className={`quiz-feedback ${passed ? 'correct' : ''}`} role="status"><strong>{passed ? '判斷正確！' : '再看一次線索。'}</strong><p>{trial ? passed ? trialState!.caption : 'A 已經導致矛盾；先撤回，再選同色的另一格 B。' : passed ? expected ? lesson.takeaway : '這格還不能確定排除，先保留。' : '只有每次都不能住的格子，才能確定畫叉。'}</p>{passed && exercise === 1 && !trial && <details className="lesson-caution"><summary>什麼情況不能直接套用？</summary><p>{lesson.caution}</p></details>}</div> : <p>{practicePrompt}</p>}</div>
        <div className="comparison-switcher">{shapeProof && !passed && <nav aria-label="練習推理方向"><button className="view-colour" aria-pressed={!fromOutside} onClick={() => setProofView('colour')}>看原線索</button><button className="view-outside" aria-pressed={fromOutside} onClick={() => setProofView('outside')}>試問號格</button></nav>}{trial && trialFinished && exercise === 1 && <details className="lesson-caution"><summary>什麼情況不能直接套用？</summary><p>{lesson.caution}</p></details>}{trial && !passed && <nav aria-label="嘗試順序"><button className="trial-place" aria-pressed={comparison === 0} disabled={comparison === 0 || comparison === 1} onClick={() => { setAnswer(null); setComparison(0) }}>① 試 A</button><button className="trial-check" aria-pressed={comparison === 1} disabled={comparison !== 0} onClick={() => { setAnswer(null); setComparison(1) }}>② 檢查</button><button className="trial-restore" aria-pressed={comparison === 2} disabled={comparison !== 1} onClick={() => { setAnswer(null); setComparison(2) }}>③ 回復</button></nav>}</div>
        <TeachingBoard scene={scene} technique={technique} question={!trial && hypothesis === undefined ? question : undefined} pose={outsideState?.pose ?? trialState?.pose} blocked={outsideState?.blocked ?? trialState?.blocked} hypothesis={hypothesis} assist={fromOutside} confirmedPose={trialState?.confirmed} focusColumn={trialState?.column} focusRow={trialState?.row} attention={outsideState?.attention ?? shapeState?.attention ?? trialState?.attention} />
        <div className="board-context"><span>{clueLegend}</span><span>{trial ? '輔助開 · 斜線＋× 隨水母更新' : fromOutside ? '輔助開 · 斜線＋× 隨試放更新' : '問號＝這次要判斷的格子'}</span></div>
        <div className="lesson-actions">
        <div className="quiz-actions" hidden={passed}><button className="button primary answer-yes" disabled={passed || (trial && comparison !== 2)} onClick={() => respond(true)}>{trial ? '改選 B' : '可以確定畫叉'}</button><button className="button secondary answer-no" disabled={passed || (trial && comparison !== 2)} onClick={() => respond(false)}>{trial ? '繼續選 A' : '還不能確定'}</button></div>
        <div className={`practice-controls ${tierEnd ? 'tier-end-controls' : ''}`}><button className="text-button replay-example" onClick={() => { setPhase('demo'); setStep(0); setPlaying(!reducedMotion()); setAnswer(null); setPassed(false); setComparison(-1); setProofView('colour'); setReviewView('outside') }}>回看這個例子</button>{passed && <button className="button primary continue-practice" onClick={() => {
          if (trial && !trialFinished) { setComparison(comparison + 1); if (exercise === 1 && comparison + 1 === goodFrames.length + 2) recordCompletion(); return }
          if (exercise === 0) { setExercise(1); setAnswer(null); setPassed(false); setComparison(-1); setProofView('colour'); setReviewView('outside') }
          else if (nextTechnique) choose(nextTechnique)
          else if (nextTier) choose(nextTier.techniques[0])
          else onPlay()
        }}>{trial && !trialFinished ? '接著推導 →' : exercise === 0 ? trial ? '換一個殘局，再試一次' : '換一個例子，再試一格' : nextTechnique ? `下一個${tier.name}技巧 →` : nextTier ? `繼續學${nextTier.name} →` : playLabel}</button>}{tierEnd && nextTier && <button className="button secondary academy-play" onClick={onPlay}>{playLabel}</button>}{passed && exercise === 1 && (!trial || trialFinished) && <button className="text-button change-learning-level" onClick={() => { setPlaying(false); setPickerOpen(true) }}>換個學習難度</button>}</div>
        </div>
      </>}
    </section>
    </div>
    <p className="academy-footnote">練習不計時、不扣提示。隨時可以暫停或重播。</p>
  </main>
}

