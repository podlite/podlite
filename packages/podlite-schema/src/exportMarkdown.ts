import toAny from './exportAny'
import { isCovered } from './guard'
import {
  subUse,
  wrapContent,
  emptyContent,
  content,
  setFn,
  handleNested as nestedLevels,
  maskText,
  expandTabs,
  collectText,
} from './helpers/handlers'
import makeAttrs, { codeConfigWithDefaults } from './helpers/config'
import { mergeConfigSettings } from './helpers/configPropagation'
import { applyImageBase } from './image-base'
import writerMarkdown from './writerMarkdown'
import clean_plugin from './plugin-clean-location'
import { expandAlias } from './helpers/alias'
import {
  decodeEntities,
  bindTarget,
  getExplicitNodeId,
  getNodeId,
  headingsWithCodeLinks,
  nodesOfTree,
  WrittenHeading,
  linkTarget,
  readerAnchors,
  sameDocTarget,
  toMarkdownFragment,
  writtenValue,
} from './ast-helpers'
import { quoteAttribute } from './helpers/html-attr'
import { readLinkConfig } from './helpers/link-config'
import { testCaption, longestBacktickRun } from './test-display'
import { titleParts, isTitleBlock } from './title'
import { headingTextOf } from './markdown-heading-text'

// A markdown reader builds the anchor out of the heading itself, by its own rules,
// so a link written here has to match what that reader will produce.
// Built once per document and mode: a hidden block renders with a copy of the context,
// and a cache kept on the context itself would be rebuilt for every one of them.
const readerAnchorsCache = new WeakMap<object, Map<string, ReturnType<typeof readerAnchors>>>()
// The walk that learns the lines notes each heading where the page has it, and fills in
// its line when it is written; a title holds blocks written before its own line.
const noteHeading = (ctx, node): ((line: string | null) => void) => {
  const lines = ctx?.__headingLines
  if (!lines) return () => {}
  const at = lines.push({ node, line: null }) - 1
  return line => {
    lines[at].line = line
  }
}

// With the texts of the headings read from the lines the output wrote, the addresses are
// the reader's own; the walk that learns those lines builds them from the tree.
const markdownAnchors = ctx => {
  const index = ctx?.__anchors
  if (!index) return undefined
  const mode = ctx.renderMode === 'draft' ? 'draft' : 'production'
  const key = ctx.__readerTexts || index
  let byMode = readerAnchorsCache.get(key)
  if (!byMode) readerAnchorsCache.set(key, (byMode = new Map()))
  if (!byMode.has(mode)) byMode.set(mode, readerAnchors(index, mode, ctx.__readerTexts, ctx.__codeLinkHeadings))
  return byMode.get(mode)
}

// a reader takes `&copy;` in an address, a title or the alternative text of a picture for
// the sign; `&amp;` keeps it as written for every reader, where some do not take off a backslash
const characterReference = /&(?=#?[A-Za-z0-9]+;)/g
const keepReferences = (text: string): string => text.replace(characterReference, '&amp;')

// the title of a link or a picture, after its address in quotes
const quotedTitle = (title: string, inCode = false) => {
  const text = inCode ? title : keepReferences(title.replace(/\\/g, '\\\\'))
  return ` "${text.replace(/"/g, '\\"')}"`
}

// a title written on a link inside hidden content is hidden with it
const linkTitle = (config, conceal: (text: string) => string = text => text, inCode = false) => {
  const { title } = readLinkConfig(config)
  return title === undefined ? '' : quotedTitle(conceal(title), inCode)
}

// Markdown has no form for a link whose target the author never wrote — an empty
// address there claims the current document — so the text is written on its own.
// A bracket or a space inside the address would end it where markdown looks for
// the closing one, so such an address is written in angle brackets, the form
// markdown keeps for exactly that. An angle of its own is percent-encoded rather
// than dropped, so the address survives the round trip — no source text reaches
// here holding one today, since the parser ends the code on it.
// Inside code a reader shows a backslash, so there the address stays as it is.
const markdownAddress = (address: string, inCode = false): string => {
  const kept = inCode ? address : keepReferences(address.replace(/\\/g, '\\\\'))
  return /[()\s]/.test(kept) ? `<${kept.replace(/</g, '%3C').replace(/>/g, '%3E')}>` : kept
}

const linkWrap = (node, ctx, inCode = false) => {
  const target = linkTarget(node)
  if (target === undefined) return wrapContent('', '')
  const resolved = sameDocTarget(target, ctx, markdownAnchors(ctx), node)
  // a link to this document in the code of a heading line is read as text: the heading
  // and the target of the link take named anchors, so the text stays as it is
  if (inCode && ctx.__codeLinks && ctx.__headingNode && typeof target === 'string' && target.startsWith('#')) {
    const bound = ctx.__bindings ? bindTarget(target.slice(1), ctx.__bindings) : undefined
    if (bound?.found) ctx.__codeLinks.add(bound.node).add(ctx.__headingNode)
  }
  // Markdown has no anchor without an address either, so a refused link keeps its
  // text and loses the brackets.
  if (resolved === undefined) return wrapContent('', '')
  const address = String(resolved)
  return wrapContent(
    `[`,
    `](${markdownAddress(address, inCode)}${linkTitle(
      codeConfigWithDefaults(node, ctx),
      text => covered(node, ctx, text),
      inCode,
    )})`,
  )
}

// A cell's own text is written whole. Trimming each fragment on its own eats the
// spaces that sit between them — between a word and a markup code, or around a
// sign the parser split the text on — so only the cell edges are stripped.
const writeCellParts = (cell, writer, interator, ctx) => {
  const parts = cell.content || []
  const last = parts.length - 1
  parts.forEach((part, i) => {
    if (typeof part !== 'string') {
      interator([part], ctx)
      return
    }
    let text = part
    if (i === 0) text = text.replace(/^\s+/, '')
    if (i === last) text = text.replace(/\s+$/, '')
    writer.write(text)
  })
}

// The body of a fixture or a resource is source, written as it stands inside a
// fence no run of backticks in it can close.
const writeSourceBlock = (writer, node, ctx) => {
  const text = collectText(node.content)
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1))
  writer.writeRaw(`${fence}podlite\n`)
  writeSource(writer, isCovered(node, ctx) ? maskText(text) : text)
  if (!text.endsWith('\n')) writer.writeRaw('\n')
  writer.writeRaw(`${fence}\n`)
}

