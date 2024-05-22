import React from 'react'
import { Plugin, Plugins, getNodeId, makeAttrs } from '@podlite/schema'
import { Tex2ChtmlWithProvider } from './MathJax'
import './default.css'

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
    const caption = conf.exists('caption') ? conf.getFirstValue('caption') : null
    const id = getNodeId(node, ctx)
    const isInlineContext = node.type === 'fcode'
    return helper(
      ({ children, key }) => {
        return (
          <Formula key={key} isInline={isInlineContext} id={id} caption={caption} formula={node.content[0]?.value} />
        )
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
