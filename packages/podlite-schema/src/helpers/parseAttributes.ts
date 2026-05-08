import * as parser from '../grammar'
import { ConfigItem } from '../types'

export function parseAttributes(src: string): ConfigItem[] {
  if (!src || !src.trim()) return []
  try {
    return parser.parse(src, { startRule: 'attributesOnly' }) as ConfigItem[]
  } catch {
    return []
  }
}
