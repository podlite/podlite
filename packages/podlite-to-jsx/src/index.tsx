import * as React from 'react'
import { createElement } from 'react'
import { podlite as podlite_core } from 'podlite'
import {
  Verbatim,
  PodNode,
  Text,
  Rules,
  RulesStrict,
  getNodeId,
  parse,
  makeAttrs,
  emptyContent,
  content as nodeContent,
  setFn,
  subUse,
  toAny,
  isNamedBlock,
  isSemanticBlock,
  Writer,
  toAnyRules,
  PodliteExport,
  frozenIds,
} from '@podlite/schema'
import { Toc, Plugin, pluginCleanLocation as clean_plugin } from '@podlite/schema'

// interface SetFn { <T>(<T>node, ctx:any) => () => () =>void
// }
export type CreateElement = typeof React.createElement
const helperMakeReact = ({ wrapElement }: { wrapElement?: WrapElement }) => {
  let i_key_i = 0
  let mapByType = {}
  const getIdForNode = ({ type = 'notype', name = 'noname' }) => {
    const type_idx = `${type}_${name}`
    if (!mapByType[type_idx]) {
      mapByType[type_idx] = 0
    }
    ++mapByType[type_idx]
    return `${type_idx}_${mapByType[type_idx]}`
  }
  return function (src: string | Function, node: PodNode, children, extraProps = {}, ctx = {}) {
    // for string return it
    if (typeof node == 'string') {
      return node
    }
    const { ...attr } = node

    const key = 'type' in node && node.type ? getIdForNode(node) : ++i_key_i
    const result =
      typeof src === 'function'
        ? src({ ...attr, key, children }, children)
        : createElement(src, { ...extraProps, key }, children)

    // // create react element and pass key
    // if (!isValidElementType(src)) {
    //     throw new Error(`Bad React element for ${ruleName} rule `)
    // }

    if (typeof wrapElement === 'function') {
      return wrapElement(node, result, ctx)
    }
    return result
  }
}

