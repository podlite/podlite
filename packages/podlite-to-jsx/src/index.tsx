import * as React from 'react'
import { createElement } from 'react'
import { podlite as podlite_core } from 'podlite'
import {
  Verbatim,
  PodNode,
  Text,
  Rules,
  RulesStrict,
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
  JSXHelper,
  getSafeNodeId,
  linkTarget,
  sameDocTarget,
} from '@podlite/schema'
import { Toc, Plugin, pluginCleanLocation as clean_plugin, parseOpt } from '@podlite/schema'
import {
  getExplicitNodeId,
  toFragment,
  getTextContentFromNode,
  maskText,
  collectText,
  isCovered,
  writtenValue,
  ConfigItem,
} from '@podlite/schema'
import { buildLinkPreviewIndex, LinkPreviewResolver, LinkPreviewTarget } from './link-preview'
export type { LinkPreviewResolver, LinkPreviewTarget } from './link-preview'
import { applyFoldedSections, testCaption, testFoldedByAuthor, tocTitleText } from '@podlite/schema'
import { groupTests } from './test-groups'
import { assembleIncludes } from './assemble-includes'
import { TestBlock } from './test-block'
import { readLinkConfig, codeConfigWithDefaults, mergeConfigSettings } from '@podlite/schema'
import { decodeHTMLStrict } from 'entities'
import { HighlightedCode } from '@podlite/highlight'

// interface SetFn { <T>(<T>node, ctx:any) => () => () =>void
// }
export type CreateElement = typeof React.createElement

// Client-side safety net: a crash inside one block leaves the rest of the
// page alive instead of unmounting the whole preview.
export class BlockBoundary extends React.Component<
  { blockName?: string; children?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    console.warn(`[to-jsx] block '${this.props.blockName || ''}' failed to render: ${error?.message}`)
  }
  render() {
    if (this.state.failed) {
      return <span className="podlite-render-error">[block {this.props.blockName || ''} failed to render]</span>
    }
    return this.props.children
  }
}

// the address a table of contents is given with :id, shaped as headings are
const tocAnchorOf = (node: any, ctx: any): string | undefined => {
  const written = getExplicitNodeId(node, ctx)
  return written === null ? undefined : (ctx?.__anchors?.shape || toFragment)(written)
}
const helperMakeReact = ({
  wrapElement,
  stackOf,
}: {
  wrapElement?: WrapElement
  // the files an included node came through, for a wrapper that asks
  stackOf?: (node: object) => string[] | undefined
}): JSXHelper => {
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
  return function (src, node: PodNode, children, extraProps = {}, ctx = {}) {
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
      // Skip wrapping for table-internal nodes. `row` and `cell` always
      // render as <tr> and <th>/<td>; HTML disallows arbitrary elements as
      // children of <table>/<tbody>/<tr>, and browsers extract any wrapping
      // <div> out of the table — collapsing the whole layout. Outer <table>
      // can still be wrapped for line tracking.
      const skipName = (node as { name?: string }).name
      if (skipName === 'row' || skipName === 'cell') return result
      const stack = stackOf?.(node)
      return wrapElement(node, result, stack ? { ...ctx, includeStack: stack } : ctx)
    }
    return result
  }
}

export interface WrapElement {
  (node: PodNode, children: React.ReactNode[] | React.ReactNode, ctx: any): JSX.Element
}
export const Podlite: React.FC<{
  [key: string]: any
  children?: string
  file?: string
  plugins?: any
  wrapElement?: WrapElement
  tree?: PodliteExport
  mode?: 'pod' | 'md'
  includeReader?: IncludeReader
  includeBaseDir?: string
  expandPaths?: ExpandPaths
  imageSrc?: ImageSrcResolver
  imageBaseDir?: string
  linkPreview?: LinkPreviewResolver
  renderMode?: 'production' | 'draft'
}> = ({ children, ...options }) => {
  const result: any = podlite(children, options)
  return result
}
type IncludeReader = (path: string, baseDir?: string) => string | null

type ExpandPaths = (pattern: string, baseDir?: string) => string[]

export type ImageSrcResolver = (src: string, baseDir?: string) => string | Promise<string>

type MapToReactOptions = {
  includeReader?: IncludeReader
  includeBaseDir?: string
  expandPaths?: ExpandPaths
  imageSrc?: ImageSrcResolver
  imageBaseDir?: string
  linkPreview?: LinkPreviewResolver
  parser?: any
}

