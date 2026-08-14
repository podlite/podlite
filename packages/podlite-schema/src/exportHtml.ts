import toAny from './exportAny'
import {
  subUse,
  wrapContent,
  emptyContent,
  content,
  setFn,
  handleNested,
  maskText,
  collectText,
} from './helpers/handlers'
import { isNamedBlock } from './helpers/makeTransformer'
import makeAttrs, { codeConfigWithDefaults } from './helpers/config'
import { applyImageBase } from './image-base'
import htmlWriter from './writerHtml'
import clean_plugin from './plugin-clean-location'
import { getNodeId, getExplicitNodeId, getSafeNodeId, sameDocTarget } from './ast-helpers'
import { readLinkConfig } from './helpers/link-config'
import { decodeHTMLStrict } from 'entities'

const quoteValue = (value: string) => value.replace(/"/g, '&quot;')

const linkConfigAttrs = config => {
  const { newContext, title, lang, download } = readLinkConfig(config)
  const attrs: string[] = []
  if (newContext) attrs.push(' target="_blank"')
  if (title !== undefined) attrs.push(` title="${quoteValue(title)}"`)
  if (lang !== undefined) attrs.push(` hreflang="${quoteValue(lang)}"`)
  if (download === true) attrs.push(' download')
  else if (typeof download === 'string') attrs.push(` download="${quoteValue(download)}"`)
  return attrs.join('')
}

const openTag = (tag: string, node, ctx, attrs = '') => {
  const id = getExplicitNodeId(node, ctx)
  return `<${tag}${id ? ` id="${id}"` : ''}${attrs}>`
}

const rules = {
  ':text': (writer, processor) => (node, ctx, interator) => {
    // handle text with content
    if (node.value) {
      writer.write(ctx?.maskMode ? maskText(node.value) : node.value)
    } else {
      interator(node.content, ctx)
    }
  },

  // Formatting codes
  'A<>': (writer, processor) => (node, ctx, interator) => {
    //get replacement text
    const term = collectText(node.content).trim()
    if (!(ctx.alias && ctx.alias.hasOwnProperty(term))) {
      writer.write(`A<${term}>`)
    } else {
      const src = ctx.alias[term].join('\n')
      const tree_1 = processor(src)
      // now clean locations
      const tree = clean_plugin()(tree_1)
      if (tree[0].type === 'para') {
        interator(tree[0].content, ctx)
      } else {
        interator(tree, ctx)
      }
    }
  },
  'C<>': wrapContent('<code>', '</code>'),
  'E<>': (writer, processor) => (node, ctx, interator) => {
    if ('content' in node && Array.isArray(node.content)) {
      const decoded = node.content
        .filter(e => e && e.type)
        .map(element => {
          if (element.type === 'number' && 'value' in element) return String.fromCharCode(element.value)
          if (element.type === 'html_named' && 'value' in element) return decodeHTMLStrict(`&${element.value};`)
          return ''
        })
        .join('')
      writer.write(decoded)
    }
  },
  'D<>': (writer, processor) => (node, ctx, interator) => {
    // @ts-ignore
    let synonyms: Array<any> = { node }
    let definition: string[] = [node.content[0]]
    if (synonyms) {
      definition = synonyms
    }

    if (!writer.hasOwnProperty('DEFINITIONS')) {
      writer.DEFINITIONS = []
    }
    writer.DEFINITIONS.push({ definition })

    writer.writeRaw('<dfn>')
    interator(node.content, ctx)
    writer.writeRaw('</dfn>')
  },
  'B<>': wrapContent('<strong>', '</strong>'),
  'I<>': wrapContent('<em>', '</em>'),
  'R<>': wrapContent('<var>', '</var>'),
  'K<>': wrapContent('<kbd>', '</kbd>'),
  'O<>': wrapContent('<del>', '</del>'),
  'G<>': (writer, processor) => (node, ctx, interator) => {
    if (ctx.renderMode === 'draft') {
      writer.writeRaw('<span class="masked-draft">')
      interator(node.content, ctx)
      writer.writeRaw('</span>')
      return
    }
    writer.writeRaw('<span class="masked">')
    writer.write(maskText(collectText(node.content)))
    writer.writeRaw('</span>')
  },
  'H<>': wrapContent('<sup>', '</sup>'),
  'J<>': wrapContent('<sub>', '</sub>'),
  'L<>': setFn((node, ctx) => {
    let { meta } = node
    if (meta === null) {
      meta = node.content
    }
    return wrapContent(
      `<a href="${sameDocTarget(meta, ctx)}"${linkConfigAttrs(codeConfigWithDefaults(node, ctx))}>`,
      `</a>`,
    )
  }),
  'W<>': setFn((node, ctx) => {
    let { meta } = node
    if (meta === null) {
      meta = node.content
    }
    return wrapContent(
      `<a href="${sameDocTarget(meta, ctx)}"${linkConfigAttrs(codeConfigWithDefaults(node, ctx))} class="backlink">`,
      `</a>`,
    )
  }),

  /**
     * CSS rules for footnotes
     
    .footnote a {
        text-decoration: none;
    }
    .footnotes {
    border-top-style: solid;
    border-top-width: 1px;
    border-top-color: #eee;
    }
     */
  'N<>': (writer, processor) => {
    writer.addListener('end', () => {
      if (!writer.hasOwnProperty('FOOTNOTES')) {
        return
      }
      const footnotes = writer.FOOTNOTES
      if (footnotes.length < 1) {
        return
      } // if empty footnotes
      writer.writeRaw(`<div class="footnotes">`)
      footnotes.map(footnote => {
        writer.writeRaw(
          `<p><sup id="${footnote.fnId}" class="footnote"><a href="#${footnote.fnRefId}">[${footnote.gid}]</a></sup> `,
        )
        footnote.make()
        writer.writeRaw(`</p>`)
      })
      writer.writeRaw(`</div>`)
    })
    return (node, ctx, interator) => {
      // skip empty notes
      if (node.content.length < 1) {
        return
      }
      if (!writer.hasOwnProperty('gid')) {
        writer.gid = 1
      }
      // get foot note id
      const gid = writer.gid++
      const fnRefId = `fnref:${gid}`
      const fnId = `fn:${gid}`
      writer.writeRaw(`<sup id="${fnRefId}" class="footnote"><a href="#${fnId}">[${gid}]</a></sup>`)
      if (!writer.hasOwnProperty('FOOTNOTES')) {
        writer.FOOTNOTES = []
      }
      writer.FOOTNOTES.push({
        gid,
        fnRefId,
        fnId,
        make: () => {
          interator(node.content, ctx)
        },
      })
    }
  },
  'S<>': (writer, processor) => (node, ctx, interator) => {
    const spaces = collectText(node.content).replace(/ /g, '&nbsp;')
    const newFeed = spaces.replace(/\n/g, '</br>')
    writer.writeRaw(newFeed)
  },
  'T<>': wrapContent('<samp>', '</samp>'),
  'U<>': wrapContent('<u>', '</u>'),
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
    writer.INDEXTERMS.push({
      entry,
    })
  },
  'Z<>': emptyContent,

  pod: content,
  ':code': wrapContent('<pre><code>', '</code></pre>'),
  code: handleNested(setFn((node, ctx) => wrapContent(`${openTag('pre', node, ctx)}<code>`, '</code></pre>'))),
  data: emptyContent,
  ':verbatim': (writer, processor) => (node, ctx, interator) => {
    if (node.error) {
      writer.emit('errors', node.location)
    }
    if (ctx?.maskMode) {
      writer.write(maskText(node.value))
      return
    }
    interator(node.value, ctx)
  },
  ':blankline': emptyContent,
  ':ambient': emptyContent,
  // Directives
  ':config': setFn((node, ctx) => {
    // setup context
    if (!ctx.hasOwnProperty('config')) ctx.config = {}
    //collect configs in context
    ctx.config[node.name] = node.config
    return emptyContent
  }),
  ':alias': setFn((node, ctx) => {
    // set alias
    if (!ctx.hasOwnProperty('alias')) ctx.alias = {}
    //collect configs in context
    ctx.alias[node.name] = node.replacement
    return emptyContent
  }),

  // block =para
  // With an :id the block owns the <p> so the anchor lands on it; without one
  // the inner paragraph renders as before.
  para: handleNested(
    setFn((node, ctx) =>
      getExplicitNodeId(node, ctx)
        ? subUse({ ':para': content }, wrapContent(openTag('p', node, ctx), '</p>'))
        : content,
    ),
  ),
  ':para': setFn((node, ctx) => wrapContent(openTag('p', node, ctx), '</p>')),
  'head:block': subUse(
    {
      // inside head don't wrap into <p>
      ':para': content,
    },
    setFn((node, ctx) => {
      const { level } = node
      const id = getSafeNodeId(node, ctx)
      const open = `<h${level}${id ? ` id="${id}"` : ''}>${
        node.numberPrefix ? `<span class="head-number">${node.numberPrefix}</span> ` : ''
      }`
      return wrapContent(open, `</h${level}>`)
    }),
  ),
  ':list': setFn((node, ctx) =>
    node.list === 'ordered'
      ? wrapContent(openTag('ol', node, ctx), '</ol>')
      : node.list === 'variable'
      ? wrapContent(openTag('dl', node, ctx), '</dl>')
      : node.list === 'task'
      ? wrapContent(openTag('ul', node, ctx, ' class="task-list"'), '</ul>')
      : wrapContent(openTag('ul', node, ctx), '</ul>'),
  ),
  'item:block': (writer, processor) => (node, ctx, interator) => {
    // make text from first para
    if (!(node.content instanceof Array)) {
      console.error('[pod6] item:block : Error in content of ' + JSON.stringify(node))
    }
    const isTask = node.checked !== undefined

    if (isTask) {
      writer.writeRaw(openTag('li', node, ctx, ' class="task-list-item"'))
      writer.writeRaw(node.checked ? '<input type="checkbox" disabled checked> ' : '<input type="checkbox" disabled> ')
    } else {
      writer.writeRaw(openTag('li', node, ctx))
    }

    interator(node.content, ctx)
    writer.writeRaw('</li>')
  },
  'comment:block': emptyContent,
  'boundary:block': (writer, processor) => (node, ctx) => {
    const conf = makeAttrs(node, ctx)
    const id = getExplicitNodeId(node, ctx)
    const idAttr = id ? ` id="${id}"` : ''
    if (conf.exists('caption')) {
      writer.writeRaw(`<hr${idAttr} title="`)
      writer.write(conf.getFirstValue('caption'))
      writer.writeRaw('">')
    } else {
      writer.writeRaw(`<hr${idAttr}>`)
    }
  },
  // The term opens the pair, so an :id on the definition lands on its <dt>.
  defn: setFn((node, ctx) => {
    const id = getExplicitNodeId(node, ctx)
    return id
      ? subUse({ 'term:para': wrapContent(`<dt id="${id}">`, '</dt><dd>') }, wrapContent('', '</dd>'))
      : wrapContent('', '</dd>')
  }),
  'term:para': wrapContent('<dt>', '</dt><dd>'),
  nested: handleNested(content, 1),
  output: handleNested(
    setFn((node, ctx) => wrapContent(`${openTag('pre', node, ctx)}<samp>`, '</samp></pre>')),
    1,
  ),
  input: handleNested(
    setFn((node, ctx) => wrapContent(`${openTag('pre', node, ctx)}<kbd>`, '</kbd></pre>')),
    1,
  ),
  // table section
  'table:block': handleNested((writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    writer.writeRaw(openTag('table', node, ctx))
    if (conf.exists('caption')) {
      writer.writeRaw('<caption>')
      writer.write(conf.getFirstValue('caption'))
      writer.writeRaw('</caption>')
    }
    const innerCtx = { ...ctx, ...(node.align && { 'table.align': node.align }) }
    const content = node.content || []
    const isHeaderRow = c =>
      c && c.name === 'row' && Array.isArray(c.config) && c.config.some(a => a.name === 'header' && a.value !== false)
    const hasHeader = content.some(isHeaderRow)
    if (!hasHeader) {
      interator(content, innerCtx)
      writer.writeRaw('</table>')
      return
    }
    const rowNodes = content.filter(c => c && c.name === 'row')
    const nonRowContent = content.filter(c => !c || c.name !== 'row')
    let headerEnd = 0
    while (headerEnd < rowNodes.length && isHeaderRow(rowNodes[headerEnd])) headerEnd++
    const headerRows = rowNodes.slice(0, headerEnd)
    const bodyRows = rowNodes.slice(headerEnd)
    interator(nonRowContent, innerCtx)
    writer.writeRaw('<thead>')
    interator(headerRows, innerCtx)
    writer.writeRaw('</thead>')
    if (bodyRows.length > 0) {
      writer.writeRaw('<tbody>')
      interator(bodyRows, innerCtx)
      writer.writeRaw('</tbody>')
    }
    writer.writeRaw('</table>')
  }),
  ':separator': emptyContent,
  row: (writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const isHeader = conf.exists('header') && conf.getFirstValue('header') !== false
    writer.writeRaw('<tr>')
    interator(node.content, { ...ctx, __row_header: isHeader, cellinRow: 0 })
    writer.writeRaw('</tr>')
  },
  cell: (writer, processor) => (node, ctx, interator) => {
    const tag = ctx.__row_header ? 'th' : 'td'
    const conf = makeAttrs(node, ctx)
    const colspan = conf.exists('colspan') ? conf.getFirstValue('colspan') : null
    const rowspan = conf.exists('rowspan') ? conf.getFirstValue('rowspan') : null
    const colAlign = (alignMap => {
      if (!Array.isArray(alignMap)) return null
      const num = ctx['cellinRow']++
      return alignMap[num] || null
    })(ctx['table.align'])
    let attrs = ''
    if (colspan !== null && Number(colspan) > 1) attrs += ` colspan="${colspan}"`
    if (rowspan !== null && Number(rowspan) > 1) attrs += ` rowspan="${rowspan}"`
    if (colAlign && ['left', 'right', 'center', 'justify'].includes(colAlign))
      attrs += ` style="text-align:${colAlign}"`
    writer.writeRaw(`<${tag}${attrs}>`)
    interator(node.content, ctx)
    writer.writeRaw(`</${tag}>`)
  },
  // Toc
  ':toc': (writer, processor) => (node, ctx, interator) => {
    writer.writeRaw('<div className="toc">')
    // get toc title
    const conf = makeAttrs(node, ctx)
    if (conf.exists('title')) {
      const title = conf.getFirstValue('title')
      writer.writeRaw('<div className="toctitle">')
      writer.write(title)
      writer.writeRaw('</div>')
    }
    interator(node.content, ctx)
    writer.writeRaw('</div>')
  },
  ':toc-list': setFn((node, ctx) => wrapContent(`<ul class="toc-list listlevel${node.level}">`, '</ul>')),
  ':toc-item': setFn((node, ctx) => wrapContent('<li class="toc-item">', '</li>')),
  ':image': (writer, processor) => (node, ctx, interator) => {
    writer.writeRaw(`<img src="${applyImageBase(node.src, ctx?.base)}" alt="${node.alt || ''}"/>`)
  },
}