// the words a test is shown by are hidden with the content they stand beside
const covered = (node, ctx, text: string): string => (isCovered(node, ctx) ? maskText(text) : text)

const inlineCode = (text: string): string => {
  const ticks = '`'.repeat(longestBacktickRun(text) + 1)
  // a reader takes one space off each side of code that has a space at both ends, a line
  // break counted as a space, so such code, as code at a backtick, gets one more on each side
  const spaced = /^[ \n]/.test(text) && /[ \n]$/.test(text) && /[^ \n]/.test(text)
  const pad = text.startsWith('`') || text.endsWith('`') || spaced ? ' ' : ''
  return `${ticks}${pad}${text}${pad}${ticks}`
}

// Inside code a reader takes < and & as written; a cell of a table written as HTML
// stands inside a frame, and a fence must not hold across a cell folded onto a line.
const within = (writer, depth: 'codeDepth' | 'htmlDepth' | 'cellDepth', write: () => void) => {
  writer[depth] = (writer[depth] || 0) + 1
  try {
    write()
  } finally {
    writer[depth]--
  }
}

// What `write` writes is kept aside and returned. The line the writer stands on is not
// touched: the caller writes the result as one piece, and the writer counts its line
// from that piece.
const writeAside = (writer, write: () => void): string => {
  const original = writer.output
  const { lastWritten, lineText, paraStart, trailingBreaks, pendingBreak } = writer
  const parts: string[] = []
  writer.output = (str: string) => parts.push(str)
  // a blank line owed to the content outside is not written into the piece aside
  if (pendingBreak) writer.pendingBreak = false
  try {
    write()
  } finally {
    writer.output = original
    writer.lastWritten = lastWritten
    writer.lineText = lineText
    writer.paraStart = paraStart
    writer.trailingBreaks = trailingBreaks
    writer.pendingBreak = pendingBreak
  }
  return parts.join('')
}

// The markdown writer keeps the text of its line, so the lines of a quote and of an
// item can be written aside and given their prefix when they are done.
const ownsLines = writer => typeof writer.lineText === 'string' && typeof writer.output === 'function'

// the content of a quote or an item starts on a line of its own
const startLine = writer => {
  writer.lineText = ''
  writer.lastWritten = ''
  writer.paraStart = false
  writer.trailingBreaks = null
  writer.pendingBreak = false
}

// A quote is written aside, then every line of it gets the sign of each level, a blank
// one too, so a fence, a list or a second paragraph stays inside. A quote opened in the
// middle of a line, after the term of a definition, starts a line of its own. One blank
// line outside the quote ends it.
const quote = (writer, levels: number, write: () => void) => {
  if (writer.lineText !== '') writer.writeRaw('\n')
  const body = writeAside(writer, () => {
    startLine(writer)
    write()
  })
  const sign = '> '.repeat(levels)
  const lines = body.replace(/\n+$/, '').split('\n')
  writer.writeRaw(lines.map(line => (line === '' ? sign.trimEnd() : sign + line)).join('\n') + '\n\n')
}

// :nested(n) of a block: a quote of n levels around what the block writes
const handleNested = (handler, implicitLevel?: number) => (writer, processor) => {
  const plain = nestedLevels(handler, implicitLevel)(writer, processor)
  const own = handler(writer, processor)
  return (node, ctx, interator) => {
    if (!ownsLines(writer)) return plain(node, ctx, interator)
    const levels = Number(makeAttrs(node, ctx).getFirstValue('nested') || implicitLevel || 0)
    if (!(levels > 0)) return own(node, ctx, interator)
    quote(writer, levels, () => own(node, ctx, interator))
  }
}

// a writer given by the caller may be a plain one, without a source of its own
const writeSource = (writer, text: string) =>
  typeof writer.writeSource === 'function' ? writer.writeSource(text) : writer.writeRaw(text)

// Code in a line is written aside first: its fence is one backtick longer than any run
// inside, so a backtick of the text does not end the code early.
// A cell of a pipe table is divided at every bar, before code is read, unless an odd run of
// backslashes stands before the bar; the reader then takes one backslash off. So a bar of
// code gets a backslash of its own after an even run, and one more after an odd run: the
// reader shows the code as written after an even run and one backslash more after an odd one.
// The whole code is taken at once, as a backslash may come from another piece of it.
const keepBarsInCell = (code: string): string =>
  code.replace(/(\\*)\|/g, (match, run: string) => `${run}${run.length % 2 ? '\\' : ''}\\|`)

const codeSpan = (writer, processor) => (node, ctx, interator) => {
  const code = writeAside(writer, () => within(writer, 'codeDepth', () => node.content && interator(node.content, ctx)))
  writer.writeRaw(inlineCode(writer.cellDepth > 0 ? keepBarsInCell(code) : code))
}

const htmlText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// A cell of a table written as HTML holds Markdown: a blank line ends the block of
// HTML before it and another one before the closing tag, so a reader takes what
// lies between as Markdown. A cell with nothing to show closes on its own line.
const writeIsland = (writer, open: string, close: string, write: () => void) => {
  if (typeof writer.output !== 'function') {
    writer.writeRaw(`${open}\n\n`)
    write()
    writer.writeRaw(`\n\n${close}\n`)
    return
  }
  // the content of a cell starts anew: a block at its start needs no blank line before it
  const body = writeAside(writer, () => {
    writer.trailingBreaks = null
    write()
  }).replace(/\n+$/, '')
  writer.writeRaw(body.trim() === '' ? `${open}${close}\n` : `${open}\n\n${body}\n\n${close}\n`)
}

