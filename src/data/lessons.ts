import type { CellState, Level } from '../types/game'
import type { Technique } from '../game/logic'
import rawScenes from './teaching-scenes.json'

export interface TeachingScene {
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
  { id: 'challenge', name: '挑戰', description: '同時觀察多種顏色', techniques: ['hall2', 'hall3', 'combination'] },
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
  { technique: 'combination', title: '嘗試可能性，但要記得順序唷', takeaway: '先找基礎、進階定石，卡住才嘗試。一次一個假設，有矛盾才能排除。', caution: '一次只試一個假設，回復盤面後再試下一個。沒有發現矛盾，不代表水母一定在那格；不同假設的叉叉不能混在一起。' },
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
  if (exercise === 0) return scene.targets[0]
  const cells = boardCells(scene)
  const poses = teachingPoses(scene, technique)
  // A negative example must survive at least one arrangement, even when all
  // basic rules are considered, rather than merely being absent from our list.
  return cells.find((i) => scene.board[i] === 'empty' && !scene.targets.includes(i) && !scene.sources.includes(i) &&
    poses.some((pose) => pose.every((a) => !conflict(scene, a, i))) &&
    (technique !== 'combination' || !inspectTrial(scene, i).contradiction)) ?? scene.targets[0]
}
export function combinationProof(scene: TeachingScene, assumption: number) {
  const groups = scene.groups.map((group) => group.filter((i) => !conflict(scene, assumption, i)))
  const remaining = groups.flat(), n = scene.level.size
  return {
    groups,
    column: remaining.length && remaining.every((i) => i % n === remaining[0] % n) ? remaining[0] % n : undefined,
    row: remaining.length && remaining.every((i) => Math.floor(i / n) === Math.floor(remaining[0] / n)) ? Math.floor(remaining[0] / n) : undefined,
  }
}

export const TRIAL_STAGES = ['解題順序', '假設一格', '同排', '同列', '同色', '周圍八格', '檢查矛盾', '回復盤面', '得出結論']
export function inspectTrial(scene: TeachingScene, assumption: number) {
  const n = scene.level.size, proof = combinationProof(scene, assumption)
  const available = boardCells(scene).filter((i) => !conflict(scene, assumption, i))
  for (const kind of ['row', 'column', 'region'] as const) for (let id = 0; id < n; id++) {
    const unitId = (i: number) => kind === 'row' ? Math.floor(i / n) : kind === 'column' ? i % n : scene.level.regions[i]
    if (unitId(assumption) === id || available.some((i) => unitId(i) === id)) continue
    return { contradiction: true, row: kind === 'row' ? id : undefined, column: kind === 'column' ? id : undefined,
      attention: boardCells(scene).filter((i) => unitId(i) === id),
      reason: `${kind === 'region' ? colourName(scene, scene.level.regions.indexOf(id)) : `第 ${id + 1} ${kind === 'row' ? '橫排' : '直列'}`}沒有位置能住，這個假設走不通。` }
  }
  const [first, second] = proof.groups
  const contradiction = !first.some((a) => second.some((b) => !conflict(scene, a, b)))
  return { contradiction, row: contradiction ? proof.row : undefined, column: contradiction ? proof.column : undefined,
    attention: contradiction ? proof.groups.flat() : [],
    reason: contradiction ? `兩色剩下的圈圈${proof.row !== undefined ? '擠在同一橫排' : proof.column !== undefined ? '擠在同一直列' : '互相衝突'}，無法各放一隻，這個假設走不通。` : '這次檢查暫時沒有矛盾；還不能確定水母就在這格。' }
}

export function trialFrame(scene: TeachingScene, assumption: number, stage: number) {
  const n = scene.level.size, inspection = inspectTrial(scene, assumption)
  const testing = stage >= 1 && stage <= 6
  const blocked = testing ? boardCells(scene).filter((i) => i !== assumption && (
    (stage >= 2 && Math.floor(i / n) === Math.floor(assumption / n)) ||
    (stage >= 3 && i % n === assumption % n) ||
    (stage >= 4 && scene.level.regions[i] === scene.level.regions[assumption]) ||
    (stage >= 5 && adjacent(i, assumption, n)))) : stage === 8 && inspection.contradiction ? [assumption] : []
  const captions = [
    '先找基礎、進階定石，卡住才嘗試。一次只試一格。',
    '先假設亮框這格住水母。這還不是確定答案。',
    '先看同排：這排其他格子暫時不能住。',
    '再看同列：同一直列的其他格子暫時不能住。',
    '接著看同色：同一顏色的其他格子暫時不能住。',
    '最後看周圍八格：相鄰的格子暫時不能住。',
    inspection.reason,
    '撤回試放的水母和暫時叉叉，回到原盤面，再得出結論。',
    inspection.contradiction ? '剛剛的假設出現矛盾，所以原本試放的這格可以確定畫叉。' : '暫時沒有矛盾，先保留這格；不能直接認定水母就在這裡。',
  ]
  return { pose: testing ? [assumption] : [], hypothesis: testing ? assumption : undefined, blocked,
    row: stage === 6 ? inspection.row : undefined, column: stage === 6 ? inspection.column : undefined,
    attention: stage === 6 ? inspection.attention : [assumption], caption: captions[stage], contradiction: inspection.contradiction }
}