export const HookedImage: React.FC<{
  src: string
  alt?: string
  hook: ImageSrcResolver
  baseDir?: string
  render?: (resolved: string) => React.ReactElement
}> = ({ src, alt, hook, baseDir, render }) => {
  const initial = React.useMemo(() => {
    const r = hook(src, baseDir)
    return typeof r === 'string' ? r : null
  }, [src, baseDir, hook])
  const [resolved, setResolved] = React.useState<string | null>(initial)
  React.useEffect(() => {
    if (initial !== null) return
    let alive = true
    Promise.resolve(hook(src, baseDir)).then(
      v => alive && setResolved(v),
      () => alive && setResolved(null),
    )
    return () => {
      alive = false
    }
  }, [src, baseDir, hook, initial])
  if (resolved == null) return null
  return render ? render(resolved) : <img src={resolved} alt={alt} />
}

// A title or a file name written on a link inside hidden content is hidden with it.
const linkConfigProps = (config: any, conceal: (text: string) => string = text => text) => {
  const { newContext, title, lang, download } = readLinkConfig(config)
  const props: { [key: string]: any } = {}
  if (newContext) props.target = '_blank'
  if (title !== undefined) props.title = conceal(title)
  if (lang !== undefined) props.hrefLang = lang
  if (download !== undefined) props.download = typeof download === 'string' ? conceal(download) : download
  return props
}

// React drops an undefined href, which is the anchor HTML gives a link whose
// target the author never wrote.
const hrefOf = (node, ctx): string | undefined => {
  const target = linkTarget(node)
  if (target === undefined) return undefined
  const address = sameDocTarget(target, ctx)
  return address === undefined ? undefined : String(address)
}

// Both link codes ask for the same index over the same document, and each rule is
// initialised separately. Keyed by the tree so the walk happens once; weak so a
// document that is done with is not held here.
const previewIndexes = new WeakMap<object, Map<string, Map<string, LinkPreviewTarget>>>()
const previewIndexFor = (tree: unknown, renderMode?: string): Map<string, LinkPreviewTarget> => {
  if (!tree || typeof tree !== 'object') return new Map()
  const mode = renderMode === 'draft' ? 'draft' : 'production'
  let byMode = previewIndexes.get(tree)
  if (!byMode) previewIndexes.set(tree, (byMode = new Map()))
  const known = byMode.get(mode)
  if (known) return known
  const built = buildLinkPreviewIndex(tree, { renderMode: mode })
  byMode.set(mode, built)
  return built
}

const previewOf = (node, ctx, index: Map<string, LinkPreviewTarget>): LinkPreviewTarget | undefined => {
  const href = hrefOf(node, ctx)
  if (href === undefined || !href.startsWith('#') || href === '#') return undefined
  return index.get(href.slice(1))
}


// the words a test is shown by are hidden with the content they stand beside
const covered = (node, ctx, text: string): string => (isCovered(node, ctx) ? maskText(text) : text)

