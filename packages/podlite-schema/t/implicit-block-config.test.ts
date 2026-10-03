import { toAnyRules, toHtml, toMarkdown, validatePodliteAst } from '../src'
import { runSelector } from '../src/selectors'
import { podlite } from '../../core/src'
import { readFileSync } from 'fs'
import { join } from 'path'

type Mode = 'production' | 'draft'

const p = podlite({ importPlugins: true })
const tree = (src: string) => p.toAst(p.parse(src, { podMode: 1 }))
const select = (selector: string, src: string): any[] => runSelector(selector, [{ file: 'a.podlite', node: tree(src) }])
const texts = (nodes: any[]) => nodes.map(n => String(n.text ?? '').trim())
const html = (src: string, mode: Mode = 'production') =>
  String(toHtml({ renderMode: mode }).use(toAnyRules('toHtml', p.getPlugins())).run(tree(src)))
const markdown = (src: string, mode: Mode = 'production') =>
  String(toMarkdown({ renderMode: mode }).use(toAnyRules('toMarkdown', p.getPlugins())).run(tree(src)))

const pod = (body: string) => `=begin pod\n${body}\n=end pod\n`

const findAll = (node: any, test: (n: any) => boolean, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findAll(n, test, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (test(node)) out.push(node)
  findAll(node.content, test, out)
  return out
}

describe('=config reaches a paragraph and code written without a marker', () => {
  it('a paragraph of a pod takes the settings of para', () => {
    const src = pod('=config para :lang<fr>\n\nPlain.\n\n=para Explicit')
    expect(select('para[ :lang<fr> ]', src)).toHaveLength(2)
    expect(select('para[ :!?lang ]', src)).toHaveLength(0)
  })

  it('code set in from the margin takes the settings of code', () => {
    const found = select('code[ :lang<raku> ]', pod('=config code :lang<raku>\n\n    my $x = 1;'))
    expect(texts(found)).toEqual(['my $x = 1;'])
  })

  it('the text of an item takes the settings of para in every form', () => {
    const src = pod(
      '=config para :lang<fr>\n\n=item Happy\n\n=for item\nDopey\n\n=begin item\nFirst.\n\nSecond.\n=end item',
    )
    expect(texts(select('para[ :lang<fr> ]', src))).toEqual(['Happy', 'Dopey', 'First.', 'Second.'])
  })

  it('a paragraph of a cell takes the settings of para', () => {
    const src =
      '=config para :lang<fr>\n\n=begin table\n=begin row\n=begin cell\nCell text.\n=end cell\n=end row\n=end table\n'
    expect(texts(select('para[ :lang<fr> ]', src))).toEqual(['Cell text.'])
  })

  it('a paragraph of a markdown block and of its list item takes the settings of para', () => {
    const src = pod('=config para :lang<fr>\n\n=begin markdown\n- item text\n\nplain text\n=end markdown')
    const found = findAll(tree(src), n => n.type === 'para' && (n.config || []).some((c: any) => c.name === 'lang'))
    expect(found).toHaveLength(2)
  })

  it('the own text of an explicit para and of a heading takes no settings', () => {
    const ast = tree(pod('=config para :lang<fr>\n=config head1 :lang<de>\n\n=para Explicit\n\n=head1 Title'))
    const inner = findAll(ast, n => n.type === 'block' && (n.name === 'para' || n.name === 'head'))
      .map(block => findAll(block.content, n => n.type === 'para'))
      .flat()
    expect(inner).toHaveLength(2)
    inner.forEach(n => expect(n.config).toBeUndefined())
  })

  it('the term of a definition takes no settings of para', () => {
    const found = select('para[ :lang<fr> ]', pod('=config para :lang<fr>\n\n=defn Term\nDefinition.'))
    expect(texts(found)).toEqual(['Definition.'])
  })

  it('a node no setting reached keeps the shape it had', () => {
    const ast = tree(pod('Plain.\n\n    my $x = 1;'))
    findAll(ast, n => n.type === 'para' || n.type === 'code').forEach(n => expect(n).not.toHaveProperty('config'))
  })

  it('the schema of the tree has the settings of para and code', () => {
    const definitions = JSON.parse(readFileSync(join(__dirname, '../schema/AstTree.json'), 'utf8')).definitions
    expect(definitions.Para.properties).toHaveProperty('config')
    expect(definitions.Code.properties).toHaveProperty('config')
  })

  it('the tree with configured nodes passes the schema', () => {
    const parsed = p.parse(pod('=config para :lang<fr>\n=config code :lang<raku>\n\nPlain.\n\n    my $x = 1;'), {
      podMode: 1,
    })
    expect(findAll(parsed, n => (n.type === 'para' || n.type === 'code') && Array.isArray(n.config))).toHaveLength(2)
    expect(validatePodliteAst(parsed)).toEqual([])
  })
})

describe('=set reaches a paragraph and code written without a marker', () => {
  it('goes to a paragraph after a blank line', () => {
    expect(texts(select('para[ :x<1> ]', pod('=set :x<1>\n\nPlain.')))).toEqual(['Plain.'])
  })

  it('goes to code right after it', () => {
    expect(texts(select('code[ :x<1> ]', pod('=set :x<1>\n    my $x = 1;')))).toEqual(['my $x = 1;'])
  })

  it('inside a definition goes past the term to the definition after a blank line', () => {
    expect(texts(select('para[ :x<1> ]', pod('=begin defn\nTerm\n\n=set :x<1>\n\nDefinition.\n=end defn')))).toEqual([
      'Definition.',
    ])
  })

  it('before the term of a definition goes to the definition on the next line', () => {
    expect(texts(select('para[ :x<1> ]', pod('=begin defn\n=set :x<1>\nTerm\nDefinition.\n=end defn')))).toEqual([
      'Definition.',
    ])
  })

  it('before the term of a definition goes to the definition after a blank line', () => {
    expect(texts(select('para[ :x<1> ]', pod('=begin defn\n=set :x<1>\nTerm\n\nDefinition.\n=end defn')))).toEqual([
      'Definition.',
    ])
  })
})

describe('a paragraph and code written without a marker render with their settings', () => {
  it('a masked paragraph is hidden in production and shown in draft', () => {
    const src = pod('=config para :masked\n\nSecretword.')
    for (const render of [html, markdown]) {
      expect(render(src)).not.toContain('Secretword')
      expect(render(src, 'draft')).toContain('Secretword')
    }
  })

  it('code allowing a markup code reads it', () => {
    expect(html(pod('=config code :allow<B>\n\n    my B<x>;'))).toContain('<strong>x</strong>')
  })

  it('code allowing no markup code leaves it as written', () => {
    expect(html(pod('    my B<x>;'))).toContain('my B&lt;x&gt;;')
  })

  it('a nested paragraph and code are nested as an explicit block is', () => {
    const src = pod('=config para :nested(1)\n=config code :nested(1)\n\nPlain.\n\n    my $x = 1;')
    expect(html(src)).toBe(
      '<blockquote><p>Plain.\n</p></blockquote><blockquote><pre><code>my $x = 1;\n</code></pre></blockquote>',
    )
    expect(markdown(src)).toContain('> Plain.')
  })

  it('an explicit para is nested once, not by its text again', () => {
    const out = html(pod('=config para :nested(2)\n\n=para Explicit\n\nPlain.'))
    expect(out.match(/<blockquote>/g)).toHaveLength(4)
  })

  it('a document without nesting renders as before', () => {
    expect(html(pod('Plain.\n\n    my $x = 1;'))).toBe('<p>Plain.\n</p><pre><code>my $x = 1;\n</code></pre>')
  })
})
