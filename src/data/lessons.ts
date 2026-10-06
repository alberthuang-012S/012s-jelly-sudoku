import type { CellState, Level } from '../types/game'
import type { Technique } from '../game/logic'
import { traceTrial, trialStart } from '../game/trial'
import rawScenes from './teaching-scenes.json'

export interface TeachingScene {
  endgame?: boolean
  level: Level
  board: CellState[]
  sources: number[]
  targets: number[]
  groups: number[][]
}
export type LessonTechnique = Exclude<Technique, 'placed' | 'single' | 'common'>
export interface Lesson { technique: LessonTechnique; title: string; takeaway: string; caution: string }
export const LESSON_TIERS: { id: string; name: string; description: string; techniques: LessonTechnique[] }[] = [
  { id: 'basic', name: '基礎', description: '直線、兩格與三格排除', techniques: ['line', 'pair', 'triple'] },
  { id: 'advanced', name: '進階', description: '轉彎、Z 型與反向鎖定', techniques: ['bend', 'zigzag', 'reverse'] },
  { id: 'challenge', name: '挑戰', description: '多色排除與殘局嘗試', techniques: ['hall2', 'hall3', 'combination'] },
]
export function lessonTierFor(technique: LessonTechnique) { return LESSON_TIERS.find((tier) => tier.techniques.includes(technique))! }
export function canTeach(technique?: Technique): technique is LessonTechnique { return lessons.some((lesson) => lesson.technique === technique) }
export const lessons: Lesson[] = [
  { technique: 'line', title: '一種顏色，占住一整排', takeaway: '這個顏色只能住這排，這排其他顏色就不能住。', caution: '必須是所有可能的位置都在這排；如果其他排還有位置，就不能直接套用。直列也一樣。' },
  { technique: 'pair', title: '只剩兩格，旁邊先畫叉', takeaway: '不管住兩格中的哪一格，側邊四格都會碰到水母。', caution: '必須只剩這兩格。這課先看周圍四格，同排或同列的排除可另外接著做。靠邊界時，盤面內的側邊格會比較少。' },
  { technique: 'triple', title: '三格直線，中心兩側不能住', takeaway: '不管住上、中、下，中心兩側都離水母太近。橫向也一樣。', caution: '如果延長成四格直線，中心兩側不一定都會碰到水母，需要重新比較。' },
  { technique: 'bend', title: '轉一個彎，三格可以畫叉', takeaway: '只剩 L 形三格時，凹角與彎角外側兩格，每種位置都會違反同排、同列或相鄰規則。', caution: '必須只剩 L 形這三格。靠邊界時，盤面內可能少於三格可以畫叉；已畫叉的格子也不用重複標記。旋轉或翻面同理。' },
  { technique: 'zigzag', title: 'Z 形缺角，為什麼能畫叉？', takeaway: '不論選哪一格，缺角都會違反同排、同列或相鄰規則。', caution: '看起來像 Z 還不夠，圈外如果有別的可能位置，就要重新比較。' },
  { technique: 'hall2', title: '兩種顏色，留下兩排', takeaway: '兩種顏色各一隻，必須分占這兩排，所以其他顏色不能放進來。', caution: '兩種顏色的所有可能位置，合起來只能占這兩排；兩排不必相鄰，直列也適用。' },
  { technique: 'hall3', title: '三種顏色，留下三排', takeaway: '三種顏色各一隻，剛好需要這三排，其他顏色不能放進來。', caution: '每種顏色不必跨滿三排，只要所有可能位置合計限制在這三排即可。四種占四排同理。' },
  { technique: 'reverse', title: '這一排，只能留給同一種顏色', takeaway: '這排剩下的位置全是同一種顏色，所以這個顏色一定住這排。', caution: '如果這排還有其他顏色能住，就不能確定。直列也適用。' },
  { technique: 'combination', title: '嘗試可能性，但要記得順序唷', takeaway: '只剩 A、B 兩格：試 A、看出矛盾、全部撤回，再確認 B，接著完成殘局。', caution: '一次只試一個假設，回復盤面後再試下一個。沒有發現矛盾，不代表水母一定在那格；不同假設的叉叉不能混在一起。' },
]
export const teachingScenes = rawScenes as unknown as Record<LessonTechnique, [TeachingScene, TeachingScene]>
const colourNames = ['黃色', '粉紅色', '橘色', '淺綠色', '綠色', '水藍色', '藍色', '紫色', '桃紅色', '灰色']
export function colourName(scene: TeachingScene, i: number) { return colourNames[scene.level.palette?.[scene.level.regions[i]] ?? scene.level.regions[i]] }
export function conflict(scene: TeachingScene, a: number, b: number) {
  const n = scene.level.size
  return a !== b && (Math.floor(a / n) === Math.floor(b / n) || a % n === b % n || scene.level.regions[a] === scene.level.regions[b] || adjacent(a, b, n))
}
function adjacent(a: number, b: number, n: number) { return a !== b && Math.max(Math.abs(Math.floor(a / n) - Math.floor(b / n)), Math.abs(a % n - b % n)) <= 1 }
export function teachingPoses(scene: TeachingScene, technique: Technique): number[][] {
  if (!['hall2', 'hall3', 'combination'].includes(technique)) return scene.sources.map((i) => [i])
  let poses: number[][] = [[]]
  for (const group of scene.groups) poses = poses.flatMap((pose) => group.filter((i) => pose.every((j) => !conflict(scene, i, j))).map((i) => [...pose, i]))
  return poses
}
export function boardCells(scene: TeachingScene): number[] {
  const n = scene.level.size
  return Array.from({ length: n * n }, (_, i) => i)
}
export function poseExclusions(scene: TeachingScene, technique: Technique, pose: number[], cells = boardCells(scene)) {
  const n = scene.level.size
  return cells.filter((i) => !pose.includes(i) && !scene.sources.includes(i) && scene.board[i] !== 'jelly' && scene.board[i] !== 'marked' && pose.some((a) => {
    if (['pair', 'triple'].includes(technique)) return adjacent(a, i, n)
    if (technique === 'line') return Math.floor(a / n) === Math.floor(i / n)
    if (technique === 'reverse') return scene.level.regions[a] === scene.level.regions[i]
    return conflict(scene, a, i)
  }))
}
export function quizCell(scene: TeachingScene, technique: Technique, exercise: number): number {
  if (exercise === 0 || technique === 'combination') return scene.targets[0]
  const cells = boardCells(scene)
  const poses = teachingPoses(scene, technique)
  // A negative example must survive at least one arrangement, even when all
  // basic rules are considered, rather than merely being absent from our list.
  return cells.find((i) => scene.board[i] === 'empty' && !scene.targets.includes(i) && !scene.sources.includes(i) &&
    poses.some((pose) => pose.every((a) => !conflict(scene, a, i)))) ?? scene.targets[0]
}
export function confirmedCells(scene: TeachingScene) { return boardCells(scene).filter((i) => scene.board[i] === 'jelly') }
export function outsideProof(scene: TeachingScene, cell: number) {
  const blocked = scene.sources.filter((i) => conflict(scene, cell, i))
  const remaining = scene.sources.length - blocked.length
  return { pose: [cell], hypothesis: cell, blocked, attention: scene.sources, contradiction: remaining === 0,
    caption: remaining === 0 ? `如果旁邊這格住水母，${colourName(scene, scene.sources[0])}的 ${scene.sources.length} 格全部不能住，這個顏色就沒有水母了！所以旁邊這格可以畫叉。` : `試放後，${colourName(scene, scene.sources[0])}仍有 ${remaining} 格能住。這條線索還不能排除試放格。` }
}
interface ShapeFrame {
  view: 'colour' | 'outside'; kind: 'intro' | 'placement' | 'conclusion'
  caption: string; pose: number[]; blocked: number[]; attention: number[]; hypothesis?: number
}
export function shapeFrames(scene: TeachingScene, technique: 'bend' | 'zigzag'): ShapeFrame[] {
  const colour = colourName(scene, scene.sources[0])
  const colourFrames: ShapeFrame[] = [
    { view: 'colour', kind: 'intro', caption: `先從顏色看：${colour}共 ${scene.sources.length} 格，水母會住其中一格。接著還會從旁邊試放，再看一次。`, pose: [], blocked: [], attention: [] },
    ...teachingPoses(scene, technique).map((pose): ShapeFrame => ({ view: 'colour', kind: 'placement', caption: '如果水母住這格，打叉的位置就不能住。換下一格，比較哪些位置每次都被擋住。', pose, blocked: poseExclusions(scene, technique, pose), attention: [] })),
    { view: 'colour', kind: 'conclusion', caption: `第一種看法：不管住哪格，旁邊這 ${scene.targets.length} 格都不能住。接著反過來試放旁邊，看看為什麼。`, pose: [], blocked: scene.targets, attention: [] },
  ]
  const outsideFrames: ShapeFrame[] = [
    { view: 'outside', kind: 'intro', caption: `現在看第二種：先撤回水母，再試放旁邊的格子。輔助會標出不能住的位置，看看${colour}是否還能放。`, pose: [], blocked: [], attention: scene.sources },
    ...scene.targets.map((cell): ShapeFrame => ({ view: 'outside', kind: 'placement', ...outsideProof(scene, cell) })),
    { view: 'outside', kind: 'conclusion', caption: `兩種看法得到相同結果：旁邊這 ${scene.targets.length} 格都不能住。撤回試放與輔助標記，只留下確定的叉。`, pose: [], blocked: scene.targets, attention: [] },
  ]
  return [...colourFrames, ...outsideFrames]
}
export interface TrialFrame {
  name: string; kind: 'start' | 'candidates' | 'trial' | 'failure' | 'restore' | 'confirm' | 'finish'
  caption: string; pose: number[]; blocked: number[]; attention: number[]
  hypothesis?: number; confirmed?: boolean; row?: number; column?: number
}
export function trialFrames(scene: TeachingScene): TrialFrame[] {
  const confirmed = confirmedCells(scene), [a, b] = scene.sources, n = scene.level.size
  const { context } = trialStart(scene.level, confirmed)
  const forcedReason = (cells: number[]) => {
    const unit = context.units.find((u) => u.cells.length === cells.length && u.cells.every((i, j) => i === cells[j]))!
    const label = unit.kind === 'region' ? colourName(scene, cells[0]) : `第 ${unit.id + 1} ${unit.kind === 'row' ? '橫排' : '直列'}`
    return `${label}只剩這格能放水母。`
  }
  const bad = traceTrial(scene.level, confirmed, a), good = traceTrial(scene.level, confirmed, b)
  if (!bad.failure || !good.solved) throw new Error('Endgame must disprove A and solve from B')
  const region = boardCells(scene).filter((i) => scene.level.regions[i] === scene.level.regions[a])
  const frame = (kind: TrialFrame['kind'], name: string, caption: string, pose: number[] = [], blocked: number[] = [], attention: number[] = []): TrialFrame => ({ kind, name, caption, pose, blocked, attention })
  const exclusions = (pose: number[], unit: number[]) => {
    const { state } = trialStart(scene.level, [...confirmed, ...pose])
    return unit.filter((i) => !confirmed.includes(i) && !pose.includes(i) && !state.candidates.has(i))
  }
  const frames: TrialFrame[] = [
    frame('start', '觀察殘局', `已經確認 ${confirmed.length} 隻水母，還差 ${n - confirmed.length} 隻。從${colourName(scene, a)}的 A、B 兩格開始。`),
    frame('candidates', '為什麼只剩兩格', '依照已放好的水母，這個顏色其他格子都不能住，只剩 A、B。先試 A。', [], exclusions([], region), region),
  ]
  bad.additions.forEach((addition, index) => {
    const pose = bad.additions.slice(0, index + 1).map((x) => x.cell)
    frames.push({ ...frame('trial', index ? '順著假設推導' : '假設 A', index ? `如果 A 成立，${forcedReason(addition.unit)}這隻也只是暫時推導。` : '先假設 A 住水母。接下來同排、同列、同色與周圍都不能再住。', pose, exclusions(pose, index ? addition.unit : []), index ? addition.unit : [a]), hypothesis: a })
  })
  const failure = bad.failure
  const unitName = failure.kind === 'region' ? colourName(scene, failure.cells[0]) : `第 ${failure.id + 1} ${failure.kind === 'row' ? '橫排' : '直列'}`
  frames.push({ ...frame('failure', '發現矛盾', `${unitName}還需要一隻水母，卻沒有任何位置能住。A 走不通！`, bad.additions.map((x) => x.cell), failure.cells, failure.cells), hypothesis: a,
    row: failure.kind === 'row' ? failure.id : undefined, column: failure.kind === 'column' ? failure.id : undefined })
  frames.push(frame('restore', '全部撤回', '撤回 A 和暫時推導的水母，回到原本殘局。輔助也還原，再從另一格開始。'))
  good.additions.forEach((addition, index) => {
    const pose = good.additions.slice(0, index + 1).map((x) => x.cell)
    frames.push({ ...frame('confirm', index ? '接著找下一隻' : '排除 A，確認 B', index ? `${forcedReason(addition.unit)}接著確認這隻。` : 'A 走不通，而同色只剩 A、B，所以 B 一定住水母。', pose, [...new Set([a, ...(index ? exclusions(pose, addition.unit) : [])])], index ? addition.unit : [b]), confirmed: true })
  })
  frames.push({ ...frame('finish', '完成殘局', `${n} 隻水母都找到了，殘局完成！`, good.additions.map((x) => x.cell), [a]), confirmed: true })
  return frames
}
