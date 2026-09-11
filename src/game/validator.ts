import type { Level } from '../types/game'
import { validateRegionConnectivity, validateRegionPalette, type RegionConnectivityValidation, type RegionPaletteValidation } from './regions'
import { isBoardSolved, solutionToBoard } from './rules'
import { solveLevel } from './solver'

export interface LevelValidation {
  valid: boolean
  errors: string[]
  solutionCount: number
  regionConnectivity: RegionConnectivityValidation
  regionPalette: RegionPaletteValidation
}

export function validateLevel(level: Level): LevelValidation {
  const errors: string[] = []
  const { size } = level
  const expectedCells = size * size
  const regionConnectivity = validateRegionConnectivity(level)
  const regionPalette = validateRegionPalette(level)
  if (!Number.isInteger(size) || size < 1) errors.push('棋盤尺寸無效')
  if (level.regions.length !== expectedCells) errors.push('Region 格數不正確')
  if (level.solution.length !== size) errors.push('Solution 水母數量不正確')

  const regionIds = new Set(level.regions)
  if (regionIds.size !== size) errors.push('Region 數量必須等於棋盤邊長')
  for (const region of level.regions) {
    if (!Number.isInteger(region) || region < 0 || region >= size) {
      errors.push('Region ID 超出範圍')
      break
    }
  }
  if (level.regions.some((region) => region === undefined || region === null)) errors.push('存在沒有 Region 的格子')

  const regionSizes = new Map<number, number>()
  for (const region of level.regions) regionSizes.set(region, (regionSizes.get(region) ?? 0) + 1)
  if (regionSizes.size === size && [...regionSizes.values()].some((count) => count === 0)) errors.push('存在空 Region')

  if (errors.length > 0) return { valid: false, errors: [...new Set(errors)], solutionCount: 0, regionConnectivity, regionPalette }

  errors.push(...regionConnectivity.errors)
  errors.push(...regionPalette.errors)

  const solutionBoard = solutionToBoard(level)
  if (!isBoardSolved(solutionBoard, level)) errors.push('Solution 不符合完整規則')
  const solveResult = solveLevel(level, 2)
  if (solveResult.solutionCount !== 1) errors.push(`Solution 唯一性失敗：找到 ${solveResult.solutionCount} 個解`)
  return { valid: errors.length === 0, errors: [...new Set(errors)], solutionCount: solveResult.solutionCount, regionConnectivity, regionPalette }
}

export function validateAllLevels(levels: Level[]): LevelValidation[] {
  return levels.map(validateLevel)
}
