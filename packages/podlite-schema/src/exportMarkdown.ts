import toAny from './exportAny'
import { isCovered } from './guard'
import {
  subUse,
  wrapContent,
  emptyContent,
  content,
  setFn,
  handleNested,
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
import { decodeEntities, getNodeId, linkTarget, readerAnchors, sameDocTarget, writtenValue } from './ast-helpers'
import { quoteAttribute } from './helpers/html-attr'
import { readLinkConfig } from './helpers/link-config'
import { testCaption, longestBacktickRun } from './test-display'

// A markdown reader builds the anchor out of the heading itself, by its own rules,
// so a link written here has to match what that reader will produce.
// Built once per document and mode: a hidden block renders with a copy of the context,
// and a cache kept on the context itself would be rebuilt for every one of them.
const readerAnchorsCache = new WeakMap<object, Map<string, ReturnType<typeof readerAnchors>>>()
const markdownAnchors = ctx => {
  const index = ctx?.__anchors
  if (!index) return undefined
  const mode = ctx.renderMode === 'draft' ? 'draft' : 'production'
  let byMode = readerAnchorsCache.get(index)
  if (!byMode) readerAnchorsCache.set(index, (byMode = new Map()))
  if (!byMode.has(mode)) byMode.set(mode, readerAnchors(index, mode))
  return byMode.get(mode)
}

// a title written on a link inside hidden content is hidden with it
const linkTitle = (config, conceal: (text: string) => string = text => text) => {
  const { title } = readLinkConfig(config)
  return title === undefined ? '' : ` "${conceal(title).replace(/"/g, '\\"')}"`
}

// Markdown has no form for a link whose target the author never wrote — an empty
// address there claims the current document — so the text is written on its own.
// A bracket or a space inside the address would end it where markdown looks for
// the closing one, so such an address is written in angle brackets, the form
// markdown keeps for exactly that. An angle of its own is percent-encoded rather
// than dropped, so the address survives the round trip — no source text reaches
// here holding one today, since the parser ends the code on it.
const markdownAddress = (address: string): string =>
  /[()\s]/.test(address) ? `<${address.replace(/</g, '%3C').replace(/>/g, '%3E')}>` : address

const linkWrap = (node, ctx) => {
  const target = linkTarget(node)
  if (target === undefined) return wrapContent('', '')
  const resolved = sameDocTarget(target, ctx, markdownAnchors(ctx), node)
  // Markdown has no anchor without an address either, so a refused link keeps its
  // text and loses the brackets.
  if (resolved === undefined) return wrapContent('', '')
  const address = String(resolved)
  return wrapContent(
    `[`,
    `](${markdownAddress(address)}${linkTitle(codeConfigWithDefaults(node, ctx), text => covered(node, ctx, text))})`,
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
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
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

// a writer given by the caller may be a plain one, without a source of its own
const writeSource = (writer, text: string) =>
  typeof writer.writeSource === 'function' ? writer.writeSource(text) : writer.writeRaw(text)

// Code in a line is written aside first: its fence is one backtick longer than any run
// inside, so a backtick of the text does not end the code early.
const codeSpan = (writer, processor) => (node, ctx, interator) => {
  const parts: string[] = []
  const original = writer.output
  writer.output = (str: string) => parts.push(str)
  try {
    within(writer, 'codeDepth', () => node.content && interator(node.content, ctx))
  } finally {
    writer.output = original
  }
  writer.writeRaw(inlineCode(parts.join('')))
}

const htmlText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// A cell of a table written as HTML holds Markdown: a blank line ends the block of
// HTML before it and another one before the closing tag, so a reader takes what
// lies between as Markdown. A cell with nothing to show closes on its own line.
const writeIsland = (writer, open: string, close: string, write: () => void) => {
  const original = writer.output
  if (typeof original !== 'function') {
    writer.writeRaw(`${open}\n\n`)
    write()
    writer.writeRaw(`\n\n${close}\n`)
    return
  }
  const parts: string[] = []
  writer.output = (str: string) => parts.push(str)
  try {
    write()
  } finally {
    writer.output = original
  }
  const body = parts.join('').replace(/\n+$/, '')
  writer.writeRaw(body.trim() === '' ? `${open}${close}\n` : `${open}\n\n${body}\n\n${close}\n`)
}

// Input and output are written as code in a fence a reader keeps as written. A fence
// holds only on a line of its own and outside a quote or a cell folded onto a line;
// there the sample is written as text, so its words stay in sight.
const sampleBlock = (writer, processor) => (node, ctx, interator) => {
  const children = node.content || []
  const isText = child => typeof child === 'string' || child.type === 'text' || child.type === 'verbatim'
  const valueOf = child => (typeof child === 'string' ? child : child.value)
  if (writer.quoteDepth > 0 || writer.cellDepth > 0) {
    children.forEach(child =>
      isText(child)
        ? writeText(writer, typeof child === 'string' ? node : child, ctx, valueOf(child))
        : interator([child], ctx),
    )
    if (!writer.lastWritten.endsWith('\n')) writer.writeRaw('\n')
    writer.writeRaw('\n')
    return
  }
  const atLineStart = writer.lastWritten === '' || writer.lastWritten.endsWith('\n')
  const masked = isCovered(node, ctx)
  const parts: string[] = []
  const original = writer.output
  const capture = typeof original === 'function'
  if (capture) writer.output = (str: string) => parts.push(str)
  try {
    within(writer, 'codeDepth', () =>
      children.forEach(child =>
        isText(child)
          ? writeSource(writer, masked ? maskText(valueOf(child)) : valueOf(child))
          : interator([child], ctx),
      ),
    )
  } finally {
    if (capture) writer.output = original
  }
  const body = parts.join('')
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(body) + 1))
  writer.writeRaw(`${atLineStart ? '' : '\n'}${fence}\n`)
  if (body !== '') writer.writeRaw(body.endsWith('\n') ? body : `${body}\n`)
  writer.writeRaw(`${fence}\n`)
}

const implicitPara = handleNested((writer, processor) => (node, ctx, interator) => {
  if (node.content) interator(node.content, ctx)
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
    writer.writeRaw(text.replace(/ /g, '&nbsp;').replace(/\n/g, '  \n'))
  } else {
    writer.write(isCovered(node, ctx) ? maskText(value) : value)
  }
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
        message => console.warn(`[podlite] ${message}`),
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
      writer.writeRaw(writer.escape(expandTabs(masked, ctx.keepSpaces)).replace(/ /g, '&nbsp;').replace(/\n/g, '  \n'))
    else writer.write(masked)
  },
  'H<>': wrapContent('<sup>', '</sup>'),
  'J<>': wrapContent('<sub>', '</sub>'),
  'L<>': setFn((node, ctx) => linkWrap(node, ctx)),
  'W<>': setFn((node, ctx) => linkWrap(node, ctx)),

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
        make: () => {
          interator(node.content, ctx)
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
    writer.writeRaw('```' + lang + '\n')
    const masked = isCovered(node, ctx)
    within(writer, 'codeDepth', () =>
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
    // code at the end of input may lack its final line break
    if (!writer.lastWritten.endsWith('\n')) writer.writeRaw('\n')
    writer.writeRaw('```\n')
  }),
  code: handleNested((writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const lang = conf.exists('lang') ? conf.getFirstValue('lang') : ''
    writer.writeRaw('```' + lang + '\n')
    const masked = isCovered(node, ctx)
    within(writer, 'codeDepth', () =>
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
    writer.writeRaw('```\n')
  }),
  data: emptyContent,
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
  para: handleNested(content),
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
        if (node.content) interator(node.content, ctx)
        writer.writeRaw('\n')
      }
    }),
  ),
  ':list': setFn((node, ctx) => {
    return (writer, processor) => (node, ctx, interator) => {
      // pass list type through context
      const newCtx = {
        ...ctx,
        listType: node.list,
        listCounter: { value: 1 },
        listDepth: (ctx.listDepth || 0) + 1,
      }
      if (node.content) interator(node.content, newCtx)
    }
  }),
  'item:block': (writer, processor) => (node, ctx, interator) => {
    const indent = '  '.repeat(Math.max(0, (ctx.listDepth || 1) - 1))
    const listType = ctx.listType || 'unordered'
    let prefix
    if (listType === 'ordered') {
      const counter = ctx.listCounter || { value: 1 }
      prefix = `${counter.value}. `
      counter.value++
    } else if (listType === 'variable') {
      prefix = '- '
    } else {
      prefix = '- '
    }
    if (node.checked !== undefined) {
      prefix += node.checked ? '[x] ' : '[ ] '
    }
    writer.writeRaw(indent + prefix)
    if (node.content) interator(node.content, ctx)
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
      interator(node.caption.content, ctx)
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

    // GFM pipe-tables don't support colspan/rowspan — fall back to inline HTML
    const hasSpans = rows.some(row =>
      (row.content || []).some(c => c.name === 'cell' && (cellSpan(c, 'colspan') || cellSpan(c, 'rowspan'))),
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
      const parts: string[] = []
      const original = writer.output
      if (typeof original !== 'function') return null
      writer.output = (str: string) => parts.push(str)
      try {
        within(writer, 'cellDepth', () => writeCellParts(cell, writer, interator, ctx))
      } finally {
        writer.output = original
      }
      return parts
        .join('')
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
    const alt = covered(node, ctx, writtenValue(node.alt) ?? '').replace(/([[\]\\])/g, '\\$1')
    const src = markdownAddress(String(applyImageBase(node.src, ctx?.base) ?? ''))
    writer.writeRaw(`![${alt}](${src})`)
  },
}

const toMarkdown = opt =>
  toAny({
    writer: writerMarkdown,
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

        if (isSemanticBlock(node)) {
          const name = node.name
          writer.writeRaw('# ')
          writer.write(covered(node, ctx, String(name)))
          writer.writeRaw('\n\n')
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
