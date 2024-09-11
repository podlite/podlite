import { makeInterator, PodNode } from '@podlite/schema'
import { ASSETS_PATH, IMAGE_LIB } from './constants'

import * as fs from 'fs'
import { getPathToOpen } from './node-utils'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from '.'

const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const imagesMap = new Map()
  const onExit = ctx => {
    if (!ctx.testing) {
      // process Images
      let libFileContent = ''
      for (const key of imagesMap.keys()) {
        const variable_name = imagesMap.get(key)
        if (!fs.existsSync(key)) {
          continue
        }
        libFileContent += `import ${variable_name} from "${key}"
export { ${variable_name} }
    `
      }
      libFileContent += `
export default {}
`
      fs.writeFileSync(IMAGE_LIB, libFileContent, 'utf8')
    }
    return { ...ctx, ...outCtx, ...{ imagesMap: Object.fromEntries(imagesMap) } }
  }
  const processNode = (node: PodNode, file: string) => {
    const rules = {
      ':image': node => {
        // process copy files to assets
        // '../assets/'
        const { path } = getPathToOpen(node.src, file)
        const { name, ext, dir } = pathMod.parse(path)
        const variable_name = 'i' + path.split('/').slice(1).join('_').replace(/\W+/g, '_').toLowerCase()
        const newFileName = `${variable_name}${ext}`
        const dstFilename = ASSETS_PATH + '/' + newFileName
        imagesMap.set(path, variable_name)

        return { ...node, src: variable_name }
      },
    }
    return makeInterator(rules)(node, {})
  }
  const onProcess = (recs: publishRecord[]) => {
    const res = recs.map(item => {
      const node = processNode(item.node, item.file)
      // process images inside description
      let extra = {} as { description?: PodNode }
      if (item.description) {
        extra.description = processNode(item.description, item.file)
      }

      return { ...item, node, ...extra }
    })
    return res
  }

  return [onProcess, onExit]
}

export default plugin