// a fence longer than any run of backticks in the body, opened at the start of a line
const writeFenced = (writer, info: string, write: () => void) => {
  if (typeof writer.output !== 'function') {
    writer.writeRaw('```' + info + '\n')
    within(writer, 'codeDepth', write)
    if (!writer.lastWritten.endsWith('\n')) writer.writeRaw('\n')
    writer.writeRaw('```\n')
    return
  }
  const atLineStart = /^$|\n$/.test(writer.lastWritten)
  const body = writeAside(writer, () => within(writer, 'codeDepth', write))
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(body) + 1))
  writer.writeRaw(`${atLineStart ? '' : '\n'}${fence}${info}\n`)
  if (body !== '') writer.writeRaw(body.endsWith('\n') ? body : `${body}\n`)
  writer.writeRaw(`${fence}\n`)
}

// A body shown as written goes into a fence a reader keeps as written. A fence holds only
// on a line of its own and outside a cell folded onto a line; there the body is written
// as text, so its words stay in sight. Says whether a fence was written.
const isBodyText = child => typeof child === 'string' || child.type === 'text' || child.type === 'verbatim'
const bodyValue = child => (typeof child === 'string' ? child : child.value)
const writeBodyAsWritten = (writer, node, ctx, interator, language = ''): boolean => {
  const children = node.content || []
  if (writer.cellDepth > 0) {
    children.forEach(child =>
      isBodyText(child)
        ? writeText(writer, typeof child === 'string' ? node : child, ctx, bodyValue(child))
        : interator([child], ctx),
    )
    if (!writer.lastWritten.endsWith('\n')) writer.writeRaw('\n')
    writer.writeRaw('\n')
    return false
  }
  const masked = isCovered(node, ctx)
  writeFenced(writer, language, () =>
    children.forEach(child =>
      isBodyText(child)
        ? writeSource(writer, masked ? maskText(bodyValue(child)) : bodyValue(child))
        : interator([child], ctx),
    ),
  )
  return true
}

// What a block writes, ended by one blank line, so the paragraph after it stands
// on its own
const writeWithBoundary = (writer, write: () => void) => {
  if (typeof writer.output !== 'function') {
    write()
    writer.writeRaw('\n')
    return
  }
  const text = writeAside(writer, write)
  if (text === '') return
  writer.writeRaw(text.endsWith('\n\n') ? text : text.endsWith('\n') ? `${text}\n` : `${text}\n\n`)
}

// A block no rule knows holds a body nobody has read: text only. Its names never come
// from a rule, a semantic block or an =include, which is a directive.
const isBareBody = node => {
  const name = node.name || ''
  if (node.type !== 'block' || name === name.toUpperCase()) return false
  if (['root', 'caption', 'Html', 'include'].includes(name)) return false
  const children = node.content
  return Array.isArray(children) && children.length > 0 && children.every(isBodyText)
}

// the names the plugins give a picture and a block of Markdown, as an author may write them
const isPluginPicture = node =>
  (node.name === 'picture' || node.name === 'Image') &&
  node.sourceFormat !== 'markdown' &&
  Array.isArray(node.content) &&
  node.content[0]?.type === 'image'
const isPluginMarkdown = node =>
  (node.name === 'markdown' || node.name === 'Markdown') &&
  node.sourceFormat !== 'markdown' &&
  node.content &&
  !Array.isArray(node.content) &&
  node.content.name === 'root'

// A block without a rule of its own is shown as written: a fence without a language,
// the body as the source has it, a diagram marked mermaid unless it is hidden. A
// picture from its plugin stands as a picture with its caption a paragraph after it;
// a block of Markdown read by its plugin keeps its own structure. Each ends with a
// blank line, so the paragraph after it does not join it.
const blockWithoutRule = (writer, node, ctx, interator): boolean => {
  if (isBareBody(node)) {
    const body = node.content.map(bodyValue).join('')
    if (body.trim() === '') return true
    const diagram = (node.name === 'Mermaid' || node.name === 'Diagram') && !isCovered(node, ctx)
    if (writeBodyAsWritten(writer, node, ctx, interator, diagram ? 'mermaid' : '')) writer.writeRaw('\n')
    return true
  }
  if (isPluginPicture(node)) {
    const [image, ...rest] = node.content
    writeWithBoundary(writer, () => {
      interator([image], ctx)
      writer.writeRaw('\n')
    })
    rest.forEach(part =>
      part?.type === 'block' && part.name === 'caption'
        ? writeWithBoundary(writer, () => paragraph(writer, ctx, () => interator(part.content, ctx)))
        : interator([part], ctx),
    )
    return true
  }
  if (isPluginMarkdown(node)) {
    writeWithBoundary(writer, () => interator(node.content, ctx))
    return true
  }
  return false
}

// Input and output are written as code a reader keeps as written.
const sampleBlock = (writer, processor) => (node, ctx, interator) => {
  writeBodyAsWritten(writer, node, ctx, interator)
}

// HTML the reader of Markdown made stays as written. An author's =Html is shown, not run:
// raw, a style could hide what follows it and an open comment could take the rest.
const htmlBlock = (writer, processor) => (node, ctx, interator) => {
  if (node.sourceFormat === 'markdown') return markdownHtml(writer, node, ctx, interator)
  const body = (node.content || []).map(child => (isBodyText(child) ? bodyValue(child) : ' ')).join('')
  if (body.trim() === '') return
  if (writeBodyAsWritten(writer, node, ctx, interator)) writer.writeRaw('\n')
}

