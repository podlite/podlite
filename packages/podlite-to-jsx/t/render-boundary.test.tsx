import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import Podlite from '../src/index'
import { podlite as podliteCore } from 'podlite'

const renderWithCrashingPlugin = (src: string): string => {
  const p = podliteCore({ importPlugins: true }).use({})
  const tree = p.toAstResult(p.parse(src))
  const plugins = () => ({
    'Boom:block': () => () => {
      throw new Error('handler exploded')
    },
  })
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    return ReactDOMServer.renderToString(<Podlite tree={tree} plugins={plugins as any} />)
  } finally {
    spy.mockRestore()
  }
}

describe('render survives a crashing block handler', () => {
  it('replaces the failed block with a placeholder and keeps the rest', () => {
    const src = ['=head1 Title', '', '=begin Boom', 'payload', '=end Boom', '', 'After text', ''].join('\n')
    const html = renderWithCrashingPlugin(src)
    expect(html).toContain('Title')
    expect(html).toContain('After text')
    expect(html).toContain('failed to render')
  })

  it('renders a plain document unchanged', () => {
    const p = podliteCore({ importPlugins: true }).use({})
    const tree = p.toAstResult(p.parse('=head1 Plain\n\ntext\n'))
    const html = ReactDOMServer.renderToString(<Podlite tree={tree} />)
    expect(html).toContain('Plain')
    expect(html).not.toContain('failed to render')
  })
})
