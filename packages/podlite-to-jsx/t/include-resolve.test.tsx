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

  it('reads a file an operand of in names through the reader', () => {
    const files: Record<string, string> = {
      'guide.podlite': '=for para :status<draft>\nDraft\n\n=for para :status<paid>\nPaid\n',
      'vocabulary.podlite': '=defn paid\nMoney in.\n',
    }
    const asked: string[] = []
    const includeReader = (path: string) => {
      asked.push(path)
      return files[path] ?? null
    }
    render(
      <Podlite includeReader={includeReader}>
        {'=begin pod\n=include file:guide.podlite | para[ :status(in file:vocabulary.podlite | defn) ]\n=end pod\n'}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/Paid/)
    expect(root.innerHTML).not.toMatch(/Draft/)
    expect(asked).toEqual(['guide.podlite', 'vocabulary.podlite'])
  })

  it('reads an operand with no source from the document the include is written in', () => {
    const includeReader = (path: string) =>
      path === 'guide.podlite' ? '=for para :status<draft>\nDraft\n\n=for para :status<paid>\nPaid\n' : null
    render(
      <Podlite includeReader={includeReader}>
        {'=begin pod\n=defn draft\nNot done.\n\n=include file:guide.podlite | para[ :status(in defn) ]\n=end pod\n'}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/<p>Draft/)
    expect(root.innerHTML).not.toMatch(/<p>Paid/)
  })

  it('an operand of in that does not resolve brings nothing in and renders the rest', () => {
    const includeReader = (path: string) => (path === 'terms.podlite' ? '=defn alpha\nFirst term\n' : null)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <Podlite includeReader={includeReader}>
        {`=begin pod
=para Around
=include file:terms.podlite | defn[ :x(in file:none.podlite | defn) ]
=end pod
`}
      </Podlite>,
    )
    warn.mockRestore()
    expect(root.innerHTML).toMatch(/Around/)
    expect(root.innerHTML).not.toMatch(/failed to render|First term/)
  })

  it('an include source written without a scheme is read as a file', () => {
    const includeReader = (path: string) => (path === 'terms.podlite' ? '=defn alpha\nFirst term\n' : null)
    render(
      <Podlite includeReader={includeReader}>
        {`=begin pod
=include terms.podlite | defn
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/First term/)
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

  it('places a heading inside a found pod once', () => {
    const includeReader = (path: string) => (path === 'part.podlite' ? '=begin pod\n=head1 Inside\n=end pod\n' : null)
    render(
      <Podlite includeReader={includeReader}>
        {`=begin pod
=include file:part.podlite | pod, head1
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML.match(/<h1/g)).toHaveLength(1)
  })

  it('renders the page around an address that does not resolve, and finds one by a heading', () => {
    const includeReader = (path: string) =>
      path === 'part.podlite' ? '=begin pod\n=head1 Overview\n\nText.\n=end pod\n' : null
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <Podlite includeReader={includeReader}>
        {`=begin pod
=para Before
=include file:part.podlite#nope
=include file:part.podlite#Overview
=end pod
`}
      </Podlite>,
    )
    warn.mockRestore()
    expect(root.innerHTML).toMatch(/Before/)
    expect(root.innerHTML.match(/<h1/g)).toHaveLength(1)
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
