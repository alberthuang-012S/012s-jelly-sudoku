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
  { technique: 'combination', title: '兩隻一起看，卡住時再用', takeaway: '假設某格住水母後，兩種顏色無法各放一隻，這個假設就不成立，該格可以畫叉。', caution: '適合直線與形狀技巧暫時沒有進展時再用。必須確認兩色的全部可能位置，不能只看自己挑選的幾格。' },
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
    poses.some((pose) => pose.every((a) => !conflict(scene, a, i)))) ?? scene.targets[0]
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
