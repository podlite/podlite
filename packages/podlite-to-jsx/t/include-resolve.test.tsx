import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

describe('include resolve via ctx.includeReader (data provider pattern)', () => {
  it('without reader: =include renders as nothing (backward compat)', () => {
    render(
      <Podlite>
        {`=begin pod
=para Before
=include file:any.podlite | defn
=para After
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/Before/)
    expect(root.innerHTML).toMatch(/After/)
    expect(root.innerHTML).not.toMatch(/data:|defn/i)
  })

  it('with reader: =include file:X | defn inlines extracted blocks', () => {
    const includeReader = (path: string) => {
      if (path === 'terms.podlite') {
        return `=begin pod
=begin defn :id<alpha>
First term
=end defn
=begin defn :id<beta>
Second term
=end defn
=end pod
`
      }
      return null
    }
    render(
      <Podlite includeReader={includeReader}>
        {`=begin pod
=para Header
=include file:terms.podlite | defn
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/First term/)
    expect(root.innerHTML).toMatch(/Second term/)
  })

  it('with reader returning null: renders as nothing', () => {
    const includeReader = (_path: string) => null
    render(
      <Podlite includeReader={includeReader}>
        {`=begin pod
=para Around
=include file:missing.podlite | defn
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/Around/)
    // No defn rendered
    expect(root.innerHTML).not.toMatch(/<dl/)
  })

  it('cycle guard: self-include does not infinite loop', () => {
    let calls = 0
    const includeReader = (path: string) => {
      calls++
      if (calls > 5) throw new Error('infinite recursion detected in test')
      if (path === 'self.podlite') {
        return `=begin pod
=para Inner before
=include file:self.podlite | para
=para Inner after
=end pod
`
      }
      return null
    }
    render(
      <Podlite includeReader={includeReader}>
        {`=begin pod
=include file:self.podlite | para
=end pod
`}
      </Podlite>,
    )
    // First include resolves; nested include of same file is dropped
    expect(root.innerHTML).toMatch(/Inner before/)
    expect(root.innerHTML).toMatch(/Inner after/)
    expect(calls).toBeLessThan(5)
  })

  it('two-hop cycle: A -> B -> A is broken at the cycle edge', () => {
    // Without a `| filter` the renderer keeps nested =include blocks intact,
    // which lets cycle detection actually trigger when the chain comes back
    // to a previously visited path.
    const includeReader = (path: string): string | null => {
      if (path === 'a.podlite') {
        return `=begin pod
=para In A
=include file:b.podlite
=end pod
`
      }
      if (path === 'b.podlite') {
        return `=begin pod
=para In B
=include file:a.podlite
=end pod
`
      }
      return null
    }
    expect(() =>
      render(
        <Podlite includeReader={includeReader}>
          {`=begin pod
=include file:a.podlite
=end pod
`}
        </Podlite>,
      ),
    ).not.toThrow()
    expect(root.innerHTML).toMatch(/In A/)
    expect(root.innerHTML).toMatch(/In B/)
  })

  it('selector with no matches: renders as nothing', () => {
    const includeReader = (path: string) => {
      if (path === 'noresults.podlite') {
        return `=begin pod
=para Just a paragraph
=end pod
`
      }
      return null
    }
    render(
      <Podlite includeReader={includeReader}>
        {`=begin pod
=include file:noresults.podlite | defn
=end pod
`}
      </Podlite>,
    )
    // No defn anywhere
    expect(root.innerHTML).not.toMatch(/<dl/)
  })
})
