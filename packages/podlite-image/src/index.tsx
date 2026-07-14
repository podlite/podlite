import React from 'react'
import {
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
const Image: Plugin = {
  toAst: (_, processor) => (node, ctx) => {
    if (typeof node !== 'string' && 'type' in node && 'content' in node && node.type === 'block') {
      const content = node.content[0]
      if (content && typeof content !== 'string' && 'location' in node && 'value' in content) {
        // get src and alt text
        const lines = content.value.split('\n')
        const [data, ...caption] = lines
        const captionText = caption.join('\n')
        const altRegexp = /\s*((?<altText>.+)\s+)?(?<src>[^\s]+)/
        const { altText, src } = (data.match(altRegexp) || { groups: { altText: undefined, src: undefined } }).groups
        const conf = makeAttrs(node, ctx)
        // make  inline image
        const imageSrc = conf.exists('src') ? conf.getFirstValue('src') : src
        const imageAlt = conf.exists('alt') ? conf.getFirstValue('alt') : altText
        const resultContent: Array<PodNode> = [mkImage(imageSrc, imageAlt)]
        // make caption
        const captionContent = conf.exists('caption') ? conf.getFirstValue('caption') : captionText
        if (captionContent) {
          resultContent.push(mkCaption(parseFormattingCodes(captionContent, {})))
        }

        return { ...node, content: resultContent /* content_: node.content */ }
      }
      return node
    }
  },
  toHtml: subUse(
    {
      // inside head don't wrap into <p>
      ':image': setFn((node, ctx) => {
        return writer => node => {
          const linkTo = ctx.link
          if (linkTo) {
            writer.writeRaw('<a href="')
            writer.write(linkTo)
            writer.writeRaw('">')
          }
          writer.writeRaw(`<img src="${node.src}" alt="${node.alt}"/>`)
          if (linkTo) {
            writer.writeRaw('</a>')
          }
        }
      }),
      caption: wrapContent('<div class="caption">', '</div>'),
    },
    setFn((node, ctx) => {
      const { level } = node
      const id = getNodeId(node, ctx)
      const conf = makeAttrs(node, ctx)
      if (conf.exists('link')) {
        ctx.link = conf.getFirstValue('link')
      }
      return wrapContent(`<div class="image_block" ${id ? ` id="${id}"` : ''}>`, `</div>`)
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
          const isVideo = node.src.match(/(mp4|mov)$/)
          return mkComponent(({ key }) => {
            const renderInner = (src: string) =>
              isVideo ? (
                <video controls key={key}>
                  {' '}
                  <source src={src} type="video/mp4" />{' '}
                </video>
              ) : (
                <img key={key} src={src} alt={node.alt} />
              )
            const Img = hook ? (
              <HookedImage key={key} src={node.src} alt={node.alt} hook={hook} baseDir={baseDir} render={renderInner} />
            ) : (
              renderInner(node.src)
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