const toHtml = opt =>
  toAny({
    writer: htmlWriter,
    ...opt,
    context: { renderMode: opt?.renderMode || 'production', base: opt?.base, ...(opt?.context || {}) },
  })
    .use('*', (writer, processor) => {
      return (node, ctx, interator) => {
        // skip warnings for semantic blocks
        const isSemanticBlock = node => {
          const name = node.name || ''
          const isTypeBlock = (node.type || '') === 'block'
          return isTypeBlock && name === name.toUpperCase()
        }

        //Named blocks for which no explicit class has been defined or loaded are
        //usually not rendered by the standard renderers.
        if (isNamedBlock(node.name)) {
          return true
        }

        if (isSemanticBlock(node)) {
          const name = node.name
          writer.writeRaw('<h1 class="')
          writer.write(name)
          writer.writeRaw('">')
          writer.write(name)
          writer.writeRaw('</h1>')
        } else {
          console.warn('[podlite] Unhandled node' + JSON.stringify(node, null, 2))
        }
        if (node.hasOwnProperty('content')) {
          interator(node.content, ctx)
        }
      }
    })
    .use(rules)
    .use('*', (writer, processor) => (node, ctx, interator, defaultFn) => {
      if (!node || node.type !== 'block') return defaultFn()
      if (ctx?.maskMode) return defaultFn()
      const conf = makeAttrs(node, ctx || {})
      if (!conf.exists('masked') || !conf.getFirstValue('masked')) return defaultFn()
      if (ctx?.renderMode === 'draft') return defaultFn()
      return defaultFn(node, { ...(ctx || {}), maskMode: true }, interator)
    })

export default toHtml
