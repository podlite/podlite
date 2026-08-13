import { ConfigItem } from '../types'

export type LinkConfig = {
  newContext?: boolean
  title?: string
  lang?: string
  download?: boolean | string
}

const last = (config: ConfigItem[], name: string) => config.filter(item => item.name === name).slice(-1)[0]

const asText = (item?: ConfigItem) =>
  item && (item.type === 'string' || item.type === 'number') ? String(item.value) : undefined

export const readLinkConfig = (config?: ConfigItem[]): LinkConfig => {
  if (!Array.isArray(config) || config.length === 0) return {}
  const result: LinkConfig = {}

  const openInNew = last(config, 'new')
  if (openInNew) result.newContext = openInNew.value !== false

  const title = asText(last(config, 'title'))
  if (title !== undefined) result.title = title

  const lang = asText(last(config, 'lang'))
  if (lang !== undefined) result.lang = lang

  const download = last(config, 'download')
  if (download) {
    const name = asText(download)
    result.download = name !== undefined ? name : download.value !== false
  }

  return result
}
