import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import termsIndexPlugin from '../src/terms-index-plugin'

const tctx = { testing: true }
const file1 = `
=begin pod

=head1 Operator classification

X<|Language,prefix operator>
X<|Language,infix operator>
X<|Language,postfix operator>
X<|Language,circumfix operator>
X<|Language,postcircumfix operator>
X<|Language,method operators>

Operators can occur in several positions relative to a term:

=end pod
`
const file2 = `
=begin pod :puburl</doc/m>

=TITLE Modules


X<|Operators,s/// in-place substitution>    
=head2 C<s///> in-place substitution

=head1 X<Lexical scope|Tutorial,my (Basics)> and X<block|Tutorial,block (Basics)>

=end pod
`

const file3 = `
=begin pod 

=TITLE Foo

=end pod
`
// const it = (t, f) => f()

it('[termsIndexPlugin]: attach set of empty X<>', () => {
  const state = processFile('t/image-plugin/virtualFile.podlite', file1)
  const config: PluginConfig = {
    plugin: termsIndexPlugin({ built_path: '/tmp/public' }),
    includePatterns: '.*',
  }

  const [res, ctx] = processPlugin(config, [state], tctx)
  expect(ctx.indexTerms.map(i => i.url)).toMatchInlineSnapshot(`
    Array [
      "#Operator-classification",
      "#Operator-classification",
      "#Operator-classification",
      "#Operator-classification",
      "#Operator-classification",
      "#Operator-classification",
    ]
  `)
})

it('[termsIndexPlugin]: X<> in header', () => {
  const state = processFile('t/image-plugin/virtualFile.podlite', file2)
  const config: PluginConfig = {
    plugin: termsIndexPlugin({ built_path: '/tmp/public' }),
    includePatterns: '.*',
  }

  const [res, ctx] = processPlugin(config, [state], tctx)
  expect(ctx.indexTerms.map(i => i.url)).toMatchInlineSnapshot(`
    Array [
      "/doc/m#s-in-place-substitution",
      "/doc/m#Lexical-scope-and-block",
      "/doc/m#Lexical-scope-and-block",
    ]
  `)
})

it('[termsIndexPlugin]: empty', () => {
  const state = processFile('t/image-plugin/virtualFile.podlite', file3)
  const config: PluginConfig = {
    plugin: termsIndexPlugin({ built_path: '/tmp/public' }),
    includePatterns: '.*',
  }

  const [res, ctx] = processPlugin(config, [state], tctx)
  expect(ctx.indexTerms.map(i => i.url)).toMatchInlineSnapshot(`Array []`)
})

describe('index entries the site is given', () => {
  const indexed = (body: string) => {
    const state = processFile('virtual/index-terms.podlite', `=begin pod :puburl("/secret")\n${body}\n=end pod\n`)
    const config: PluginConfig = { plugin: termsIndexPlugin({ built_path: '/tmp/public' }), includePatterns: '.*' }
    const [res, ctx] = processPlugin(config, [state], tctx)
    return { terms: ctx.indexTerms, tree: res[0].node }
  }

  it('masks an entry and its text from a hidden block and leaves the tree as it was', () => {
    const { terms, tree } = indexed('=for para :masked\nAn X<algorithm|RSA-2048-secret> here.')
    const json = JSON.stringify(terms)
    expect(json).not.toContain('RSA-2048')
    expect(json).not.toContain('algorithm')
    expect(terms[0].xnode.entry).toEqual(['█'.repeat('RSA-2048-secret'.length)])
    expect(JSON.stringify(tree)).toContain('RSA-2048-secret')
  })

  it('addresses an entry in a hidden heading by the anchor the page gives it', () => {
    const { terms } = indexed('=head1 Plan G<Zeta> X<|planning>')
    expect(terms[0].url).toBe('/secret#masked-1')
  })

  it('addresses an entry in a repeated heading by its numbered anchor', () => {
    const { terms } = indexed('=head1 Same\n\n=head1 Same X<|second>')
    expect(terms[0].url).toBe('/secret#Same-2')
  })

  it('addresses an entry in a heading with an id by that id', () => {
    const { terms } = indexed('=for head1 :id<chosen>\nHeading X<|named>')
    expect(terms[0].url).toBe('/secret#chosen')
  })

  it('gives the page address for a heading that has no anchor', () => {
    const { terms } = indexed('=head1 !!! X<|bang>')
    expect(terms[0].url).toBe('/secret')
  })

  it('keeps the address of an entry in a paragraph', () => {
    const { terms } = indexed('=head1 Intro\n\nA X<word|plain> in text.')
    expect(terms[0].url).toMatch(/^\/secret#[\w-]+$/)
    expect(terms[0].url).not.toBe('/secret#Intro')
  })
})
