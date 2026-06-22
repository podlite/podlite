import { podlitePluggable, Podlite, PodliteDocument, parseOpt } from '@podlite/schema'
import { parseMd } from '@podlite/markdown'
import externalPlugins from './plugins/extrnal'
export interface PodliteOpt {
  importPlugins?: boolean
}

export const podlite = ({ importPlugins = true }: PodliteOpt): Podlite => {
  const plugins = importPlugins ? externalPlugins : {}
  const instance = podlitePluggable({ plugins })
  const baseParse = instance.parse
  instance.parse = (text: string, opt: parseOpt = {}): PodliteDocument => {
    if (opt.mode === 'md') return parseMd(text) as unknown as PodliteDocument
    return baseParse(text, opt)
  }
  return instance
}

export { version } from './version'
