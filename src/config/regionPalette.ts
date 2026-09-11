export interface RegionPaletteColor {
  name: string
  color: string
  family: string
  hue: number
}

/**
 * One color per hue family keeps adjacent regions distinguishable while the
 * board mixes each swatch with white for a soft Jelly World finish.
 */
export const REGION_PALETTE: RegionPaletteColor[] = [
  { name: '奶油黃', color: '#f2c95f', family: 'yellow', hue: 50 },
  { name: '珊瑚粉', color: '#ed969e', family: 'coral', hue: 355 },
  { name: '杏橘', color: '#efaf78', family: 'apricot', hue: 27 },
  { name: '草綠', color: '#a6d275', family: 'grass', hue: 88 },
  { name: '薄荷綠', color: '#82cfb2', family: 'mint', hue: 157 },
  { name: '水藍', color: '#70c8d5', family: 'aqua', hue: 187 },
  { name: '晴藍', color: '#80afe0', family: 'blue', hue: 212 },
  { name: '藍紫', color: '#a996d8', family: 'purple', hue: 257 },
  { name: '桃粉', color: '#dc86b7', family: 'magenta', hue: 326 },
  { name: '米杏', color: '#d6b29b', family: 'almond', hue: 21 },
]