// HTML of Markdown that stands for a block needs a blank line before it, or a reader
// takes it into the paragraph above, and one before what follows it in the same
// content, or a reader takes that into the HTML. Nothing is added at the start of
// the content or at its end.
const markdownHtml = (writer, node, ctx, interator) => {
  if (node.markdownHtml !== 'block' || !ownsLines(writer) || writer.cellDepth > 0) return interator(node.content, ctx)
  const missing = writer.trailingBreaks === null ? 0 : 2 - writer.trailingBreaks
  if (missing > 0) writer.writeRaw('\n'.repeat(missing))
  interator(node.content, ctx)
  if (writer.trailingBreaks === 0) writer.writeRaw('\n')
  writer.pendingBreak = true
}

// The first visible line of a paragraph is written without its indent. Inside an item
// the indent of a later paragraph is what keeps it in the item, so it stays there.
const paragraph = (writer, ctx, write: () => void) => {
  if (ctx.inItem || typeof writer.paraStart !== 'boolean') return write()
  writer.paraStart = true
  try {
    write()
  } finally {
    writer.paraStart = false
  }
}

const implicitPara = handleNested((writer, processor) => (node, ctx, interator) => {
  paragraph(writer, ctx, () => node.content && interator(node.content, ctx))
  writer.writeRaw('\n')
})

const termPara = (writer, processor) => (node, ctx, interator) => {
  writer.writeRaw('**')
  if (node.content) interator(node.content, ctx)
  writer.writeRaw(':** ')
}

const writtenCode = (writer, node, ctx, interator) => {
  const [open, close] = node.written || [`${node.name}<`, '>']
  writer.write(open)
  interator(node.content, ctx)
  writer.write(close)
}

// text of the document, hidden or not by the node it comes from
const writeText = (writer, node, ctx, value: string) => {
  if (ctx.keepSpaces) {
    // inside S<>: every space stays and does not break, a line break stays a line break
    const text = writer.escape(expandTabs(isCovered(node, ctx) ? maskText(value) : value, ctx.keepSpaces))
    writer.writeRaw(text.replace(/ /g, '&nbsp;').replace(/\n/g, keptBreak(writer, ctx)))
  } else {
    const text = isCovered(node, ctx) ? maskText(value) : value
    const shown = writer.paraStart && !(writer.codeDepth > 0) ? text.replace(/^[ \t\n]+/, '') : text
    writer.write(ctx.headingLine && writer.codeDepth > 0 ? shown.replace(/\n/g, ' ') : shown)
  }
}

// A line break S<> keeps: two spaces before the break, and in the line of a heading,
// which holds no break, the tag of one; inside code there it is a space, as code in
// a line has no break of its own.
const keptBreak = (writer, ctx): string => (!ctx.headingLine ? '  \n' : writer.codeDepth > 0 ? ' ' : '<br>')

// The line of a heading is written aside and given back as one line: a break of code
// or of S<> was settled when it was written, and every other break, with the spaces
// around it, becomes one space. The break that ends the paragraph goes, and the
// spaces before it stay, so a heading on one line is written as before.
const headingLine = (writer, write: () => void): string => {
  const line = writeAside(writer, write)
  const ended = line.endsWith('\n')
  return (ended ? line.slice(0, -1) : line).replace(/[ \t]*\n[ \t]*/g, ' ') + (ended ? '\n' : '')
}

// a paragraph a title takes apart keeps its own mask for the text it gives the title
const maskedOwner = (owner, ctx): boolean => {
  if (ctx?.maskMode || ctx?.renderMode === 'draft') return false
  if (owner.guarded) return true
  const conf = makeAttrs(owner, ctx || {})
  return Boolean(conf.exists('masked') && conf.getFirstValue('masked'))
}

// =TITLE shows its content as the title of the document, as HTML and to-jsx do: its
// paragraphs in one heading of the first level, other blocks after it, a directive
// acting from where it stands. A title with nothing to show writes no heading, and
// an anchor only when the author named it.
const titleBlock = (writer, node, ctx, interator) => {
  const note = noteHeading(ctx, node)
  const heading: string[] = []
  const rest: string[] = []
  titleParts(node).forEach(entry => {
    if (entry.kind === 'rest') {
      rest.push(writeAside(writer, () => interator([entry.node], ctx)))
      return
    }
    const masked = entry.owners.some(owner => maskedOwner(owner, ctx))
    const partCtx = { ...ctx, headingLine: true, __headingNode: node, ...(masked ? { maskMode: true } : {}) }
    // the line breaks and spaces at the edges of a paragraph go; a no-break space stays
    const part = headingLine(writer, () => interator(entry.content, partCtx)).replace(/^[ \t\n]+|[ \t\n]+$/g, '')
    if (/\S/.test(part)) heading.push(part)
  })
  // a link reaches a title by the name its author gave it, shaped as for a reader and kept
  // off the addresses the reader builds for the headings
  const written = getExplicitNodeId(node, ctx)
  const anchors = markdownAnchors(ctx)
  const own =
    written === null
      ? ''
      : anchors?.byNode.has(node)
      ? anchors.named?.has(node)
        ? anchors.byNode.get(node)
        : ''
      : toMarkdownFragment(written).toLowerCase()
  if (own) writer.writeRaw(`<a name="${quoteAttribute(own)}"></a>\n\n`)
  note(heading.length ? heading.join(' ') : null)
  if (heading.length) writer.writeRaw(`# ${heading.join(' ')}\n\n`)
  rest.forEach(text => writer.writeRaw(text))
}

// HTML the markdown plugin finds inside a line comes as an Html block of one line
const inlineHtml = node =>
  node.name === 'Html' &&
  (node.content || []).every(part => part.type === 'verbatim' && !String(part.value).includes('\n'))

