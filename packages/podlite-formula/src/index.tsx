import React from 'react'
import { useEffect, useRef } from 'react'
import { Plugin, Location, Plugins, getNodeId, makeAttrs } from '@podlite/schema'
import KaTeX from 'katex'

const Formula = ({
  formula,
  isError,
  isInline = false,
  caption,
  id,
}: {
  formula: string
  isError: any
  caption?: string
  id?: string
  isInline: boolean
}) => {
  const inputEl = useRef(null)

  useEffect(() => {
    if (isError) {
      console.log(isError)
      return
    }
    try {
      KaTeX.render(formula, inputEl.current, {
        displayMode: !isInline,
        throwOnError: false,
      })
    } catch (e) {
      console.log({ e })
    }
  }, [formula])

  return isInline ? (
    <span className={`f-code${isError ? ' error' : ''}`} ref={inputEl}></span>
  ) : (
    <div className="formula" id={id}>
      <div className={`formula${isError ? ' error' : ''}`} ref={inputEl} />
      {caption ? <div className="caption">{caption}</div> : null}
    </div>
  )
}

export const FormulaPlugin: Plugin = {
  toAst: writer => node => {
    if (typeof node !== 'string' && 'type' in node && 'content' in node && node.type === 'block') {
      const content = node.content[0]
      if (content && typeof content !== 'string' && 'location' in node && 'value' in content) {
        const data = content.value
        try {
          KaTeX.renderToString(data, {
            displayMode: true,
            throwOnError: true,
          })
        } catch (error) {
          if (error instanceof KaTeX.ParseError || error instanceof TypeError) {
            node.custom = { ...error }
            writer.emit('errors', 'Formula error:' + node.location.start.line)
          }

          // calculate line in relation to node
          const convert_line_to_absolute = (line: number, location: Location): Location => {
            const lineoffset = line + location.start.line + 1
            return {
              start: {
                offset: 0,
                line: lineoffset,
                column: 1,
              },
              end: {
                offset: 9,
                line: lineoffset,
                column: 2,
              },
            }
          }
          if (typeof window !== 'undefined') {
            node.custom = { ...error, location: convert_line_to_absolute(error.position, node.location) }
            writer.emit('errors', node.location)
          }
        }
        return node
      }
    }
    if (typeof node !== 'string' && 'type' in node && 'content' in node && node.type === 'fcode') {
      const data = node.content[0]
      try {
        KaTeX.renderToString(data, {
          displayMode: false,
          throwOnError: true,
        })
      } catch (error) {
        if (error instanceof KaTeX.ParseError || error instanceof TypeError) {
          node.custom = { ...error }
        }
      }
      return node
    }
  },
  toJSX: helper => () => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const caption = conf.exists('caption') ? conf.getFirstValue('caption') : null
    const id = getNodeId(node, ctx)
    const isInlineContext = node.type === 'fcode'
    return helper(
      ({ children, key }) => {
        return (
          <Formula
            key={key}
            isInline={isInlineContext}
            id={id}
            isError={node.custom}
            caption={caption}
            formula={node.content[0].value}
          />
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
