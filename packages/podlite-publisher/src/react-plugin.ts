import { getTextContentFromNode, makeInterator, PodliteDocument, PodNode } from '@podlite/schema'
import { COMPONENTS_LIB } from './constants'

import * as fs from 'fs'
import { getPathToOpen } from './node-utils'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from '.'
import { makeAstFromSrc } from './shared'

const plugin = (): PodliteWebPlugin => {
  const componensMap = new Map()
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => {
    if (!ctx.testing) {
      // process Components
      let componensFileContent = ''
      for (const key of componensMap.keys()) {
        const componentName = componensMap.get(key)
        componensFileContent += `import ${
          Array.isArray(componentName) ? `{ ${componentName} }` : componentName
        } from "${key}"
export { ${componentName} }
        `
      }
      componensFileContent += `
export default {}
`

      fs.writeFileSync(COMPONENTS_LIB, componensFileContent, 'utf8')
    }
    return { ...ctx, ...outCtx, ...{ componensMap: Object.fromEntries(componensMap) } }
  }
  const processNode = (node: PodNode, file: string) => {
    const rules = {
      // process JSX
      useReact: (node, ctx, interator) => {
        const text = getTextContentFromNode(node)
        const importMatchResult = text.match(/^\s*(?<component>\S+)\s*from\s*['"](?<source>\S+)['"]/)
        if (importMatchResult) {
          //@ts-ignore
          const { component, source } = (
            importMatchResult || {
              groups: { component: undefined, source: undefined },
            }
          ).groups
          const { path } = source.match(/^\.?\//) ? getPathToOpen(source, file) : { path: source }
          // save absolute Component path and Component name
          const notDefaultImport = component.match(/{(.*)}/)
          if (notDefaultImport) {
            const components = notDefaultImport[1].split(/\s*,\s*/)
            // check if already exists
            if (componensMap.has(path)) {
              const savedComponents = componensMap.get(path)
              const onlyUnique = (value, index, self) => self.indexOf(value) === index
              const newComponents = [...savedComponents, ...components].filter(onlyUnique)
              componensMap.set(path, newComponents)
            } else {
              componensMap.set(path, components)
            }
          } else {
            componensMap.set(path, component)
          }
        } else {
          console.warn(`can't parse =React body. Expected =React Component from './somefile.tsx', but got: ${text}`)
        }
        return
      },
      React: (node, ctx, interator) => {
        const text = getTextContentFromNode(node)
        const doc: PodliteDocument = makeAstFromSrc(text)
        return { ...node, content: [interator(doc.content, ctx)] }
      },
    }
    return makeInterator(rules)(node, {})
  }
  const onProcess = (recs: publishRecord[]) => {
    const res = recs.map(item => {
      const node = processNode(item.node, item.file)
      // process images inside description
      let extra = {} as { description?: PodNode, template?: publishRecord}
      if (item.description) {
        extra.description = processNode(item.description, item.file)
      }
      if (item.template) {
        const { footer, header } = item.template
        const processedTemplate = processNode(item.template.node, item.template.file)
        extra.template = item.template        
        extra.template.node = processedTemplate
        if ( footer ) {
          extra.template.footer = processNode(footer, item.template.file)
        }
        if ( header ) {
          extra.template.header = processNode(header, item.template.file)
        }
        
      }

      return { ...item, node, ...extra }
    })
    return res
  }

  return [onProcess, onExit]
}

export default plugin
