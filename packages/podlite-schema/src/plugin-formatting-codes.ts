import { readCodes, CodeIssue } from './codes/read'
import makeTransformer from './helpers/makeTransformer'
import { isNamedBlock } from './helpers/makeTransformer'
import makeAttrs from './helpers/config'
import { parseAttributes } from './helpers/parseAttributes'
import { ParserPlugin, Node, nPara, AST, nText, nVerbatim } from './'
import { ConfigScope } from './helpers/configPropagation'
import { blockNameOf } from './helpers/blockName'

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
  // the codes of one piece of text; a warning keeps the block it came from and its
  // place in the text, and the parser turns that into a place in the source
  const read = (text: string, allowed: string[] | undefined, allowedIn: AllowedIn, block: any, inline = false) => {
    const issues: CodeIssue[] = []
    const content = readCodes(text, { allowed, allowedIn, parseAttributes, entityInCode: true, issues })
    const location = block && block.location
    const fragment = { text, inline }
    if (Array.isArray(opt.diagnostics) && location)
      for (const issue of issues)
        opt.diagnostics.push({
          severity: 'warning',
          code: issue.code,
          message: issue.message,
          location,
          pending: { fragment, start: issue.start, end: issue.end },
        } as any)
    return content
  }
  const transformerBlocks = makeTransformer({
    ':para': (n, ctx, visiter) => {
      const allowedIn = ctx.allowedIn
      const allowed = allowOf(n)
      return makeTransformer({
        ':text': (node: nText, ctx) => read(node.value, allowed, allowedIn, n),
        ':verbatim': (node: nVerbatim, ctx) => read(node.value, allowed, allowedIn, n),
      })(n, { ...ctx })
      return n
    },
    // code is verbatim unless :allow names the codes read in it
    ':code': (n, ctx) => {
      const allowed = allowOf(n) || []
      if (allowed.length === 0) return n
      const allowedIn = ctx.allowedIn
      return makeTransformer({
        ':verbatim': (node: nVerbatim) => read(node.value, allowed, allowedIn, n),
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
      // a warning about text with no place of its own, such as a table cell, points at this block
      const inner = {
        ...ctx,
        allowedIn,
        allowFromTable: passesAllow,
        block: n.location ? n : ctx.block,
        inline: !n.location,
      }
      // code written without a marker is verbatim unless its own :allow names codes
      const ownCode = (node, ctx) => transformerBlocks(node, { ...ctx, allowedIn })
      // a paragraph written without a marker reads codes as an explicit =para does;
      // the own text of a block, a term among them, and the text of a cell read the
      // codes of the block they belong to
      const ownPara = (node, ctx) =>
        blockNameOf(node, n) !== 'para' || (inheritsAllow && allowOf(node) === undefined)
          ? {
              ...node,
              // text held by a node with no place of its own, such as a cell, stands inside a line
              content: transformer(node.content, {
                ...ctx,
                block: node.location ? node : ctx.block,
                inline: !node.location,
              }),
            }
          : transformerBlocks(node, { ...ctx, allowedIn })
      const transformer = makeTransformer({
        ':verbatim': (node: nVerbatim, ctx) =>
          literal ? node : read(node.value, allowed, allowedIn, ctx.block || n, Boolean(ctx.inline)),
        ':text': (node: nText, ctx) =>
          literal ? node : read(node.value, allowed, allowedIn, ctx.block || n, Boolean(ctx.inline)),
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