const mapToReact = (makeComponent: JSXHelper, opts: MapToReactOptions = {}): Partial<RulesStrict> => {
  const mkComponent = src => (writer, processor) => (node, ctx, interator) => {
    // prepare extraProps for createElement
    // add id attribute if exists
    const id = getSafeNodeId(node, ctx)
    // check if node.content defined
    return makeComponent(src, node, 'content' in node ? interator(node.content, { ...ctx }) : [], { id }, ctx)
  }
  // React forbids children on void HTML elements (hr, br, img, ...)
  const mkVoidComponent = src => (writer, processor) => (node, ctx, interator) => {
    const id = getSafeNodeId(node, ctx)
    return makeComponent(src, node, undefined, { id }, ctx)
  }
  // Both link codes render the same anchor and differ only by class. The preview
  // of the target is the renderer's own behaviour until a resolver is supplied:
  // once one is, it decides alone, and returning null from it means nothing shows.
  const linkRule = (className?: string) => (writer, processor, tree) => {
    const resolver = opts.linkPreview
    // Built once per tree and mode, keyed by the tree. Memoising on the context
    // instead built it four times over: rules clone the context before recursing,
    // so links in different blocks each got their own. The mode comes with the
    // context, which is why it is looked up here. Nothing is built without a resolver.
    return (node, ctx, interator) => {
      const index = resolver ? previewIndexFor(tree, ctx?.renderMode) : undefined
      const href = hrefOf(node, ctx)
      const linkProps = linkConfigProps(codeConfigWithDefaults(node, ctx), text => covered(node, ctx, text))
      const supplied = resolver && index ? resolver(linkTarget(node) ?? '', previewOf(node, ctx, index)) : null
      const src = ({ children, key }) =>
        supplied ? (
          <React.Fragment key={key}>
            <a href={href} className={className} {...linkProps}>
              {children}
            </a>
            {supplied}
          </React.Fragment>
        ) : (
          <a href={href} key={key} className={className} {...linkProps}>
            {children}
          </a>
        )
      return mkComponent(src)(writer, processor)(node, ctx, interator)
    }
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
  // Handle :folded attribute - wraps content in collapsible <details> element
  const handleFolded = defaultHandler => {
    return (writer, processor) => {
      const defaultHandlerInited = defaultHandler(writer, processor)
      return (node, ctx, interator) => {
        const conf = makeAttrs(node, ctx)
        const folded = conf.exists('folded') ? conf.getFirstValue('folded') : null
        const caption = conf.exists('caption') ? covered(node, ctx, String(conf.getFirstValue('caption'))) : null
        const children = defaultHandlerInited(node, ctx, interator)

        // if :folded not specified - return children as is
        if (folded === null) {
          return children
        }

        // :folded or :folded(1) = collapsed by default (no open attribute)
        // :!folded or :folded(0) = expanded by default (open attribute present)
        const isExpanded = folded === false || folded === 0 || folded === '0'

        return makeComponent(
          ({ children, key }) => (
            <details className="folded" key={key} open={isExpanded || undefined}>
              {caption && <summary className="folded-summary">{caption}</summary>}
              <div className="folded-content">{children}</div>
            </details>
          ),
          node,
          children,
          {},
          ctx,
        )
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
        const folded = conf.exists('folded') ? conf.getFirstValue('folded') : null
        const caption = conf.exists('caption') ? covered(node, ctx, String(conf.getFirstValue('caption'))) : null
        const children = defaultHandlerInited(node, ctx, interator)
        // if no notify attribute - simply return children
        if (!notify) {
          return children
        }

        // Determine the title for the notification. In hidden content the kind the
        // author wrote is hidden with the rest, in the title and in the class.
        const hidden = isCovered(node, ctx)
        const title = caption || covered(node, ctx, notify.charAt(0).toUpperCase() + notify.slice(1))
        const kind = hidden ? '' : ` ${notify.toLowerCase()}`

        // :folded or :folded(1) = collapsed by default
        // :!folded or :folded(0) = expanded by default
        const isExpanded = folded === false || folded === 0 || folded === '0'

        // If :folded is specified, wrap in <details>
        if (folded !== null) {
          return makeComponent(
            ({ children, key }) => (
              <details className={`notify${kind} folded`} key={key} open={isExpanded || undefined}>
                <summary className="notify-title">{title}</summary>
                <div className="folded-content">{children}</div>
              </details>
            ),
            node,
            children,
            {},
            ctx,
          )
        }

        // Default rendering without folding
        return makeComponent(
          ({ children, key }) => (
            <aside className={`notify${kind}`} key={key}>
              <p className="notify-title">{title}</p>
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
    pod: (writer, processor) => (node, ctx, interator) => {
      const id = getSafeNodeId(node, ctx)
      return makeComponent('div', node, interator(node.content, { ...ctx }), { id }, ctx)
    },
    _folded_section: (writer, processor) => (node: any, ctx, interator) => {
      const [heading, ...rest] = node.content as any[]
      const isExpanded = node.foldedState === false || node.foldedState === 0 || node.foldedState === '0'
      const headingJsx = interator([heading], { ...ctx })
      const bodyJsx = interator(rest, { ...ctx })
      const key = getSafeNodeId(node, ctx)
      return (
        <details className="folded-section" key={key} open={isExpanded || undefined}>
          <summary className="folded-section-summary">{headingJsx}</summary>
          <div className="folded-section-content">{bodyJsx}</div>
        </details>
      )
    },
    root: nodeContent,
    data: emptyContent(),
    ':ambient': emptyContent(),
    ':code': setFn((node, ctx) => {
      const id = getSafeNodeId(node, ctx)
      return mkComponent(({ children, key }) => (
        <HighlightedCode node={node} ctx={ctx} keyProp={key} id={id} wrap="pre-code">
          {children}
        </HighlightedCode>
      ))
    }),
    code: setFn((node, ctx) => {
      const id = getSafeNodeId(node, ctx)
      return mkComponent(({ children, key }) => (
        <HighlightedCode node={node} ctx={ctx} keyProp={key} id={id} wrap="block">
          {children}
        </HighlightedCode>
      ))
    }),
    image: nodeContent,
    ':image': setFn((node, ctx) => {
      const hook = opts.imageSrc
      const written = writtenValue(node.alt)
      const alt = written === undefined ? undefined : covered(node, ctx, written)
      if (hook) {
        return mkComponent(({ key }) => (
          <HookedImage key={key} src={node.src} alt={alt} hook={hook} baseDir={opts.imageBaseDir} />
        ))
      }
      return mkComponent(({ children, key }) => <img key={key} src={node.src} alt={alt} />)
    }),

    ':text': (writer, processor) => (node: Text, ctx, interator) => {
      return isCovered(node, ctx) ? maskText(node.value) : node.value
    },
    ':verbatim': (writer, processor) => (node: Verbatim, ctx, interator) => {
      return isCovered(node, ctx) ? maskText(node.value) : node.value
    },
    'head:block': subUse(
      {
        // inside head don't wrap into <p>
        ':para': nodeContent,
      },
      setFn((node, ctx) => {
        const { level } = node
        // TODO: refactor linking for blocks
        const id = getSafeNodeId(node, ctx)
        const numberPrefix = node.numberPrefix
        return mkComponent(({ level, children, key }) =>
          createElement(
            `h${level}`,
            { key, id },
            numberPrefix
              ? [createElement('span', { key: `${key}-num`, className: 'head-number' }, numberPrefix), ' ', children]
              : children,
          ),
        )
      }),
    ),

    ':blankline': emptyContent(),
    ':para': mkComponent('p'),
    para: handleNested(mkComponent('div')),
    'comment:block': emptyContent(),
    _test_group: (writer, processor) => (node: any, ctx, interator) =>
      (
        <div className="test-group" key={getSafeNodeId(node, ctx)}>
          {interator(node.content, { ...ctx })}
        </div>
      ),
    'test:block': setFn((node, ctx) => {
      const id = getSafeNodeId(node, ctx)
      const caption = covered(node, ctx, testCaption(node, ctx))
      const folded = testFoldedByAuthor(node, ctx)
      return mkComponent(({ children, key }) => (
        <TestBlock key={key} id={id} caption={caption} folded={folded}>
          {children}
        </TestBlock>
      ))
    }),
    'fixture:block': mkComponent(({ children, key }) => (
      <div className="test-fixture" key={key}>
        <pre>
          <code>{children}</code>
        </pre>
      </div>
    )),
    'assert:block': setFn((node, ctx) => {
      const conf = makeAttrs(node, ctx)
      const absent = conf.exists('absent') && Boolean(conf.getFirstValue('absent'))
      const caption = conf.exists('caption') ? covered(node, ctx, String(conf.getFirstValue('caption'))) : null
      return mkComponent(({ children, key }) => (
        <div className={absent ? 'test-assert test-absent' : 'test-assert'} key={key}>
          <code className="test-selector">{children}</code>{' '}
          <span className="test-expect">{absent ? 'must find no block' : 'must find a block'}</span>
          {caption !== null && (
            <>
              {': '}
              <span className="test-assert-caption">{caption}</span>
            </>
          )}
        </div>
      ))
    }),
    'resource:block': setFn((node, ctx) => {
      const conf = makeAttrs(node, ctx)
      const name = conf.exists('name') ? covered(node, ctx, String(conf.getFirstValue('name'))) : null
      return mkComponent(({ children, key }) => (
        <div className="test-resource" key={key}>
          {name !== null && <span className="test-resource-name">{name}</span>}
          <pre>
            <code>{children}</code>
          </pre>
        </div>
      ))
    }),
    'boundary:block': mkVoidComponent('hr'),
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
    // Includes are read before rendering (assemble-includes.ts). Without a
    // reader the directive renders as nothing, as it did before, for hosts that
    // supply no file access.
    include: (writer, processor) => (node, ctx, interator) => {
      // with a reader the document was assembled before rendering, and an
      // include still here is one that did not resolve: it was reported then
      if (opts.includeReader && opts.parser) return null
      const set: ConfigItem[] = (node as any).set || []
      if (set.length) {
        console.warn(
          `[to-jsx] include is not read without a file reader; =set assignments not applied: ${set
            .map(c => c.name)
            .join(', ')}`,
        )
      }
      return null
    },

    // Directives
    ':config': setFn((node, ctx) => {
      // setup context
      if (!ctx.hasOwnProperty('config')) ctx.config = {}
      //collect configs in context
      ctx.config[node.name] = mergeConfigSettings(node.config, ctx.config[node.name])
      return emptyContent()
    }),
    ':alias': setFn((node, ctx) => {
      // set alias
      if (!ctx.hasOwnProperty('alias')) ctx.alias = {}
      //collect configs in context
      ctx.alias[node.name] = node.replacement
      return emptyContent()
    }),

    // Markup codes
    'A<>': (writer, processor) => (node, ctx, interator) => {
      let term = node.content

      let termString: string
      if (typeof term === 'string') {
        termString = term
      } else if (term && 'value' in term) {
        termString = term.value as string
      } else {
        termString = ''
      }
      termString = termString.trim()
      //get replacement text
      if (!(ctx.alias && ctx.alias.hasOwnProperty(termString))) {
        return makeComponent(
          ({ children, key }) => <code key={key}>A&lt;{children}&gt;</code>,
          node,
          interator(node.content, ctx),
        )
      } else {
        const src = termString && ctx.alias[termString].join('\n')
        const tree_1 = processor(src)
        // now clean locations
        const tree = clean_plugin()(tree_1)
        if (tree[0]?.type === 'para') {
          return interator(tree[0].content, ctx)
        } else {
          return interator(tree, ctx)
        }
      }
    },
    'B<>': mkComponent('strong'),
    'C<>': mkComponent('code'),
    'E<>': (writer, processor) => (node, ctx, interator) => {
      if ('content' in node && Array.isArray(node.content)) {
        const decoded = node.content
          .filter(Boolean)
          .map(element => {
            if (typeof element == 'string') {
              return element
            }
            if (element.type == 'number' && 'value' in element) {
              return String.fromCharCode(element.value)
            }
            if (element.type == 'html_named' && 'value' in element) {
              return decodeHTMLStrict(`&${element.value};`)
            }
            if (element.type == 'text' && 'value' in element) {
              return element.value
            }
            console.warn(`[jsx] E<> unsupported or unknown element type: ${element.type}`)
            return ''
          })
          .join('')
        return covered(node, ctx, decoded)
      }
    },
    'H<>': mkComponent('sup'),
    'I<>': mkComponent('i'),
    'J<>': mkComponent('sub'),
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
          [],
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
          [],
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
    'L<>': linkRule(),
    'W<>': linkRule('backlink'),
    'S<>': (writer, processor) => (node, ctx, interator) => {
      let content = node.content || ''
      if (typeof content !== 'string' && 'value' in content) {
        content = content.value
      }
      content = covered(node, ctx, String(content))
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
    'O<>': mkComponent('del'),
    'G<>': (_writer, _processor) => (node, ctx, interator) => {
      if (ctx.renderMode === 'draft') {
        return makeComponent(
          ({ key, children }) => (
            <span key={key} className="masked-draft">
              {children}
            </span>
          ),
          node,
          interator(node.content, ctx),
        )
      }
      const masked = maskText(collectText(node.content))
      return makeComponent(
        ({ key }) => (
          <span key={key} className="masked">
            {masked}
          </span>
        ),
        node,
        [],
      )
    },
    // table section
    table: (writer, processor) => (node, ctx, interator) => {
      const conf = makeAttrs(node, ctx)
      const caption = conf.exists('caption') ? covered(node, ctx, String(conf.getFirstValue('caption'))) : ''
      const folded = conf.exists('folded') ? conf.getFirstValue('folded') : null

      if (typeof node === 'string') {
        return node
      }
      if (!('content' in node)) {
        console.warn('[jsx] no content in node')
        return ''
      }
      const id = getSafeNodeId(node, ctx)

      // :folded or :folded(1) = collapsed by default
      // :!folded or :folded(0) = expanded by default
      const isExpanded = folded === false || folded === 0 || folded === '0'

      const tableCtx = { ...ctx, ...(node.align && { 'table.align': node.align }) }
      const content: any[] = (node as any).content || []
      const isHeaderRow = (c: any) =>
        c &&
        c.name === 'row' &&
        Array.isArray(c.config) &&
        c.config.some((a: any) => a.name === 'header' && a.value !== false)
      const hasHeader = content.some(isHeaderRow)

      let renderTable: (extraKey: string | number) => JSX.Element
      if (!hasHeader) {
        const rendered = interator(content, tableCtx)
        renderTable = extraKey => (
          <table key={extraKey} id={id}>
            {caption ? <caption className="caption">{caption}</caption> : null}
            <tbody>{rendered}</tbody>
          </table>
        )
      } else {
        const rowNodes = content.filter((c: any) => c && c.name === 'row')
        const nonRowContent = content.filter((c: any) => !c || c.name !== 'row')
        let headerEnd = 0
        while (headerEnd < rowNodes.length && isHeaderRow(rowNodes[headerEnd])) headerEnd++
        const headerRows = rowNodes.slice(0, headerEnd)
        const bodyRows = rowNodes.slice(headerEnd)
        const nonRowRendered = interator(nonRowContent, tableCtx)
        const headerRendered = interator(headerRows, tableCtx)
        const bodyRendered = bodyRows.length > 0 ? interator(bodyRows, tableCtx) : null
        renderTable = extraKey => (
          <table key={extraKey} id={id}>
            {caption ? <caption className="caption">{caption}</caption> : null}
            {nonRowRendered}
            <thead>{headerRendered}</thead>
            {bodyRendered ? <tbody>{bodyRendered}</tbody> : null}
          </table>
        )
      }

      // If :folded is specified, wrap table in <details>
      if (folded !== null) {
        return makeComponent(
          ({ key }) => (
            <details className="folded table-folded" key={key} open={isExpanded || undefined}>
              {caption && <summary className="folded-summary">{caption}</summary>}
              <div className="folded-content">{renderTable(`${key}-table`)}</div>
            </details>
          ),
          node,
          [],
        )
      }

      return makeComponent(({ key }) => renderTable(key), node, [])
    },
    ':separator': emptyContent(),
    row: setFn((node, ctx) => {
      const conf = makeAttrs(node, ctx)
      const isHeader = conf.exists('header') && conf.getFirstValue('header') !== false
      ctx.__row_header = isHeader
      if (ctx['table.align']) ctx['cellinRow'] = 0
      return mkComponent(({ children, key }) => <tr key={key}>{children}</tr>)
    }),
    cell: setFn((node, ctx) => {
      const colAlign = (alignMap => {
        if (!Array.isArray(alignMap)) return null
        const num = ctx['cellinRow']++
        return alignMap[num] || null
      })(ctx['table.align'])
      const isHeader = ctx.__row_header
      const conf = makeAttrs(node, ctx)
      const colSpanRaw = conf.exists('colspan') ? Number(conf.getFirstValue('colspan')) : 0
      const rowSpanRaw = conf.exists('rowspan') ? Number(conf.getFirstValue('rowspan')) : 0
      const colSpan = colSpanRaw > 1 ? colSpanRaw : undefined
      const rowSpan = rowSpanRaw > 1 ? rowSpanRaw : undefined
      const style =
        colAlign && ['left', 'right', 'center', 'justify'].includes(colAlign)
          ? { textAlign: colAlign as 'left' | 'right' | 'center' | 'justify' }
          : undefined
      return mkComponent(({ children, key }) =>
        isHeader ? (
          <th key={key} colSpan={colSpan} rowSpan={rowSpan} style={style}>
            {children}
          </th>
        ) : (
          <td key={key} colSpan={colSpan} rowSpan={rowSpan} style={style}>
            {children}
          </td>
        ),
      )
    }),
    ':list': setFn((node, ctx) =>
      node.list === 'ordered'
        ? mkComponent('ol')
        : node.list === 'variable'
        ? mkComponent('dl')
        : node.list === 'task'
        ? mkComponent(({ children, key }) => (
            <ul className="task-list" key={key}>
              {children}
            </ul>
          ))
        : mkComponent('ul'),
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
      const id = getSafeNodeId(node, ctx)
      const isTask = node.checked !== undefined

      if (isTask) {
        const checkbox = <input key="checkbox" type="checkbox" disabled checked={node.checked || undefined} />
        const content = interator(node.content, { ...ctx })
        return makeComponent('li', node, [checkbox, ...[].concat(content)], { id, className: 'task-list-item' })
      }

      return makeComponent('li', node, interator(node.content, { ...ctx }), { id })
    },
    // table of content: the directive holds the table it made, and gives it its :id
    'toc:block': (writer, processor) => (node: any, ctx, interator) =>
      interator(node.content, { ...ctx, tocAnchor: tocAnchorOf(node, ctx) }),
    'Toc:block': (writer, processor) => (node: any, ctx, interator) =>
      interator(node.content, { ...ctx, tocAnchor: tocAnchorOf(node, ctx) }),
    ':toc': (writer, processor) => (node: Toc, ctx, interator) => {
      const tocAnchor = ctx.tocAnchor || undefined
      if (node.foldedLevels) {
        ctx._tocFoldedLevels = node.foldedLevels
      }
      const tocTitle = node.caption ? interator(node.caption.content, { ...ctx }) : tocTitleText(node, ctx)
      const folded = node.folded
      if (folded !== undefined) {
        const isExpanded = folded === false
        return mkComponent(({ children, key }) => (
          <details className="toc toc-fold-all" id={tocAnchor} key={key} open={isExpanded || undefined}>
            <summary className="toctitle">{tocTitle || 'Contents'}</summary>
            {children}
          </details>
        ))(writer, processor)(node, ctx, interator)
      }
      return mkComponent(({ children, key }) => (
        <div className="toc" id={tocAnchor} key={key}>
          {tocTitle ? <div className="toctitle">{tocTitle}</div> : ''}
          {children}
        </div>
      ))(writer, processor)(node, ctx, interator)
    },
    ':toc-list': (writer, processor) => (node: any, ctx: any, interator: any) => {
      const level = node.level
      const foldedLevels = ctx._tocFoldedLevels as Record<number, boolean> | undefined
      const content: any[] = Array.isArray(node.content) ? node.content : []
      const key = getSafeNodeId(node, ctx)
      const shouldFold = foldedLevels ? foldedLevels[level] === true : false

      if (!shouldFold) {
        return (
          <ul className={`toc-list listlevel${level}`} key={key}>
            {interator(content, { ...ctx })}
          </ul>
        )
      }

      // Per-item conditional fold: a toc-item becomes a disclosure only when it
      // is immediately followed by a nested toc-list (i.e. has sub-headings).
      // Leaf items render as plain <li> without a fold marker. Summary contains
      // the rendered link of the item itself — no duplication, no bare triangle.
      const rendered: any[] = []
      let i = 0
      while (i < content.length) {
        const it = content[i]
        const next = content[i + 1]
        const isItem = it && it.type === 'toc-item'
        const hasChildren = next && next.type === 'toc-list'

        if (isItem && hasChildren) {
          // Extract inline content of the item's heading para (skip the <p>
          // wrapper) so the link renders on the same line as the disclosure
          // triangle. `it.node` is the para built by podlite-toc; its content
          // is the L<> fcode + text.
          const innerContent = it.node && Array.isArray(it.node.content) ? it.node.content : it.content
          const itemLinkJsx = interator(innerContent, { ...ctx })
          const childrenJsx = interator([next], { ...ctx })
          rendered.push(
            <li className="toc-item toc-item-foldable" key={`${key}-fold-${i}`}>
              <details className="toc-fold">
                <summary className={`toc-list-summary listlevel${level}`}>{itemLinkJsx}</summary>
                {childrenJsx}
              </details>
            </li>,
          )
          i += 2
          continue
        }

        rendered.push(interator([it], { ...ctx }))
        i++
      }

      return (
        <ul className={`toc-list listlevel${level}`} key={key}>
          {rendered}
        </ul>
      )
    },
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
  } as unknown as Partial<RulesStrict>
}
function podlite(
  children: string,
  {
    file,
    plugins = () => {},
    wrapElement,
    tree,
    mode = 'pod',
    includeReader,
    includeBaseDir,
    expandPaths,
    imageSrc,
    imageBaseDir,
    linkPreview,
    renderMode = 'production',
  }: {
    file?: string
    plugins?: any
    wrapElement?: WrapElement
    tree?: PodliteExport
    mode?: 'pod' | 'md'
    includeReader?: IncludeReader
    includeBaseDir?: string
    expandPaths?: ExpandPaths
    imageSrc?: ImageSrcResolver
    imageBaseDir?: string
    linkPreview?: LinkPreviewResolver
    renderMode?: 'production' | 'draft'
  },
  ...args
) {
  const podliteParser = podlite_core({ importPlugins: true })
  const astRaw = (tree => {
    if (tree) return tree.interator
    const parseOptions: parseOpt = mode === 'md' ? { mode: 'md' } : { podMode: 1 }
    const treeAfterParsed = podliteParser.parse(children || file, parseOptions)
    return podliteParser.toAst(treeAfterParsed)
  })(tree)
  const folded = applyFoldedSections(astRaw)
  // included blocks take the place of the directive before anything reads the tree
  const assembly = includeReader
    ? assembleIncludes(folded, { includeReader, includeBaseDir, expandPaths, parser: podliteParser })
    : undefined
  const stacks = assembly?.stacks
  const ast = groupTests(
    assembly ? assembly.tree : folded,
    stacks
      ? (from, to) => {
          const stack = stacks.get(from)
          if (stack && !stacks.has(to)) stacks.set(to, stack)
        }
      : undefined,
  )

  // const   ast = parse( children || content )
  let i_key_i = 10000
  const makeComponent = helperMakeReact({ wrapElement, stackOf: stacks ? node => stacks.get(node) : undefined })

  const jsxPlugins: { [name: string]: Plugin['toJSX'] } = toAnyRules('toJSX', podliteParser.getPlugins())
  // initialize each plugin
  const jsxPluginInited = Object.fromEntries(
    Object.entries(jsxPlugins).map(([key, value]) => [key, value(makeComponent)]),
  )

  const rules: Rules = {
    ...mapToReact(makeComponent, {
      includeReader,
      includeBaseDir,
      expandPaths,
      imageSrc,
      imageBaseDir,
      linkPreview,
      parser: podliteParser,
    }),
    ...plugins(makeComponent),
    ...jsxPluginInited,
  }
  interface WriterPostinterator extends Writer {
    postInterator?: any
  }
  const writer = new Writer(s => {}) as WriterPostinterator
  const res = toAny({ processor: parse, context: { renderMode, imageSrc, imageBaseDir } })
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
                    {covered(node, ctx, String(node.name))}
                  </h1>
                  {interator(node.content, { ...ctx })}
                </div>
              )
            },
            node,
            interator(node.content, { ...ctx }),
          )
        }
        console.warn('[to-jsx] Not supported: ' + JSON.stringify(node, null, 2))
        return createElement('code', { key: ++i_key_i }, `not supported node:${JSON.stringify(node, null, 2)}`)
      },
    })
    .use(rules)
    .use('*', (writer, processor) => (node, ctx, interator, defaultFn) => {
      // defaultFn chains to a single next rule, so masking and the render
      // safety net share this one wildcard hook
      const dispatch = () => {
        if (!node) return defaultFn()
        if (ctx?.maskMode) return defaultFn()
        if (ctx?.renderMode === 'draft') return defaultFn()
        if (node.guarded) return defaultFn(node, { ...(ctx || {}), maskMode: true }, interator)
        if (node.type !== 'block') return defaultFn()
        const conf = makeAttrs(node, ctx || {})
        if (!conf.exists('masked') || !conf.getFirstValue('masked')) return defaultFn()
        return defaultFn(node, { ...(ctx || {}), maskMode: true }, interator)
      }
      const blockName = node && typeof node === 'object' ? node.name || node.type : undefined
      let result
      try {
        result = dispatch()
      } catch (error) {
        console.warn(`[to-jsx] block '${blockName || ''}' failed to render: ${error?.message}`)
        return createElement(
          'span',
          { key: ++i_key_i, className: 'podlite-render-error' },
          `[block ${blockName || ''} failed to render]`,
        )
      }
      if (node && typeof node === 'object' && node.type === 'block' && React.isValidElement(result)) {
        return createElement(BlockBoundary, { key: ++i_key_i, blockName }, result)
      }
      return result
    })
    .run(ast, writer)
  // union main react elements and post processed via onEnd event
  return new Array().concat(res.interator, writer.postInterator)
}

// this is a helper function for using in unit test
export const TestPodlite = ({ children, ...options }) => {
  let podlite = podlite_core({ importPlugins: true })

  // its replace all ids with "id"
  const tree = frozenIds()(podlite.toAst(podlite.parse(children)))
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
