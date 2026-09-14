export interface RegionPaletteColor {
  name: string
  color: string
  family: string
  hue: number
}

/**
 * One color per hue family keeps adjacent regions distinguishable while the
 * board preserves saturation and adds numbered region boundaries.
 */
export const REGION_PALETTE: RegionPaletteColor[] = [
  { name: '奶油黃', color: '#f4cf46', family: 'yellow', hue: 50 },
  { name: '珊瑚粉', color: '#ee7d85', family: 'coral', hue: 355 },
  { name: '杏橘', color: '#f4a34f', family: 'apricot', hue: 27 },
  { name: '草綠', color: '#add35a', family: 'grass', hue: 88 },
  { name: '薄荷綠', color: '#53c49d', family: 'mint', hue: 157 },
  { name: '水藍', color: '#66d5e7', family: 'aqua', hue: 187 },
  { name: '晴藍', color: '#6595e3', family: 'blue', hue: 212 },
  { name: '藍紫', color: '#a28bdb', family: 'purple', hue: 257 },
  { name: '桃粉', color: '#e378c4', family: 'magenta', hue: 326 },
  { name: '霧灰', color: '#a5b0bf', family: 'slate', hue: 217 },
]
