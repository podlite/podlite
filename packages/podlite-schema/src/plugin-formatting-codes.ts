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
      const isCodeBlock = 'name' in n && n.name === 'code'
      const isDataBlock = 'name' in n && n.name === 'data'
      const isMarkdownBlock = 'name' in n && n.name === 'markdown'
      const isPictureBlock = 'name' in n && n.name === 'picture'
      const allowValues = [...conf.getAllValues('allow'), ...(isCodeBlock ? ['NONE'] : [])]
      if (isNamedBlock(n.name)) return n
      // for code block not parse content by default
      if ((isCodeBlock || isDataBlock || isMarkdownBlock || isPictureBlock) && allowValues.length == 0) return n
      const allowed = allowValues.sort()
      const transformer = makeTransformer({
        ':verbatim': (n: nVerbatim, ctx) => {
          // special case for code block, 'NONE' - flag disabled all markup codes
          // do not parse content by default
          if (allowed.length == 1 && allowed.includes('NONE')) return n
          return fcparser.parse(n.value, { allowed })
        },
        ':text': (n: nText, ctx) => {
          return fcparser.parse(n.value, { allowed })
        },
        ':block': (n, ctx) => {
          return transformerBlocks(n, { ...ctx })
        },
      })
      return { ...n, content: transformer(n.content, { ...ctx }) }
    },
  })
  return transformerBlocks(tree, {})
}
export default middle
