export type SaveAssetSource = 'paste' | 'drop'

export type SaveAssetCallback = (file: File, source: SaveAssetSource) => Promise<string | null>

export const SUPPORTED_PASTE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
export const SUPPORTED_DROP_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'])

export function extractImagesFromDataTransfer(dt: DataTransfer | null, allowed: Set<string>): File[] {
  if (!dt) return []
  const out: File[] = []
  const items = dt.items
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind !== 'file') continue
      if (!allowed.has(item.type)) continue
      const file = item.getAsFile()
      if (file) out.push(file)
    }
    if (out.length > 0) return out
  }
  const files = dt.files
  if (files) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (allowed.has(file.type)) out.push(file)
    }
  }
  return out
}
