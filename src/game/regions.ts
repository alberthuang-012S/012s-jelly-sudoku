import type { Level } from '../types/game'
import { REGION_PALETTE } from '../config/regionPalette'

export interface RegionConnectivityDetail {
  regionId: number
  totalRegionCellCount: number
  connectedCellCount: number
  connected: boolean
}

export interface RegionConnectivityValidation {
  valid: boolean
  errors: string[]
  details: RegionConnectivityDetail[]
}

export interface RegionPaletteValidation {
  valid: boolean
  errors: string[]
}

export function getOrthogonalNeighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size)
  const column = index % size
  const neighbors: number[] = []
  if (row > 0) neighbors.push(index - size)
  if (row < size - 1) neighbors.push(index + size)
  if (column > 0) neighbors.push(index - 1)
  if (column < size - 1) neighbors.push(index + 1)
  return neighbors
}

export function getRegionAdjacency(regions: number[], size: number): Set<number>[] {
  const adjacency = Array.from({ length: size }, () => new Set<number>())
  for (let index = 0; index < regions.length; index += 1) {
    for (const neighbor of getOrthogonalNeighbors(index, size)) {
      const firstRegion = regions[index]
      const secondRegion = regions[neighbor]
      if (firstRegion >= 0 && firstRegion < size && secondRegion >= 0 && secondRegion < size && firstRegion !== secondRegion) {
        adjacency[firstRegion].add(secondRegion)
      }
    }
  }
  return adjacency
}

export function getRegionConnectivity(regions: number[], size: number, regionId: number): RegionConnectivityDetail {
  const regionCells = regions.flatMap((region, index) => (region === regionId ? [index] : []))
  if (regionCells.length === 0) {
    return { regionId, totalRegionCellCount: 0, connectedCellCount: 0, connected: false }
  }

  const regionCellSet = new Set(regionCells)
  const visited = new Set<number>()
  const queue = [regionCells[0]]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    for (const neighbor of getOrthogonalNeighbors(current, size)) {
      if (regionCellSet.has(neighbor) && !visited.has(neighbor)) queue.push(neighbor)
    }
  }

  return {
    regionId,
    totalRegionCellCount: regionCells.length,
    connectedCellCount: visited.size,
    connected: visited.size === regionCells.length,
  }
}

export function isRegionConnected(regions: number[], size: number, regionId: number): boolean {
  return getRegionConnectivity(regions, size, regionId).connected
}

export function validateRegionConnectivity(level: Level): RegionConnectivityValidation {
  const details = Array.from({ length: level.size }, (_, regionId) => getRegionConnectivity(level.regions, level.size, regionId))
  const errors = details
    .filter((detail) => !detail.connected)
    .map((detail) => `Region ${detail.regionId} 未連通：${detail.connectedCellCount}/${detail.totalRegionCellCount} 格相連`)
  return { valid: errors.length === 0, errors, details }
}

export function validateRegionPalette(level: Level): RegionPaletteValidation {
  if (!level.palette) return { valid: true, errors: [] }
  const errors: string[] = []
  if (level.palette.length !== level.size) errors.push('Region Palette 數量必須等於 Region 數量')
  for (const colorIndex of level.palette) {
    if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= REGION_PALETTE.length) {
      errors.push('Region Palette ID 超出範圍')
      break
    }
  }
  if (new Set(level.palette).size !== level.size) errors.push('每個 Region 必須使用不同的 Palette 顏色')
  const adjacency = getRegionAdjacency(level.regions, level.size)
  for (let region = 0; region < level.size; region += 1) {
    for (const neighbor of adjacency[region]) {
      const firstColor = level.palette[region]
      const secondColor = level.palette[neighbor]
      if (firstColor === undefined || secondColor === undefined) continue
      if (firstColor === secondColor || REGION_PALETTE[firstColor].family === REGION_PALETTE[secondColor].family) {
        errors.push(`相鄰 Region ${region} 與 ${neighbor} 使用過於接近的色系`)
      }
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] }
}

export function areAllRegionsConnected(regions: number[], size: number): boolean {
  return Array.from({ length: size }, (_, regionId) => isRegionConnected(regions, size, regionId)).every(Boolean)
}
