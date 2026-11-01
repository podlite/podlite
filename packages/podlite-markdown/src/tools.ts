import { unified } from 'unified'
import markdown from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import {
  toAny,
  AstTree,
  BlockImage,
  mkBlock,
  mkFomattingCode,
  mkFomattingCodeL,
  mkVerbatim,
  Location,
  mkMarkupCodeF,
  mkFormulaBlock,
  parseAttributes,
  headingId,
  getTextContentFromNode,
} from '@podlite/schema'
import { mkRootBlock } from '@podlite/schema'
import { assignHeadingKeys } from '@podlite/schema'
import { mkImage } from '@podlite/schema'
import { mkFomattingCodeO } from '@podlite/schema'

type Md2astArgs = { lineOffset?: number }
export const md2ast = (src: string, { lineOffset }: Md2astArgs = { lineOffset: 0 }): AstTree => {
  // first convert mardown to ast
  const md_tree = unified().use(markdown).use(remarkGfm).use(remarkMath).parse(src)

  // first pass : collect linkRefs
  let definitionMap = {}
  const applyLineOffset = (
    (offset: number) =>
    (location: Location): Location => {
      const { start, end } = location
      return {
        start: {
          ...start,
          line: start.line + offset,
        },
        end: {
          ...end,
          line: end.line + offset,
        },
      }
    }
  )(lineOffset)
  toAny({ processor: 1 })
    .use({
      '*:*': (writer, processor) => (node, ctx, interator) => {
        if (node.children) interator(node.children, { ...ctx })
      },
    })
    .use({
      ':definition': (writer, processor) => (node, ctx, interator) => {
        definitionMap[node.identifier] = node
      },
    })
    .run(md_tree)

  // HTML stands for a part of a line inside a paragraph, a heading, a cell or a span,
  // and for a block anywhere else: the parent each piece of HTML has here is kept
  const htmlParents = new WeakMap<object, string>()
  const recordParents = (node: { type?: string; children?: any[] }): void =>
    (node.children || []).forEach(child => {
      if (child?.type === 'html') htmlParents.set(child, node.type || '')
      recordParents(child)
    })
  recordParents(md_tree)

  // second stage - make Universal AST nodes
  const uast = []
  const res = toAny({ processor: 1 })
    .use({
      '*:*': (writer, processor) => (node, ctx, interator) => {
        console.warn('[Podlite:md2ast]- unhandled MD node')
        console.warn(JSON.stringify(node, null, 2))
        if (node.children) interator(node.children, { ...ctx })
      },
    })
    .use({
      ':root': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkRootBlock({}, interator(children, ctx))
      },
      ':math': (writer, processor) => (node, ctx, interator) => {
        const { value, children, position, ...attr } = node
        return mkFormulaBlock({ value, location: applyLineOffset(position) })
      },
      ':inlineMath': (writer, processor) => (node, ctx, interator) => {
        const { value, children, position, ...attr } = node
        return mkMarkupCodeF(value)
      },

      ':heading': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        const block = mkBlock(
          { type: 'block', level: node.depth, name: 'head', location: applyLineOffset(position) },
          interator(children, ctx),
        )
        // a link to a heading is written against its text, so a generated id points at nothing
        const id = headingId(getTextContentFromNode(block))
        // a heading holding only an image has no text to be named by, and an empty id would
        // repeat across every such heading
        return id ? { ...block, id } : block
      },
      ':text': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return node.value
        // return mkNode({type:"text", value: node.value})
      },
      ':list': (writer, processor) => (node, ctx, interator) => {
        const savedListLevel = ctx['listLevel'] || 0
        const { children, position, ...attr } = node
        return mkBlock(
          { type: 'list', level: savedListLevel + 1, list: node.ordered ? 'ordered' : 'itemized' },
          interator(children, { ...ctx, listLevel: savedListLevel + 1, ordered: node.ordered }),
        )
      },
      ':listItem': (writer, processor) => (node, ctx, interator) => {
        const savedListLevel = ctx['listLevel'] || 0
        const { children, position, checked, ...attr } = node
        const blockAttrs: any = {
          name: 'item',
          type: 'block',
          level: ctx['listLevel'],
          location: applyLineOffset(position),
        }

        if (checked !== null && checked !== undefined) {
          blockAttrs.checked = checked
          blockAttrs.config = [{ name: 'checked', value: checked, type: 'boolean' }]
        }

        return mkBlock(blockAttrs, interator(children, { ...ctx, listLevel: savedListLevel, ordered: node.ordered }))
      },
      ':paragraph': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkBlock(
          { type: 'para', location: applyLineOffset(position), text: 'text', margin: '' },
          interator(children, { ...ctx }),
        )
      },
      ':linkReference': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        const definition = definitionMap[attr.identifier]
        const meta = definition?.url || ''
        return mkFomattingCodeL({ meta }, interator(children, { ...ctx }))
      },
      ':definition': (writer, processor) => (node, ctx, interator) => {
        return null
      },
      ':inlineCode': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkFomattingCode({ name: 'C' }, [node.value])
      },
      ':strong': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkFomattingCode({ name: 'B' }, interator(children, { ...ctx }))
      },
      ':emphasis': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkFomattingCode({ name: 'I' }, interator(children, { ...ctx }))
      },
      ':link': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkFomattingCodeL({ meta: node.url }, interator(children, { ...ctx }))
      },
      ':html': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        const markdownHtml = inlineParents.includes(htmlParents.get(node)) ? 'inline' : 'block'
        return mkBlock({ type: 'block', name: 'Html', markdownHtml, location: applyLineOffset(position) }, [
          mkVerbatim(node.value),
        ])
      },
      ':code': (writer, processor) => (node, ctx, interator) => {
        const { children, position, lang, meta, ...attr } = node
        if (lang === 'mermaid' || lang === 'diagram') {
          return mkBlock({ type: 'block', name: 'Mermaid', config: [], location: applyLineOffset(position) }, [
            mkVerbatim(node.value),
          ])
        }
        let config = []
        if (lang) {
          config.push({ name: 'lang', value: lang, type: 'string' })
        }
        if (meta) {
          config.push(...parseAttributes(meta))
        }
        return mkBlock({ type: 'block', name: 'code', config, location: applyLineOffset(position) }, [
          mkVerbatim(node.value),
        ])
      },
      ':image':
        (writer, processor) =>
        (node, ctx, interator): BlockImage => {
          const { title, alt, url, position, ...attr } = node
          let config = []
          // the title of a picture is the hint a reader shows over it, not a caption
          const image = mkImage(url, alt)
          if (typeof title === 'string') image.title = title
          return mkBlock({ type: 'block', name: 'Image', config, location: applyLineOffset(position) }, [image])
        },
      // a rule between blocks is the boundary of Podlite
      ':thematicBreak': (writer, processor) => (node, ctx, interator) => {
        const { position } = node
        return mkBlock({ type: 'block', name: 'boundary', config: [], location: applyLineOffset(position) }, [])
      },
      ':blockquote': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkBlock({ name: 'nested', location: applyLineOffset(position) }, interator(children, { ...ctx }))
      },
      //table section
      ':table': (writer, processor) => (node, ctx, interator) => {
        const { children, position, align, ...attr } = node
        return mkBlock(
          { name: 'table', location: applyLineOffset(position), align },
          interator(children, { ...ctx, isHeaderUsed: 0 }),
        )
      },
      ':tableRow': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        const isHeaderUsed = ctx.isHeaderUsed++
        const blockAttrs: Record<string, unknown> = {
          name: 'row',
          location: applyLineOffset(position),
        }
        if (!isHeaderUsed) {
          blockAttrs.config = [{ name: 'header', value: true, type: 'boolean' }]
        }
        return mkBlock(blockAttrs, interator(children, { ...ctx }))
      },
      ':tableCell': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkBlock({ name: 'cell', location: applyLineOffset(position) }, interator(children, { ...ctx }))
      },
      ':delete': (writer, processor) => (node, ctx, interator) => {
        const { children, position, ...attr } = node
        return mkFomattingCodeO(interator(children, { ...ctx }))
      },
      // a hard line break is a line break S<> keeps
      ':break': (writer, processor) => (node, ctx, interator) => {
        return mkFomattingCode({ name: 'S' }, ['\n'])
      },
    })
    .run(md_tree)
  // a =markdown block hands over its verbatim node: the keys are fingerprinted from the
  // text the reader parsed
  const tree = assignHeadingKeys(
    res.interator,
    typeof src === 'string' ? src : (src as { value?: string })?.value ?? '',
  )
  markSource(tree)
  return tree
}

const inlineParents = ['paragraph', 'heading', 'tableCell', 'strong', 'emphasis', 'delete', 'link', 'linkReference']

// Every block made here is marked as coming from Markdown: HTML of Markdown is a block
// named Html as an author's =Html is, and a writer must keep the first raw.
// The walk goes into every node, since HTML stands in paragraphs, lists and codes too.
const markSource = (node: unknown): void => {
  if (Array.isArray(node)) return node.forEach(markSource)
  if (!node || typeof node !== 'object') return
  const item = node as { type?: string; content?: unknown; sourceFormat?: string }
  if (item.type === 'block') item.sourceFormat = 'markdown'
  if (item.content) markSource(item.content)
}
