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