// A cell holds a block when it holds more than one paragraph or anything but a paragraph
// and text; a comment, data and a directive show nothing and count for nothing.
const holdsBlock = cell => {
  let paragraphs = 0
  let inline = false
  let block = false
  const visit = nodes =>
    (nodes || []).forEach(node => {
      if (typeof node === 'string' || node.type === 'text') {
        if (String(typeof node === 'string' ? node : node.value || '').trim() !== '') inline = true
      } else if (node.type === 'fcode' || (node.type === 'block' && inlineHtml(node))) inline = true
      else if (node.type === 'para') paragraphs++
      else if (node.type === 'block' && node.name === 'para') visit(node.content)
      else if (node.type === 'blankline' || node.type === 'config' || node.type === 'alias') return
      else if (node.type === 'block' && (node.name === 'comment' || node.name === 'data')) return
      else block = true
    })
  visit(cell.content)
  return block || paragraphs + (inline ? 1 : 0) > 1
}

const rules = {
  ':text': (writer, processor) => (node, ctx, interator) => {
    if (node.value) writeText(writer, node, ctx, node.value)
    else interator(node.content, ctx)
  },

  // Formatting codes
  'A<>': (writer, processor) => (node, ctx, interator) => {
    const term = collectText(node.content).trim()
    const expanded =
      ctx.alias &&
      ctx.alias.hasOwnProperty(term) &&
      expandAlias(
        ctx,
        term,
        () => {
          const src = ctx.alias[term].join('\n')
          const tree_1 = processor(src)
          const tree = clean_plugin()(tree_1)
          if (tree[0].type === 'para') {
            interator(tree[0].content, ctx)
          } else {
            interator(tree, ctx)
          }
        },
        // the walk that learns the lines of the headings stays quiet: the walk after it speaks
        message => ctx.__headingLines || console.warn(`[podlite] ${message}`),
      ).expanded
    if (!expanded) writer.write(`A<${covered(node, ctx, term)}>`)
  },
  'C<>': codeSpan,
  // the characters of an entity are text like any other in the same place
  'E<>': (writer, processor) => (node, ctx, interator) => {
    const text = decodeEntities(node.content)
    if (text) writeText(writer, node, ctx, text)
  },
  'D<>': (writer, processor) => (node, ctx, interator) => {
    if (!writer.hasOwnProperty('DEFINITIONS')) {
      writer.DEFINITIONS = []
    }
    writer.DEFINITIONS.push({ definition: [node.content[0]] })
    writer.writeRaw('**')
    interator(node.content, ctx)
    writer.writeRaw('**')
  },
  'B<>': wrapContent('**', '**'),
  'I<>': wrapContent('*', '*'),
  'R<>': wrapContent('*', '*'),
  'K<>': codeSpan,
  'O<>': wrapContent('~~', '~~'),
  'G<>': (writer, processor) => (node, ctx, interator) => {
    if (ctx.renderMode === 'draft') {
      interator(node.content, ctx)
      return
    }
    const masked = maskText(collectText(node.content))
    // inside S<> the spaces of the hidden phrase stay and do not break, as all its text
    if (ctx.keepSpaces)
      writer.writeRaw(
        writer
          .escape(expandTabs(masked, ctx.keepSpaces))
          .replace(/ /g, '&nbsp;')
          .replace(/\n/g, keptBreak(writer, ctx)),
      )
    else writer.write(ctx.headingLine && writer.codeDepth > 0 ? masked.replace(/\n/g, ' ') : masked)
  },
  'H<>': wrapContent('<sup>', '</sup>'),
  'J<>': wrapContent('<sub>', '</sub>'),
  'L<>': (writer, processor) => (node, ctx, interator) =>
    linkWrap(node, ctx, writer.codeDepth > 0)(writer, processor)(node, ctx, interator),
  'W<>': (writer, processor) => (node, ctx, interator) =>
    linkWrap(node, ctx, writer.codeDepth > 0)(writer, processor)(node, ctx, interator),

  'N<>': (writer, processor) => {
    writer.addListener('end', () => {
      if (!writer.hasOwnProperty('FOOTNOTES')) {
        return
      }
      const footnotes = writer.FOOTNOTES
      if (footnotes.length < 1) {
        return
      }
      writer.writeRaw('\n\n---\n\n')
      footnotes.map(footnote => {
        writer.writeRaw(`[^${footnote.gid}]: `)
        footnote.make()
        writer.writeRaw('\n')
      })
    })
    return (node, ctx, interator) => {
      if (node.content.length < 1) {
        return
      }
      if (!writer.hasOwnProperty('gid')) {
        writer.gid = 1
      }
      const gid = writer.gid++
      writer.writeRaw(`[^${gid}]`)
      if (!writer.hasOwnProperty('FOOTNOTES')) {
        writer.FOOTNOTES = []
      }
      writer.FOOTNOTES.push({
        gid,
        fnRefId: `fnref:${gid}`,
        fnId: `fn:${gid}`,
        // the note is written at the end of the document, not in the line it is called from
        make: () => {
          interator(node.content, ctx.headingLine ? { ...ctx, headingLine: false } : ctx)
        },
      })
    }
  },
  // the text inside is formatted as anywhere else, its whitespace kept (Specification, Space-preserving text)
  'S<>': (writer, processor) => (node, ctx, interator) =>
    interator(node.content, {
      ...ctx,
      keepSpaces: typeof ctx.keepSpaces === 'object' ? ctx.keepSpaces : { column: 0 },
    }),
  // a module this renderer cannot run shows its text (Specification, M<>)
  'M<>': content,
  // an inline picture is the picture node it holds
  'P<>': content,
  // a reserved code is shown as written: its letter and brackets around what it holds
  'Q<>': (writer, processor) => (node, ctx, interator) => writtenCode(writer, node, ctx, interator),
  'Y<>': (writer, processor) => (node, ctx, interator) => writtenCode(writer, node, ctx, interator),
  'T<>': codeSpan,
  'U<>': wrapContent('', ''),
  'V<>': content,
  'X<>': (writer, processor) => (node, ctx, interator) => {
    interator(node.content, ctx)
    let { entry } = node
    if (entry === null && node.content.length > 0) {
      //@ts-ignore
      entry = [node.content[0]]
    } else {
      return
    }
    if (!writer.hasOwnProperty('INDEXTERMS')) {
      writer.INDEXTERMS = []
    }
    writer.INDEXTERMS.push({ entry })
  },
  'Z<>': emptyContent,

  pod: content,
  ':code': handleNested((writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const lang = conf.exists('lang') ? conf.getFirstValue('lang') : ''
    const masked = isCovered(node, ctx)
    writeFenced(writer, lang, () =>
      (node.content || []).forEach(child => {
        if (typeof child === 'string') {
          writeSource(writer, masked ? maskText(child) : child)
        } else if (child.type === 'verbatim') {
          writeSource(writer, masked ? maskText(child.value) : child.value)
        } else {
          interator([child], ctx)
        }
      }),
    )
  }),
  code: handleNested((writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const lang = conf.exists('lang') ? conf.getFirstValue('lang') : ''
    const masked = isCovered(node, ctx)
    writeFenced(writer, lang, () =>
      (node.content || []).forEach(child => {
        if (typeof child === 'string') {
          writeSource(writer, masked ? maskText(child) : child)
        } else if (child.type === 'verbatim') {
          writeSource(writer, masked ? maskText(child.value) : child.value)
        } else {
          interator([child], ctx)
        }
      }),
    )
  }),
  data: emptyContent,
  Html: htmlBlock,
  ':verbatim': (writer, processor) => (node, ctx, interator) => {
    if (node.error) {
      writer.emit('errors', node.location)
    }
    const text = isCovered(node, ctx) ? maskText(node.value) : node.value
    // inside a frame of HTML a raw </table> would close the frame and drop the cells after it
    writeSource(writer, writer.htmlDepth > 0 ? htmlText(text) : text)
  },
  ':blankline': emptyContent,
  ':ambient': emptyContent,
  // Directives
  ':config': setFn((node, ctx) => {
    if (!ctx.hasOwnProperty('config')) ctx.config = {}
    ctx.config[node.name] = mergeConfigSettings(node.config, ctx.config[node.name])
    return emptyContent
  }),
  ':alias': setFn((node, ctx) => {
    if (!ctx.hasOwnProperty('alias')) ctx.alias = {}
    ctx.alias[node.name] = node.replacement
    return emptyContent
  }),

  // block =para
  para: handleNested(
    (writer, processor) => (node, ctx, interator) =>
      paragraph(writer, ctx, () => node.content && interator(node.content, ctx)),
  ),
  ':para': implicitPara,
  'head:block': subUse(
    {
      ':para': content,
    },
    setFn((node, ctx) => {
      const { level } = node
      const prefix = '#'.repeat(level) + ' '
      const numberPrefix = node.numberPrefix ? `${node.numberPrefix} ` : ''
      return (writer, processor) => (node, ctx, interator) => {
        // the reader cannot build this address out of the heading, so it is written here
        const anchors = markdownAnchors(ctx)
        const own = anchors?.named?.has(node) ? anchors.byNode.get(node) : undefined
        if (own) writer.writeRaw(`<a name="${quoteAttribute(own)}"></a>\n\n`)
        writer.writeRaw(prefix)
        if (numberPrefix) writer.writeRaw(numberPrefix)
        const note = noteHeading(ctx, node)
        const line = headingLine(
          writer,
          () => node.content && interator(node.content, { ...ctx, headingLine: true, __headingNode: node }),
        )
        // a reader of Markdown has six levels of headings; a line of more signs is a paragraph
        note(level <= 6 ? numberPrefix + line.replace(/\n$/, '') : null)
        writer.writeRaw(line)
        writer.writeRaw('\n')
      }
    }),
  ),
  // A list deeper than an item right after it belongs to that item: it is written inside
  // the item, with the context of its own list, so a mask of the item does not reach it.
  ':list': (writer, processor) => (node, ctx, interator) => {
    // pass list type through context
    const newCtx = {
      ...ctx,
      itemTail: undefined,
      listType: node.list,
      listCounter: { value: 1 },
      listDepth: (ctx.listDepth || 0) + 1,
    }
    if (!node.content) return
    if (!ownsLines(writer)) return interator(node.content, newCtx)
    const children = node.content
    for (let at = 0; at < children.length; at++) {
      const child = children[at]
      if (child?.type !== 'block' || child.name !== 'item') {
        interator([child], newCtx)
        continue
      }
      let last = at
      for (let next = at + 1; next < children.length; next++) {
        const after = children[next]
        if (after?.type === 'list' && Number(after.level) > Number(child.level)) last = next
        else if (after?.type !== 'blankline') break
      }
      const tail = children.slice(at + 1, last + 1)
      interator([child], tail.length > 0 ? { ...newCtx, itemTail: { nodes: tail, ctx: newCtx } } : newCtx)
      at = last
    }
  },
  // The marker of an item stands on the first line of what the item writes; the lines
  // after it are indented by the width of the marker, so they stay in the item.
  'item:block': (writer, processor) => (node, ctx, interator) => {
    const listType = ctx.listType || 'unordered'
    let prefix
    if (listType === 'ordered') {
      const counter = ctx.listCounter || { value: 1 }
      prefix = `${counter.value}. `
      counter.value++
    } else {
      prefix = '- '
    }
    const box = node.checked === undefined ? '' : node.checked ? '[x] ' : '[ ] '
    if (!ownsLines(writer)) {
      writer.writeRaw('  '.repeat(Math.max(0, (ctx.listDepth || 1) - 1)) + prefix + box)
      if (node.content) interator(node.content, { ...ctx, inItem: true })
      return
    }
    const tail = ctx.itemTail
    const body = writeAside(writer, () => {
      startLine(writer)
      if (box) writer.writeRaw(box)
      if (node.content) interator(node.content, { ...ctx, itemTail: undefined })
      if (tail) interator(tail.nodes, tail.ctx)
    })
    const indent = ' '.repeat(prefix.length)
    const lines = body.replace(/\n+$/, '').split('\n')
    // an item ends as its content does: a blank line after it keeps a loose list loose,
    // and a tight list of markdown stays tight
    const end = /\n\n$/.test(body) ? '\n\n' : '\n'
    writer.writeRaw(
      lines.map((line, i) => (i === 0 ? prefix + line : line === '' ? '' : indent + line)).join('\n') + end,
    )
  },
  'comment:block': emptyContent,
  'test:block': (writer, processor) => (node, ctx, interator) => {
    writer.writeRaw('\n**Test** ')
    writer.write(covered(node, ctx, testCaption(node, ctx)))
    writer.writeRaw('\n\n')
    interator(node.content, ctx)
    writer.writeRaw('\n')
  },
  'fixture:block': (writer, processor) => (node, ctx) => writeSourceBlock(writer, node, ctx),
  'assert:block': (writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const absent = conf.exists('absent') && Boolean(conf.getFirstValue('absent'))
    const selector = collectText(node.content).trim()
    writer.writeRaw('- ')
    writeSource(writer, inlineCode(isCovered(node, ctx) ? maskText(selector) : selector))
    writer.writeRaw(' ')
    writer.writeRaw(absent ? 'must find no block' : 'must find a block')
    if (conf.exists('caption')) {
      writer.writeRaw(': ')
      writer.write(covered(node, ctx, String(conf.getFirstValue('caption'))))
    }
    writer.writeRaw('\n')
  },
  'resource:block': (writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    writer.writeRaw('\nResource')
    if (conf.exists('name')) {
      writer.writeRaw(' ')
      writeSource(writer, inlineCode(covered(node, ctx, String(conf.getFirstValue('name')))))
    }
    writer.writeRaw(':\n\n')
    writeSourceBlock(writer, node, ctx)
  },
  'boundary:block': (writer, processor) => (node, ctx) => {
    writer.writeRaw('\n---\n')
  },
  defn: subUse(
    [
      {
        // a nested definition starts a line of its own, not the line of its term
        ':para': (writer, processor) => {
          const para = implicitPara(writer, processor)
          return (node, ctx, interator) => {
            if (makeAttrs(node, ctx).getFirstValue('nested')) writer.writeRaw('\n')
            para(node, ctx, interator)
          }
        },
      },
      { 'term:para': termPara },
    ],
    (writer, processor) => (node, ctx, interator) => {
      if (node.content) interator(node.content, ctx)
      writer.writeRaw('\n')
    },
  ),
  'term:para': termPara,
  nested: handleNested(content, 1),
  output: handleNested(sampleBlock),
  input: handleNested(sampleBlock),
  // table section
  'table:block': handleNested((writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    // a caption with codes of its own stands as a paragraph: bold around it would
    // hide the bold inside and break on an emphasis that touches a word
    if (node.caption) {
      paragraph(writer, ctx, () => interator(node.caption.content, ctx))
      writer.writeRaw('\n\n')
    } else if (conf.exists('caption')) {
      writer.writeRaw('**')
      writer.write(covered(node, ctx, String(conf.getFirstValue('caption'))))
      writer.writeRaw('**\n\n')
    }

    // collect rows data for proper Markdown table rendering
    const rows = (node.content || []).filter(child => child.name === 'row')
    if (rows.length === 0) return

    const isRowHeader = row =>
      Array.isArray(row.config) && row.config.some(c => c.name === 'header' && c.value !== false)

    const cellSpan = (cell, name) => {
      if (!Array.isArray(cell.config)) return 0
      const entry = cell.config.find(c => c.name === name)
      if (!entry) return 0
      const n = Number(entry.value)
      return Number.isFinite(n) && n > 1 ? n : 0
    }

    // GFM pipe-tables hold neither a merged cell nor a block in a cell: such a table is
    // written as a frame of HTML whose cells hold Markdown
    const hasSpans = rows.some(row =>
      (row.content || []).some(
        c => c.name === 'cell' && (cellSpan(c, 'colspan') || cellSpan(c, 'rowspan') || holdsBlock(c)),
      ),
    )

    const hasHeader = isRowHeader(rows[0])

    if (hasSpans) {
      writer.writeRaw('<table>\n')
      within(writer, 'htmlDepth', () =>
        rows.forEach(row => {
          const tag = isRowHeader(row) ? 'th' : 'td'
          writer.writeRaw('<tr>\n')
          const cells = (row.content || []).filter(c => c.name === 'cell')
          cells.forEach(cell => {
            const colspan = cellSpan(cell, 'colspan')
            const rowspan = cellSpan(cell, 'rowspan')
            let attrs = ''
            if (colspan) attrs += ` colspan="${colspan}"`
            if (rowspan) attrs += ` rowspan="${rowspan}"`
            writeIsland(writer, `<${tag}${attrs}>`, `</${tag}>`, () => writeCellParts(cell, writer, interator, ctx))
          })
          writer.writeRaw('</tr>\n')
        }),
      )
      // a blank line ends the block of HTML, or the text after it is read as HTML too
      writer.writeRaw('</table>\n\n')
      return
    }

    // A cell holds a paragraph when the table is written as blocks, and a
    // paragraph prints line breaks that would tear the row apart. The cell is
    // rendered aside and folded onto one line.
    const renderCell = cell => {
      if (typeof writer.output !== 'function') return null
      return writeAside(writer, () => within(writer, 'cellDepth', () => writeCellParts(cell, writer, interator, ctx)))
        .replace(/\s*\n+\s*/g, ' ')
        .trim()
    }

    // render each row
    rows.forEach((row, rowIndex) => {
      const cells = (row.content || []).filter(c => c.name === 'cell')
      writer.writeRaw('|')
      cells.forEach(cell => {
        writer.writeRaw(' ')
        const folded = renderCell(cell)
        if (folded === null) {
          within(writer, 'cellDepth', () => writeCellParts(cell, writer, interator, ctx))
        } else {
          writer.writeRaw(folded)
        }
        writer.writeRaw(' |')
      })
      writer.writeRaw('\n')

      // add separator after header row
      if (rowIndex === 0 && hasHeader) {
        writer.writeRaw('|')
        cells.forEach(() => {
          writer.writeRaw(' --- |')
        })
        writer.writeRaw('\n')
      }

      // if no header, add separator after first row
      if (rowIndex === 0 && !hasHeader) {
        writer.writeRaw('|')
        cells.forEach(() => {
          writer.writeRaw(' --- |')
        })
        writer.writeRaw('\n')
      }
    })
    writer.writeRaw('\n')
  }),
  ':separator': emptyContent,
  row: emptyContent, // handled inside table:block
  cell: emptyContent, // handled inside table:block
  // Toc
  ':toc': emptyContent,
  ':toc-list': emptyContent,
  ':toc-item': emptyContent,
  ':image': (writer, processor) => (node, ctx, interator) => {
    // the alternative text sits between square brackets, where a `]` of its own
    // would end it, and the address between round ones — the same shape a link has
    const inCode = writer.codeDepth > 0
    const bracketed = covered(node, ctx, writtenValue(node.alt) ?? '').replace(/([[\]\\])/g, '\\$1')
    const alt = inCode ? bracketed : keepReferences(bracketed)
    const src = markdownAddress(String(applyImageBase(node.src, ctx?.base) ?? ''), inCode)
    const title = typeof node.title === 'string' ? quotedTitle(covered(node, ctx, node.title), inCode) : ''
    writer.writeRaw(`![${alt}](${src}${title})`)
  },
}

