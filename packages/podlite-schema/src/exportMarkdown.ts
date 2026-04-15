import toAny from './exportAny'
import { subUse, wrapContent, emptyContent, content, setFn, handleNested } from './helpers/handlers'
import { isNamedBlock } from './helpers/makeTransformer'
import makeAttrs from './helpers/config'
import writerMarkdown from './writerMarkdown'
import clean_plugin from './plugin-clean-location'
import { getNodeId } from './ast-helpers'

const rules = {
  ':text': (writer, processor) => (node, ctx, interator) => {
    if (node.value) {
      writer.write(node.value)
    } else {
      interator(node.content, ctx)
    }
  },

  // Formatting codes
  'A<>': (writer, processor) => (node, ctx, interator) => {
    if (!(ctx.alias && ctx.alias.hasOwnProperty(node.content))) {
      writer.writeRaw(`A<${node.content}>`)
    } else {
      const src = ctx.alias[node.content].join('\n')
      const tree_1 = processor(src)
      const tree = clean_plugin()(tree_1)
      if (tree[0].type === 'para') {
        interator(tree[0].content, ctx)
      } else {
        interator(tree, ctx)
      }
    }
  },
  'C<>': wrapContent('`', '`'),
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
  'K<>': wrapContent('`', '`'),
  'O<>': wrapContent('~~', '~~'),
  'L<>': setFn((node, ctx) => {
    let { meta } = node
    if (meta === null) {
      meta = node.content
    }
    return wrapContent(`[`, `](${meta})`)
  }),

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
  'S<>': (writer, processor) => (node, ctx, interator) => {
    const content = node.content || ''
    // preserve spaces and newlines
    writer.writeRaw(content.replace(/ /g, '&nbsp;').replace(/\n/g, '  \n'))
  },
  'T<>': wrapContent('`', '`'),
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
  ':code': (writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const lang = conf.exists('lang') ? conf.getFirstValue('lang') : ''
    writer.writeRaw('```' + lang + '\n')
    // inside code blocks, write text without escaping
    if (node.content) {
      node.content.forEach(child => {
        if (typeof child === 'string') {
          writer.writeRaw(child)
        } else if (child.type === 'verbatim') {
          writer.writeRaw(child.value)
        } else {
          interator([child], ctx)
        }
      })
    }
    writer.writeRaw('```\n')
  },
  code: handleNested((writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const lang = conf.exists('lang') ? conf.getFirstValue('lang') : ''
    writer.writeRaw('```' + lang + '\n')
    if (node.content) {
      node.content.forEach(child => {
        if (typeof child === 'string') {
          writer.writeRaw(child)
        } else if (child.type === 'verbatim') {
          writer.writeRaw(child.value)
        } else {
          interator([child], ctx)
        }
      })
    }
    writer.writeRaw('```\n')
  }),
  data: emptyContent,
  ':verbatim': (writer, processor) => (node, ctx, interator) => {
    if (node.error) {
      writer.emit('errors', node.location)
    }
    writer.writeRaw(node.value)
  },
  ':blankline': emptyContent,
  ':ambient': emptyContent,
  // Directives
  ':config': setFn((node, ctx) => {
    if (!ctx.hasOwnProperty('config')) ctx.config = {}
    ctx.config[node.name] = node.config
    return emptyContent
  }),
  ':alias': setFn((node, ctx) => {
    if (!ctx.hasOwnProperty('alias')) ctx.alias = {}
    ctx.alias[node.name] = node.replacement
    return emptyContent
  }),

  // block =para
  para: handleNested(content),
  ':para': (writer, processor) => (node, ctx, interator) => {
    if (node.content) interator(node.content, ctx)
    writer.writeRaw('\n')
  },
  'head:block': subUse(
    {
      ':para': content,
    },
    setFn((node, ctx) => {
      const { level } = node
      const prefix = '#'.repeat(level) + ' '
      return (writer, processor) => (node, ctx, interator) => {
        writer.writeRaw(prefix)
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
    writer.writeRaw(indent + prefix)
    if (node.content) interator(node.content, ctx)
  },
  'comment:block': emptyContent,
  defn: (writer, processor) => (node, ctx, interator) => {
    if (node.content) interator(node.content, ctx)
    writer.writeRaw('\n')
  },
  'term:para': (writer, processor) => (node, ctx, interator) => {
    writer.writeRaw('**')
    if (node.content) interator(node.content, ctx)
    writer.writeRaw(':** ')
  },
  nested: handleNested(content, 1),
  output: handleNested(
    (writer, processor) => (node, ctx, interator) => {
      writer.writeRaw('```\n')
      if (node.content) interator(node.content, ctx)
      writer.writeRaw('```\n')
    },
    1,
  ),
  input: handleNested(
    (writer, processor) => (node, ctx, interator) => {
      writer.writeRaw('```\n')
      if (node.content) interator(node.content, ctx)
      writer.writeRaw('```\n')
    },
    1,
  ),
  // table section
  'table:block': handleNested((writer, processor) => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    if (conf.exists('caption')) {
      writer.writeRaw('**')
      writer.write(conf.getFirstValue('caption'))
      writer.writeRaw('**\n\n')
    }

    // collect rows data for proper Markdown table rendering
    const rows = (node.content || []).filter(child => child.name === 'table_row' || child.name === 'table_head')
    if (rows.length === 0) return

    const hasHeader = rows[0].name === 'table_head'

    // render each row
    rows.forEach((row, rowIndex) => {
      const cells = (row.content || []).filter(c => c.name === 'table_cell')
      writer.writeRaw('|')
      cells.forEach(cell => {
        writer.writeRaw(' ')
        if (cell.content) {
          cell.content.forEach(c => {
            if (typeof c === 'string') {
              writer.write(c.trim())
            } else {
              interator([c], ctx)
            }
          })
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
  table_row: emptyContent, // handled inside table:block
  table_cell: emptyContent, // handled inside table:block
  table_head: emptyContent, // handled inside table:block
  // Toc
  ':toc': emptyContent,
  ':toc-list': emptyContent,
  ':toc-item': emptyContent,
  ':image': (writer, processor) => (node, ctx, interator) => {
    writer.writeRaw(`![${node.alt || ''}](${node.src})`)
  },
}

const toMarkdown = opt =>
  toAny({ writer: writerMarkdown, ...opt })
    .use('*', (writer, processor) => {
      return (node, ctx, interator) => {
        const isSemanticBlock = node => {
          const name = node.name || ''
          const isTypeBlock = (node.type || '') === 'block'
          return isTypeBlock && name === name.toUpperCase()
        }

        if (isNamedBlock(node.name)) {
          return true
        }

        if (isSemanticBlock(node)) {
          const name = node.name
          writer.writeRaw('# ')
          writer.write(name)
          writer.writeRaw('\n\n')
        }
        if (node.hasOwnProperty('content')) {
          interator(node.content, ctx)
        }
      }
    })
    .use(rules)

export default toMarkdown
