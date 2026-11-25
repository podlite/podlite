import React from 'react'
import {
  getExplicitNodeId,
  getNodeId,
  mkCaption,
  mkImage,
  Plugin,
  Plugins,
  PodNode,
  Image,
  makeAttrs,
  subUse,
  setFn,
  wrapContent,
  parseFormattingCodes,
  quoteAttribute,
  writtenValue,
  isCovered,
  maskText,
  toFragment,
  imageAddress,
  isDataAddress,
} from '@podlite/schema'

type ImageSrcResolver = (src: string, baseDir?: string) => string | Promise<string>

const HookedImage: React.FC<{
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
// one =set gave holds its codes already, one written as an attribute is text,
// and the text under the source line reads codes
const captionOf = (
  node: { caption?: PodNode },
  conf: ReturnType<typeof makeAttrs>,
  captionText: string,
): PodNode | undefined => {
  if (node.caption) return node.caption
  if (conf.exists('caption')) {
    const written = String(conf.getFirstValue('caption') ?? '')
    return written ? mkCaption([{ type: 'text', value: written }]) : undefined
  }
  return captionText ? mkCaption(parseFormattingCodes(captionText, {})) : undefined
}

// blank is what the norm calls it, horizontal whitespace only (\h), with \r left by CRLF line ends
const blank = /^[\t\r \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]*$/

// The body of a picture is its caption, read as written. A body of several paragraphs
// keeps them apart; one of a single paragraph stays the run of text it always was.
const bodyCaption = (text: string): PodNode | undefined => {
  const paragraphs: string[][] = [[]]
  for (const line of text.split('\n')) {
    if (!blank.test(line)) paragraphs[paragraphs.length - 1].push(line)
    else if (paragraphs[paragraphs.length - 1].length > 0) paragraphs.push([])
  }
  const written = paragraphs.filter(lines => lines.length > 0)
  if (written.length === 0) return undefined
  if (written.length === 1) return mkCaption(parseFormattingCodes(text, {}))
  return mkCaption(written.map(lines => ({ type: 'para', content: parseFormattingCodes(lines.join('\n'), {}) })))
}

// =picture takes its source only from :src, and its whole body is the caption; a
// written body goes ahead of :caption, which stays the title of the block
const picture = (node, ctx) => {
  const conf = makeAttrs(node, ctx)
  const body = node.content
    .map(part => (part && typeof part === 'object' && 'value' in part ? part.value : ''))
    .join('')
  const src = conf.exists('src') ? conf.getFirstValue('src') : undefined
  const content: Array<PodNode> = []
  if (typeof src === 'string' && src !== '')
    content.push(
      mkImage(
        src,
        conf.exists('alt') ? conf.getFirstValue('alt') : undefined,
        conf.exists('link') ? conf.getFirstValue('link') : undefined,
      ),
    )
  const caption = bodyCaption(body) ?? captionOf(node, conf, '')
  if (caption) content.push(caption)
  return { ...node, content }
}

const Image: Plugin = {
  toAst: (_, processor) => (node, ctx) => {
    if (typeof node !== 'string' && 'type' in node && 'content' in node && node.type === 'block') {
      const content = node.content[0]
      if (content && typeof content !== 'string' && (content.type === 'image' || content.name === 'caption')) {
        return node
      }
      if (node.name === 'picture') return picture(node, ctx)
      // =Image is no block of the norm and keeps its reading: the first non-blank line is the source
      if (content && typeof content !== 'string' && 'location' in node && 'value' in content) {
        // get src and alt text
        const lines = content.value.split('\n')
        const first = lines.findIndex(line => !blank.test(line))
        const [data, ...caption] = first < 0 ? lines : lines.slice(first)
        const captionText = caption.join('\n')
        const altRegexp = /\s*((?<altText>.+)\s+)?(?<src>[^\s]+)/
        const { altText, src } = (data.match(altRegexp) || { groups: { altText: undefined, src: undefined } }).groups
        const conf = makeAttrs(node, ctx)
        // make  inline image
        const imageSrc = conf.exists('src') ? conf.getFirstValue('src') : src
        const imageAlt = conf.exists('alt') ? conf.getFirstValue('alt') : altText
        // The link belongs to this block. Taken from the context it outlived the
        // node and reached every image below that had none of its own.
        const imageLink = conf.exists('link') ? conf.getFirstValue('link') : undefined
        const resultContent: Array<PodNode> = [mkImage(imageSrc, imageAlt, imageLink)]
        const made = captionOf(node, conf, captionText)
        if (made) resultContent.push(made)

        return { ...node, content: resultContent /* content_: node.content */ }
      }
      // a block with no content takes its source from :src
      if (!content) {
        const conf = makeAttrs(node, ctx)
        if (!conf.exists('src')) return node
        const image = mkImage(
          conf.getFirstValue('src'),
          conf.exists('alt') ? conf.getFirstValue('alt') : undefined,
          conf.exists('link') ? conf.getFirstValue('link') : undefined,
        )
        const caption = captionOf(node, conf, '')
        return { ...node, content: caption ? [image, caption] : [image] }
      }
      return node
    }
  },
  toHtml: subUse(
    {
      // inside head don't wrap into <p>
      ':image': setFn((node, ctx) => {
        return writer => node => {
          const linkTo = node.link
          if (linkTo) {
            writer.writeRaw('<a href="')
            writer.write(linkTo)
            writer.writeRaw('">')
          }
          // html reads a missing alt as "this image is part of the content" and an
          // empty one as "decorative", so an alternative text the author never
          // wrote is left out
          const altText = writtenValue(node.alt)
          const shown = altText !== undefined && isCovered(node, ctx) ? maskText(altText) : altText
          const alt = shown === undefined ? '' : ` alt="${quoteAttribute(shown)}"`
          const hint =
            typeof node.title === 'string' ? (isCovered(node, ctx) ? maskText(node.title) : node.title) : undefined
          const title = hint === undefined ? '' : ` title="${quoteAttribute(hint)}"`
          writer.writeRaw(`<img src="${quoteAttribute(String(imageAddress(node, ctx) ?? ''))}"${alt}${title}/>`)
          if (linkTo) {
            writer.writeRaw('</a>')
          }
        }
      }),
      caption: wrapContent('<div class="caption">', '</div>'),
    },
    setFn((node, ctx) => {
      // html carries only the id the author wrote, in the form a link to it takes;
      // the generated one changes on every run and nothing in the page points to it
      const written = getExplicitNodeId(node, ctx)
      const id = written === null ? null : (ctx?.__anchors?.shape || toFragment)(written)
      const conf = makeAttrs(node, ctx)
      if (conf.exists('link')) {
        ctx.link = conf.getFirstValue('link')
      }
      return wrapContent(`<div class="image_block"${id ? ` id="${id}"` : ''}>`, `</div>`)
    }),
  ),
  toJSX: helper => {
    const mkComponent = src => (writer, processor) => (node, ctx, interator) => {
      // prepare extraProps for createElement
      // add id attribute if exists
      const id = getNodeId(node, ctx)

      // check if node.content defined
      return helper(src, node, 'content' in node ? interator(node.content, { ...ctx }) : [], { id }, ctx)
    }
    return subUse(
      {
        // inside head don't wrap into <p>
        ':image': setFn((node: Image, ctx) => {
          const linkTo = ctx.link
          const hook = ctx.imageSrc as ImageSrcResolver | undefined
          const baseDir = ctx.imageBaseDir as string | undefined
          const address = imageAddress(node, ctx)
          // a computed data URL says its type; a data:Key reference names no file
          const computedType = address !== node.src ? /^data:([^;,]+)/.exec(String(address))?.[1] : undefined
          const isVideo = computedType
            ? computedType.startsWith('video/')
            : !isDataAddress(node.src) && Boolean(node.src?.match(/(mp4|mov)$/))
          const videoType = computedType ?? 'video/mp4'
          const written = writtenValue(node.alt)
          const alt = written !== undefined && isCovered(node, ctx) ? maskText(written) : written
          // the hint a reader shows over the picture, hidden as its text is
          const title =
            typeof node.title === 'string' ? (isCovered(node, ctx) ? maskText(node.title) : node.title) : undefined
          return mkComponent(({ key }) => {
            const renderInner = (src: string) =>
              isVideo ? (
                <video controls key={key}>
                  {' '}
                  <source src={src} type={videoType} />{' '}
                </video>
              ) : (
                <img key={key} src={src} alt={alt} title={title} />
              )
            // a computed data URL holds the picture itself, and a resolver would keep it after the mode changes
            const Img =
              hook && address === node.src ? (
                <HookedImage key={key} src={node.src} alt={alt} hook={hook} baseDir={baseDir} render={renderInner} />
              ) : (
                renderInner(address ?? node.src)
              )
            return linkTo ? (
              <a key={key} href={linkTo}>
                {Img}
              </a>
            ) : (
              Img
            )
          })
        }),
        caption: mkComponent(({ children, key }) => (
          <div className="caption" key={key}>
            {children}
          </div>
        )),
      },
      setFn((node, ctx) => {
        const { level } = node
        const id = getNodeId(node, ctx)
        const conf = makeAttrs(node, ctx)
        if (conf.exists('link')) {
          ctx.link = conf.getFirstValue('link')
        }
        return mkComponent(({ children, key }) => (
          <div className="image_block" key={key} id={id}>
            {children}
          </div>
        ))
      }),
    )
  },
}
export const PluginRegister: Plugins = {
  Image: Image,
  picture: Image,
}
export default Image
