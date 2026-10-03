import * as fcparser from './grammarfc'
import makeTransformer from './helpers/makeTransformer'
import { isNamedBlock } from './helpers/makeTransformer'
import makeAttrs from './helpers/config'
import { parseAttributes } from './helpers/parseAttributes'
import { ParserPlugin, Node, nPara, AST, nText, nVerbatim } from './'
import { ConfigScope } from './helpers/configPropagation'

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

// a declaration acts from where it is written, and one without :allow leaves
// the codes an earlier declaration allowed
const declareAllowedIn = (node: unknown, scope: AllowedIn): void => {
  if (!node || typeof node !== 'object') return
  const owner = codeConfigOwner('name' in node ? node.name : undefined)
  if (!owner) return
  const conf = makeAttrs(node, {})
  if (conf.exists('allow')) scope[owner] = conf.getAllValues('allow')
}

const inheritedAllowedIn = (config: ConfigScope = {}): AllowedIn => {
  const scope: AllowedIn = {}
  for (const name of Object.keys(config)) declareAllowedIn({ name, config: config[name] }, scope)
  return scope
}

// the codes a paragraph or code written without a marker allows: those =config
// or =set gave it, none declared means the default of its block type
const allowOf = (node: unknown): string[] | undefined => {
  const conf = makeAttrs(node, {})
  return conf.exists('allow') ? conf.getAllValues('allow') : undefined
}

const middle: ParserPlugin = opt => tree => {
  const transformerBlocks = makeTransformer({
    ':para': (n, ctx, visiter) => {
      const allowedIn = ctx.allowedIn
      const allowed = allowOf(n)
      return makeTransformer({
        ':text': (n: nText, ctx) => {
          return fcparser.parse(n.value, { allowed, allowedIn, parseAttributes })
        },
        ':verbatim': (n: nVerbatim, ctx) => {
          return fcparser.parse(n.value, { allowed, allowedIn, parseAttributes })
        },
      })(n, { ...ctx })
      return n
    },
    // code is verbatim unless :allow names the codes read in it
    ':code': (n, ctx) => {
      const allowed = allowOf(n) || []
      if (allowed.length === 0) return n
      const allowedIn = ctx.allowedIn
      return makeTransformer({
        ':verbatim': (node: nVerbatim) => fcparser.parse(node.value, { allowed, allowedIn, parseAttributes }),
      })(n, { ...ctx })
    },
    ':config': (n, ctx) => {
      declareAllowedIn(n, ctx.allowedIn)
      return n
    },
    ':block': (n, ctx, visiter) => {
      // a block is a lexical scope: a code configured inside it stays inside
      const allowedIn: AllowedIn = { ...(ctx.allowedIn || {}) }
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
      const isVerbatimDefault = ['code', 'data', 'picture', 'formula', 'assert', 'resource'].includes(name)
      if (isNamedBlock(name)) return n
      // a fixture body is a document of its own, so :allow does not reach it
      if (name === 'fixture') return n
      // a markdown body is Markdown whatever :allow says
      if (name === 'markdown') return n

      // A table owns rows, and the text sits in the cells, so :allow written on
      // the table reaches them. The nearest declaration wins: cell, row, table.
      const inheritsAllow = name === 'row' || name === 'cell'
      const declared = conf.exists('allow')
        ? conf.getAllValues('allow')
        : inheritsAllow
        ? ctx.allowFromTable
        : undefined
      const allowValues = declared || []
      const passesAllow = name === 'table' || name === 'row' ? declared : ctx.allowFromTable

      if (isVerbatimDefault && allowValues.length === 0) return n
      // declared empty means no code acts on this text; nested blocks still get
      // their turn, since a cell may declare a set of its own
      const literal = inheritsAllow && declared !== undefined && declared.length === 0
      const allowed = [...allowValues].sort()
      const inner = { ...ctx, allowedIn, allowFromTable: passesAllow }
      // code written without a marker is verbatim unless its own :allow names codes
      const ownCode = (node, ctx) => transformerBlocks(node, { ...ctx, allowedIn })
      // a paragraph written without a marker reads the codes of the block around it
      // unless it was given an :allow of its own
      const ownPara = (node, ctx) =>
        allowOf(node) === undefined
          ? { ...node, content: transformer(node.content, ctx) }
          : transformerBlocks(node, { ...ctx, allowedIn })
      const transformer = makeTransformer({
        ':verbatim': (node: nVerbatim, ctx) =>
          literal ? node : fcparser.parse(node.value, { allowed, allowedIn, parseAttributes }),
        ':text': (node: nText, ctx) =>
          literal ? node : fcparser.parse(node.value, { allowed, allowedIn, parseAttributes }),
        ':para': ownPara,
        ':code': ownCode,
        ':config': (node, ctx) => {
          declareAllowedIn(node, allowedIn)
          return node
        },
        ':block': (node, ctx) => transformerBlocks(node, { ...ctx, allowedIn, allowFromTable: passesAllow }),
      })
      return { ...n, content: transformer(n.content, inner) }
    },
  })
  // a document needs no enclosing block, so the top level is a scope of its own
  return transformerBlocks(tree, { allowedIn: inheritedAllowedIn(opt.config) })
}
export default middle
