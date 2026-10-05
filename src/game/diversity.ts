import type { Level } from '../types/game'
import type { LogicStep } from './logic'

export function layoutVariants(regions: number[], n: number): number[][] {
  const variants: number[][] = []
  for (let flip = 0; flip < 2; flip++) for (let turn = 0; turn < 4; turn++) {
    const grid = Array<number>(n * n)
    regions.forEach((value, i) => {
      let r = Math.floor(i / n), c = i % n
      if (flip) c = n - 1 - c
      for (let t = 0; t < turn; t++) [r, c] = [c, n - 1 - r]
      grid[r * n + c] = value
    })
    variants.push(grid)
  }
  return variants
}

export function layoutKey(level: Pick<Level, 'regions' | 'size'>): string {
  return layoutVariants(level.regions, level.size).map((grid) => {
    const labels = new Map<number, number>()
    return grid.map((value) => {
      if (!labels.has(value)) labels.set(value, labels.size)
      return labels.get(value)
    }).join(',')
  }).sort()[0]
}

/** Maximum cell agreement after symmetry and optimal colour relabelling. */
export function layoutSimilarity(a: Pick<Level, 'regions' | 'size'>, b: Pick<Level, 'regions' | 'size'>): number {
  if (a.size !== b.size) return 0
  const n = a.size
  let best = 0
  for (const grid of layoutVariants(b.regions, n)) {
    const counts = Array.from({ length: n }, () => Array<number>(n).fill(0))
    a.regions.forEach((value, i) => { counts[value][grid[i]]++ })
    // Hungarian assignment: choosing the best one-to-one relabelling is O(n³).
    const u = Array<number>(n + 1).fill(0), v = [...u], p = [...u], way = [...u]
    for (let i = 1; i <= n; i++) {
      p[0] = i
      let j0 = 0
      const min = Array<number>(n + 1).fill(Infinity), used = Array<boolean>(n + 1).fill(false)
      do {
        used[j0] = true
        const i0 = p[j0]
        let delta = Infinity, j1 = 0
        for (let j = 1; j <= n; j++) if (!used[j]) {
          const current = -counts[i0 - 1][j - 1] - u[i0] - v[j]
          if (current < min[j]) { min[j] = current; way[j] = j0 }
          if (min[j] < delta) { delta = min[j]; j1 = j }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta }
          else min[j] -= delta
        }
        j0 = j1
      } while (p[j0] !== 0)
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while (j0)
    }
    best = Math.max(best, p.slice(1).reduce((sum, row, column) => sum + counts[row - 1][column], 0))
  }
  return best / (n * n)
}

/** A comparison of the engine's path, rather than a claim about all player paths. */
export function deductionOpening(steps: LogicStep[]): string {
  return steps.filter((step) => step.action === 'exclude').slice(0, 3).map((step) => step.technique).join('>') || 'single-only'
}

export function openingLocation(steps: LogicStep[], n: number): string {
  const first = steps.find((step) => step.action === 'exclude') ?? steps[0]
  if (!first) return 'none'
  const cells = first.action === 'place' ? first.targets : first.sources
  const row = cells.reduce((sum, i) => sum + Math.floor(i / n), 0) / cells.length
  const column = cells.reduce((sum, i) => sum + i % n, 0) / cells.length
  return `${Math.min(2, Math.floor(row * 3 / n))},${Math.min(2, Math.floor(column * 3 / n))}`
}