export interface WrapElement {
  (node: PodNode, children: React.ReactChild, ctx: any): JSX.Element
}
export const Podlite: React.FC<{
  [key: string]: any
  children?: string
  file?: string
  plugins?: any
  wrapElement?: WrapElement
  tree?: PodliteExport
}> = ({ children, ...options }) => {
  const result: any = podlite(children, options)
  return result
}
const mapToReact = (makeComponent): Partial<RulesStrict> => {
  const mkComponent = src => (writer, processor) => (node, ctx, interator) => {
    // prepare extraProps for createElement
    // add id attribute if exists
    const id = getNodeId(node, ctx)?.replace(/\s/g, '-')
    // check if node.content defined
    return makeComponent(src, node, 'content' in node ? interator(node.content, { ...ctx }) : [], { id }, ctx)
  }
  // Handle nested block and :nested block attribute
  const handleNested = (defaultHandler, implicitLevel?: number) => {
    return (writer, processor) => {
      const defaultHandlerInited = defaultHandler(writer, processor)
      return (node, ctx, interator) => {
        const nesting = makeAttrs(node, ctx).getFirstValue('nested') || implicitLevel
        const children = defaultHandlerInited(node, ctx, interator)
        // if no nesting needs - simply return children
        if (!nesting) {
          return children
        }

        const arr = [...Array(nesting).keys()]
        return arr.reduce(acc => makeComponent('blockquote', node, acc), children)
      }
    }
  }
  // Handle nested block and :nested block attribute
  const handleNotificationBlock = defaultHandler => {
    return (writer, processor) => {
      const defaultHandlerInited = defaultHandler(writer, processor)
      return (node, ctx, interator) => {
        const conf = makeAttrs(node, ctx)
        const notify = conf.getFirstValue('notify')
        const caption = conf.exists('caption') ? conf.getFirstValue('caption') : null
        const children = defaultHandlerInited(node, ctx, interator)
        // if no nesting needs - simply return children
        if (!notify) {
          return children
        }
        return makeComponent(
          ({ children, key }) => (
            <aside className={`notify ${notify.toLowerCase()}`} key={key}>
              <p className="notify-title">{caption || notify.charAt(0).toUpperCase() + notify.slice(1)}</p>
              {children}
            </aside>
          ),
          node,
          children,
          {},
          ctx,
        )
      }
    }
  }

  return {
    pod: mkComponent('div'),
    root: nodeContent,
    data: emptyContent(),
    ':ambient': emptyContent(),
    ':code': mkComponent(({ children, key }) => (
      <code key={key}>
        <pre>{children}</pre>
      </code>
    )),
    code: mkComponent(({ children, key }) => (
      <code key={key}>
        <pre>{children}</pre>
      </code>
    )),
    image: nodeContent,
    ':image': setFn((node, ctx) => {
      return mkComponent(({ children, key }) => <img key={key} src={node.src} alt={node.alt} />)
    }),

    ':text': (writer, processor) => (node: Text, ctx, interator) => {
      return node.value
    },
    ':verbatim': (writer, processor) => (node: Verbatim, ctx, interator) => {
      return node.value
    },
    'head:block': subUse(
      {
        // inside head don't wrap into <p>
        ':para': nodeContent,
      },
      setFn((node, ctx) => {
        const { level } = node
        // TODO: refactor linking for blocks
        const id = getNodeId(node, ctx)?.replace(/\s/g, '-')
        return mkComponent(({ level, children, key }) => createElement(`h${level}`, { key, id }, children))
      }),
    ),

    ':blankline': emptyContent(),
    ':para': mkComponent('p'),
    para: mkComponent('div'),
    'comment:block': emptyContent(),
    defn: subUse(
      [
        // to avoid overlap para blocks handlers
        // define general :para at first
        { ':para': mkComponent('dd') },
        { 'term:para': mkComponent('dt') },
      ],
      nodeContent,
    ),
    nested: handleNotificationBlock(handleNested(nodeContent, 1)),
    output: mkComponent(({ children, key }) => (
      <pre key={key}>
        <samp>{children}</samp>
      </pre>
    )),
    input: mkComponent(({ children, key }) => (
      <pre key={key}>
        <kbd>{children}</kbd>
      </pre>
    )),

    // Directives
    ':config': setFn((node, ctx) => {
      // setup context
      if (!ctx.hasOwnProperty('config')) ctx.config = {}
      //collect configs in context
      ctx.config[node.name] = node.config
      return emptyContent()
    }),
    ':alias': setFn((node, ctx) => {
      // set alias
      if (!ctx.hasOwnProperty('alias')) ctx.alias = {}
      //collect configs in context
      ctx.alias[node.name] = node.replacement
      return emptyContent()
    }),

    // Formatting codes
    'A<>': (writer, processor) => (node, ctx, interator) => {
      let term = node.content
      if (typeof term !== 'string' && 'value' in term) {
        term = term.value
      }
      //get replacement text
      if (!(ctx.alias && ctx.alias.hasOwnProperty(term))) {
        return makeComponent(
          ({ children, key }) => <code key={key}>A&lt;{children}&gt;</code>,
          node,
          interator(node.content, ctx),
        )
      } else {
        const src = ctx.alias[term].join('\n')
        const tree_1 = processor(src)
        // now clean locations
        const tree = clean_plugin()(tree_1)
        if (tree[0].type === 'para') {
          return interator(tree[0].content, ctx)
        } else {
          return interator(tree, ctx)
        }
      }
    },
    'B<>': mkComponent('strong'),
    'C<>': mkComponent('code'),
    'E<>': (writer, processor) => (node, ctx, interator) => {
      if ('content' in node && Array.isArray(node.content))
        return node.content
          .filter(e => e && e.type == 'number')
          .map(element => {
            return String.fromCharCode(element.value)
          })
          .join('')
    },
    'I<>': mkComponent('i'),
    'K<>': mkComponent('kbd'),
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
        if (!writer.hasOwnProperty('postInterator')) {
          writer.postInterator = []
        }

        const FootNotes = makeComponent(
          ({ children, key }) => (
            <div key={`${key}_FOOTNOTES`} className="footnotes">
              {footnotes.map((footnote, id) => {
                return (
                  <p key={id}>
                    <sup id={footnote.fnId} className="footnote">
                      <a href={`#${footnote.fnRefId}`}>[{footnote.gid}]</a>
                    </sup>
                    {footnote.make()}
                  </p>
                )
              })}
            </div>
          ),
          {},
        )

        writer.postInterator.push(FootNotes)
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
        if (!writer.hasOwnProperty('FOOTNOTES')) {
          writer.FOOTNOTES = []
        }
        writer.FOOTNOTES.push({
          gid,
          fnRefId,
          fnId,
          node,
          make: () => {
            return interator(node.content, ctx)
          },
        })
        return makeComponent(
          ({ children, key }) => (
            <sup key={key} id={fnRefId} className="footnote">
              <a href={`#${fnId}`}>[{gid}]</a>
            </sup>
          ),
          node,
        )
      }
    },
    'R<>': mkComponent('var'),
    'T<>': mkComponent('samp'),
    'D<>': (writer, processor) => (node, ctx, interator) => {
      let { synonyms } = node
      let definition: string[] = [node.content[0]]
      if (synonyms) {
        definition = synonyms
      }

      if (!writer.hasOwnProperty('DEFINITIONS')) {
        writer.DEFINITIONS = []
      }
      writer.DEFINITIONS.push({ definition })
      return makeComponent('dfn', node, interator(node.content, ctx))
    },
    'L<>': setFn((node, ctx) => {
      let { meta } = node
      if (meta === null) {
        meta = node.content
      }
      //TODO: extract text from content array
      if (Array.isArray(meta)) {
        meta = meta[0]
      }
      if (meta && typeof meta !== 'string' && 'value' in meta) {
        meta = meta.value
      }
      return mkComponent(({ children, key }) => (
        <a href={meta} key={key}>
          {children}
        </a>
      ))
    }),
    'S<>': (writer, processor) => (node, ctx, interator) => {
      let content = node.content || ''
      if (typeof content !== 'string' && 'value' in content) {
        content = content.value
      }
      const Content = content.split('').map((symbol, index) => {
        if (symbol === ' ') return '\u00a0'
        if (symbol === '\n') return <br key={index} />
        return symbol
      })
      return makeComponent(({ children, key }) => children, {}, Content)
    },
    'V<>': nodeContent,
    'Z<>': emptyContent(),
    'U<>': mkComponent('u'),
    'X<>': (writer, processor) => (node, ctx, interator) => {
      let { entry } = node
      if (entry === null && node.content.length > 0) {
        //@ts-ignore
        entry = [node.content[0]]
      }
      // else { return }
      if (!writer.hasOwnProperty('INDEXTERMS')) {
        writer.INDEXTERMS = []
      }
      writer.INDEXTERMS.push({
        entry,
      })
      return interator(node.content, ctx)
    },
    'Delete<>': mkComponent('del'),
    // table section
    table: (writer, processor) => (node, ctx, interator) => {
      const conf = makeAttrs(node, ctx)
      let attr = { caption: '' }
      if (conf.exists('caption')) {
        const caption = conf.getFirstValue('caption')
        attr.caption = caption
      }
      if (typeof node === 'string') {
        return node
      }
      if (!('content' in node)) {
        console.warn('[jsx] no content in node')
        return ''
      }
      const id = getNodeId(node, ctx)?.replace(/\s/g, '-')
      return makeComponent(
        ({ key, children }) => {
          return (
            <table key={key} id={id}>
              <caption className="caption">{attr.caption}</caption>
              <tbody>{children}</tbody>
            </table>
          )
        },
        node,
        interator(node.content, { ...ctx }),
      )
    },
    ':separator': emptyContent(),
    table_row: mkComponent('tr'),
    table_cell: mkComponent('td'),
    table_head: subUse(
      {
        table_cell: mkComponent('th'),
      },
      mkComponent('tr'),
    ),
    ':list': setFn((node, ctx) =>
      node.list === 'ordered' ? mkComponent('ol') : node.list === 'variable' ? mkComponent('dl') : mkComponent('ul'),
    ),
    'item:block': (writer, processor) => (node, ctx, interator) => {
      if (typeof node === 'string') {
        return node
      }
      if (!('content' in node)) {
        console.warn('[jsx] no content in node')
        return ''
      }
      // make text from first para
      if (!(node.content instanceof Array)) {
        console.error(node)
      }
      const id = getNodeId(node, ctx)?.replace(/\s/g, '-')
      return makeComponent('li', node, interator(node.content, { ...ctx }), { id })
    },
    // table of content
    ':toc': setFn((node: Toc, ctx) => {
      const tocTitle = node.title
      return mkComponent(({ children, key }) => (
        <div className="toc" key={key}>
          {tocTitle ? <div className="toctitle">{tocTitle}</div> : ''}
          {children}
        </div>
      ))
    }),
    ':toc-list': setFn((node, ctx) => {
      const { level } = node
      return mkComponent(({ children, key }) => (
        <ul className={`toc-list listlevel${level}`} key={key}>
          {children}
        </ul>
      ))
    }),
    ':toc-item': subUse(
      {
        // inside head don't wrap into <p>
        ':para': nodeContent,
      },
      setFn((node, ctx) => {
        return mkComponent(({ children, key }) => (
          <li className="toc-item" key={key}>
            {children}
          </li>
        ))
      }),
    ),
  }
}
function podlite(
  children: string,
  {
    file,
    plugins = () => {},
    wrapElement,
    tree,
  }: { file?: string; plugins?: any; wrapElement?: WrapElement; tree?: PodliteExport },
  ...args
) {
  const ast = (tree => {
    if (tree) return tree.interator
    let podlite = podlite_core({ importPlugins: true })
    let treeAfterParsed = podlite.parse(children || file)
    return podlite.toAst(treeAfterParsed)
  })(tree)

  // const   ast = parse( children || content )
  let i_key_i = 10000
  const makeComponent = helperMakeReact({ wrapElement })

  const jsxPlugins: { [name: string]: Plugin['toJSX'] } = toAnyRules(
    'toJSX',
    podlite_core({ importPlugins: true }).getPlugins(),
  )
  // initialize each plugin
  const jsxPluginInited = Object.fromEntries(
    Object.entries(jsxPlugins).map(([key, value]) => [key, value(makeComponent)]),
  )

  const rules: Rules = {
    ...mapToReact(makeComponent),
    ...plugins(makeComponent),
    ...jsxPluginInited,
  }
  interface WriterPostinterator extends Writer {
    postInterator?: any
  }
  const writer = new Writer(s => {}) as WriterPostinterator
  const res = toAny({ processor: parse })
    .use({
      '*:*': () => (node, ctx, interator) => {
        // skip named blocks
        if (isNamedBlock(node.name)) {
          return null
        }
        if (isSemanticBlock(node)) {
          return makeComponent(
            ({ key, children }) => {
              return (
                <div key={key}>
                  <h1 className={node.name} key={key}>
                    {node.name}
                  </h1>
                  {interator(node.content, { ...ctx })}
                </div>
              )
            },
            node,
            interator(node.content, { ...ctx }),
          )
        }
        console.warn('[podlite] Not supported: ' + JSON.stringify(node, null, 2))
        return createElement('code', { key: ++i_key_i }, `not supported node:${JSON.stringify(node, null, 2)}`)
      },
    })
    .use(rules)
    .run(ast, writer)
  // union main react elements and post processed via onEnd event
  return new Array().concat(res.interator, writer.postInterator)
}

// this is a helper function for using in unit test
export const TestPodlite = ({ children, ...options }) => {
  let podlite = podlite_core({ importPlugins: true })

  // its replace all ids with "id"
  let treeAfterParsed = frozenIds()(podlite.parse(children))

  const tree = podlite.toAst(treeAfterParsed)
  return <Podlite {...{ children, ...options, tree: { interator: tree } as PodliteExport }} />
}

export const makeTestPodlite =
  (podlite = podlite_core({ importPlugins: true })) =>
  ({ children, ...options }) => {
    let treeAfterParsed = podlite.parse(children)

    // its replace all ids with "id"
    const tree = frozenIds()(podlite.toAst(treeAfterParsed))
    return <Podlite {...{ children, ...options, tree: { interator: tree } as PodliteExport }} />
  }

export default Podlite
