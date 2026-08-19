import * as fcparser from './grammarfc'
import makeTransformer from './helpers/makeTransformer'
import { isNamedBlock } from './helpers/makeTransformer'
import makeAttrs from './helpers/config'
import { parseAttributes } from './helpers/parseAttributes'
import { ParserPlugin, Node, nPara, AST, nText, nVerbatim } from './'

/**
 *  Main transforms
 */
interface MakeTransformerParams {
  [name: string]: (n: Node, ctx: any, visiter?: any) => any
}

type AllowedIn = Record<string, string[]>

// `=config C<> :allow<I>` names a markup code, not a block: the trailing angles
// are the marker, and what it declares belongs to the code they name
const codeConfigOwner = (name: unknown): string | null =>
  typeof name === 'string' && /^[A-Z]<>$/.test(name) ? name[0] : null

const collectAllowedIn = (content: unknown, inherited: AllowedIn): AllowedIn => {
  if (!Array.isArray(content)) return inherited
  let map = inherited
  for (const child of content) {
    if (!child || typeof child !== 'object') continue
    const node = child as { type?: string; name?: string }
    if (node.type !== 'config') continue
    const owner = codeConfigOwner(node.name)
    if (!owner) continue
    if (map === inherited) map = { ...inherited }
    map[owner] = makeAttrs(node, {}).getAllValues('allow')
  }
  return map
}

const middle: ParserPlugin = () => tree => {
  const transformerBlocks = makeTransformer({
    ':para': (n, ctx, visiter) => {
      const allowedIn = ctx.allowedIn
      return makeTransformer({
        ':text': (n: nText, ctx) => {
          return fcparser.parse(n.value, { allowedIn, parseAttributes })
        },
        ':verbatim': (n: nVerbatim, ctx) => {
          return fcparser.parse(n.value, { allowedIn, parseAttributes })
        },
      })(n, { ...ctx })
      return n
    },
    ':block': (n, ctx, visiter) => {
      // a block is a lexical scope: a code configured inside it stays inside
      const allowedIn = collectAllowedIn('content' in n ? n.content : undefined, ctx.allowedIn || {})
      // only =pod may have childs blocks
      if ('name' in n && n.name === 'pod')
        return {
          ...n,
          content: visiter(n.content, { ...ctx, allowedIn }, visiter),
        }

      const conf = makeAttrs(n, ctx)
      const name = 'name' in n ? n.name : ''
      // Blocks whose content is verbatim by default — fcode parsing only
      // kicks in when :allow opts in (per spec, "Formatting within code blocks").
      const isVerbatimDefault = ['code', 'data', 'markdown', 'picture', 'formula'].includes(name)
      const allowValues = conf.getAllValues('allow')
      if (isNamedBlock(name)) return n
      if (isVerbatimDefault && allowValues.length === 0) return n
      // a cell built from data carries its own set; declared empty means no code acts
      if (name === 'cell' && conf.exists('allow') && allowValues.length === 0) return n
      const allowed = allowValues.sort()
      const transformer = makeTransformer({
        ':verbatim': (n: nVerbatim, ctx) => fcparser.parse(n.value, { allowed, allowedIn, parseAttributes }),
        ':text': (n: nText, ctx) => fcparser.parse(n.value, { allowed, allowedIn, parseAttributes }),
        ':block': (n, ctx) => transformerBlocks(n, { ...ctx, allowedIn }),
      })
      return { ...n, content: transformer(n.content, { ...ctx, allowedIn }) }
    },
  })
  // a document needs no enclosing block, so the top level is a scope of its own
  return transformerBlocks(tree, { allowedIn: collectAllowedIn(tree, {}) })
}
export default middle
