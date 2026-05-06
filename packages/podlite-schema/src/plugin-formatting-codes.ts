import * as fcparser from './grammarfc'
import makeTransformer from './helpers/makeTransformer'
import { isNamedBlock } from './helpers/makeTransformer'
import makeAttrs from './helpers/config'
import { ParserPlugin, Node, nPara, AST, nText, nVerbatim } from './'

/**
 *  Main transforms
 */
interface MakeTransformerParams {
  [name: string]: (n: Node, ctx: any, visiter?: any) => any
}

const middle: ParserPlugin = () => tree => {
  const transformerBlocks = makeTransformer({
    ':para': (n, ctx, visiter) => {
      return makeTransformer({
        ':text': (n: nText, ctx) => {
          return fcparser.parse(n.value)
        },
        ':verbatim': (n: nVerbatim, ctx) => {
          return fcparser.parse(n.value)
        },
      })(n, { ...ctx })
      return n
    },
    ':block': (n, ctx, visiter) => {
      // only =pod may have childs blocks
      if ('name' in n && n.name === 'pod')
        return {
          ...n,
          content: visiter(n.content, ctx, visiter),
        }

      const conf = makeAttrs(n, ctx)
      const name = 'name' in n ? n.name : ''
      // Blocks whose content is verbatim by default — fcode parsing only
      // kicks in when :allow opts in (per spec, "Formatting within code blocks").
      const isVerbatimDefault = ['code', 'data', 'markdown', 'picture', 'formula'].includes(name)
      const allowValues = conf.getAllValues('allow')
      if (isNamedBlock(name)) return n
      if (isVerbatimDefault && allowValues.length === 0) return n
      const allowed = allowValues.sort()
      const transformer = makeTransformer({
        ':verbatim': (n: nVerbatim, ctx) => fcparser.parse(n.value, { allowed }),
        ':text': (n: nText, ctx) => fcparser.parse(n.value, { allowed }),
        ':block': (n, ctx) => transformerBlocks(n, { ...ctx }),
      })
      return { ...n, content: transformer(n.content, { ...ctx }) }
    },
  })
  return transformerBlocks(tree, {})
}
export default middle
