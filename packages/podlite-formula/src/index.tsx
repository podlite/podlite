import React from 'react'
import { Plugin, Plugins, getNodeId, getSafeNodeId, isCovered, makeAttrs, maskText } from '@podlite/schema'
import { Tex2ChtmlWithProvider } from './MathJax'
export { MathJaxProvider } from './MathJax'
const Formula = ({
  formula,
  isInline = false,
  caption,
  id,
}: {
  formula: string
  caption?: string
  id?: string
  isInline: boolean
}) => {
  const element = (
    <>
      <Tex2ChtmlWithProvider className={`${isInline ? 'f-code' : 'formula'}`} latex={formula} inline={isInline} />
      {caption ? <div className="caption">{caption}</div> : null}
    </>
  )

  return isInline ? (
    element
  ) : (
    <div className="formula" id={id}>
      {element}
    </div>
  )
}

export const FormulaPlugin: Plugin = {
  toJSX: helper => () => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const hidden = isCovered(node, ctx)
    const written = conf.exists('caption') ? String(conf.getFirstValue('caption')) : null
    const caption = written !== null && hidden ? maskText(written) : written
    const id = getSafeNodeId(node, ctx)
    const isInlineContext = node.type === 'fcode'
    const formula = node.content[0]?.value
    return helper(
      ({ children, key }) => {
        // hidden source is not handed to the typesetter: the page would show what it
        // hides once the formula is set
        if (hidden) {
          const masked = maskText(String(formula ?? ''))
          return isInlineContext ? (
            <span className="f-code" key={key}>
              {masked}
            </span>
          ) : (
            <div className="formula" id={id} key={key}>
              {masked}
              {caption ? <div className="caption">{caption}</div> : null}
            </div>
          )
        }
        return <Formula key={key} isInline={isInlineContext} id={id} caption={caption} formula={formula} />
      },
      node,
      interator(node.content, { ...ctx }),
    )
  },
}
export const PluginRegister: Plugins = {
  formula: FormulaPlugin,
  'F<>': FormulaPlugin,
}
export default Formula