// The output walks the document aside to learn the line it writes for each heading, and
// builds the addresses of its links from the text a reader shows for those lines. When a
// heading line holds a link to this document in code, the line depends on the addresses:
// the heading and its target are named, and the walk is repeated until the texts stay.
// The walk aside writes as the writer of the walk does when that writer writes Markdown.
const asideWriter = writer => (writer instanceof writerMarkdown ? writer.constructor : writerMarkdown)
const prepare = (tree, context, walk) => {
  const named: Set<object> = headingsWithCodeLinks(tree, context.__bindings)
  const ofTree = nodesOfTree(tree)
  let written: WrittenHeading[] | undefined
  let stable = false
  // Each walk settles one more link of a chain of such headings, and a chain is no longer
  // than the headings the first walk wrote: the number of walks is fixed by then.
  for (let read = 1, limit = 2; read <= limit; read++) {
    const lines: Array<{ node: object; line: string | null }> = []
    const codeLinks = new Set<object>()
    walk(
      { ...context, __headingLines: lines, __codeLinks: codeLinks, __codeLinkHeadings: named, __readerTexts: written },
      asideWriter,
    )
    if (read === 1) limit = lines.length + 2
    const next = lines.map(({ node, line }) => ({ node, text: line === null ? null : headingTextOf(line) }))
    const before = named.size
    // a heading an alias brings is a new node on every walk: it cannot be named, and its
    // text is compared, not the node
    codeLinks.forEach(node => ofTree.has(node) && named.add(node))
    const same =
      written !== undefined &&
      written.length === next.length &&
      written.every((entry, at) => entry.text === next[at].text)
    written = next
    // without links in code, no line depends on an address and one walk is enough
    if (codeLinks.size === 0 || (same && named.size === before)) {
      stable = true
      break
    }
  }
  if (!stable)
    console.warn('[podlite] the addresses of the markdown headings do not settle; a link may lead to the wrong one')
  context.__codeLinkHeadings = named
  context.__readerTexts = written
}

const toMarkdown = opt =>
  toAny({
    writer: writerMarkdown,
    prepare,
    ...opt,
    context: { renderMode: opt?.renderMode || 'production', base: opt?.base, ...(opt?.context || {}) },
  })
    .use('*', (writer, processor) => {
      return (node, ctx, interator) => {
        const isSemanticBlock = node => {
          const name = node.name || ''
          const isTypeBlock = (node.type || '') === 'block'
          return isTypeBlock && name === name.toUpperCase()
        }

        if (blockWithoutRule(writer, node, ctx, interator)) return
        if (isTitleBlock(node)) return titleBlock(writer, node, ctx, interator)
        if (isSemanticBlock(node)) {
          const name = writeAside(writer, () => writer.write(covered(node, ctx, String(node.name))))
          noteHeading(ctx, node)(name)
          const anchors = markdownAnchors(ctx)
          const own = anchors?.named?.has(node) ? anchors.byNode.get(node) : undefined
          if (own) writer.writeRaw(`<a name="${quoteAttribute(own)}"></a>\n\n`)
          writer.writeRaw(`# ${name}\n\n`)
        }
        if (node.hasOwnProperty('content')) {
          interator(node.content, ctx)
        }
      }
    })
    .use(rules)
    .use('*', (writer, processor) => (node, ctx, interator, defaultFn) => {
      if (!node) return defaultFn()
      if (ctx?.maskMode) return defaultFn()
      if (ctx?.renderMode === 'draft') return defaultFn()
      if (node.guarded) return defaultFn(node, { ...(ctx || {}), maskMode: true }, interator)
      // a paragraph or code written without a marker carries what =config or =set gave it
      if (node.type !== 'block' && node.type !== 'para' && node.type !== 'code') return defaultFn()
      const conf = makeAttrs(node, ctx || {})
      if (!conf.exists('masked') || !conf.getFirstValue('masked')) return defaultFn()
      return defaultFn(node, { ...(ctx || {}), maskMode: true }, interator)
    })

export default toMarkdown
