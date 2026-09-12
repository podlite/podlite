import { toTree, toHtml, toMarkdown } from '..'
import { runSelector } from '../src/selectors'

const parseDoc = (src: string): any => toTree().parse(src, { podMode: 1, skipChain: 0 })

const findAll = (tree: any, name: string, found: any[] = []): any[] => {
  if (!Array.isArray(tree)) return found
  for (const node of tree) {
    if (!node || typeof node !== 'object') continue
    if (node.type === 'block' && node.name === name) found.push(node)
    if (Array.isArray(node.content)) findAll(node.content, name, found)
  }
  return found
}

const bodyOf = (node: any): string =>
  (node.content || []).map((c: any) => (c.type === 'verbatim' ? c.value : JSON.stringify(c))).join('')

const option = (node: any, name: string): any => (node.config || []).find((c: any) => c.name === name)

describe('test blocks', () => {
  it('a delimited test holds its fixture and assertion, and an unknown name stays text', () => {
    const tree = parseDoc(`=begin pod
=begin test :id<t1>

=begin fixture
=head2 Overview
=end fixture

=for assert
head2

=end test

=begin foo
text
=end foo
=end pod`)
    const [test] = findAll(tree, 'test')
    expect(test).toBeDefined()
    expect(findAll(test.content, 'fixture')).toHaveLength(1)
    expect(findAll(test.content, 'assert')).toHaveLength(1)
    expect(findAll(tree, 'foo')).toHaveLength(0)
  })

  it('keeps the body of a fixture, an assertion and a resource as written', () => {
    const tree = parseDoc(`=begin pod
=begin test

=begin resource :name<includes/guide.podlite>
=head1 Guide
=end resource

=begin fixture
=head2 Overview

text with =include in it
=end fixture

=for assert
head2[ :id<x> ]

=end test
=end pod`)
    expect(bodyOf(findAll(tree, 'resource')[0])).toBe('=head1 Guide\n')
    expect(bodyOf(findAll(tree, 'fixture')[0])).toBe('=head2 Overview\n\ntext with =include in it\n')
    expect(bodyOf(findAll(tree, 'assert')[0])).toBe('head2[ :id<x> ]\n')
  })

  it('reads the paragraph and abbreviated forms of the verbatim blocks', () => {
    const tree = parseDoc(`=begin pod
=for assert :absent
head3

=assert head2

=for resource :name<a.txt>
plain text

=fixture plain text
=end pod`)
    const asserts = findAll(tree, 'assert')
    expect(asserts.map(bodyOf)).toEqual(['head3\n', 'head2\n'])
    expect(option(asserts[0], 'absent')).toBeDefined()
    expect(bodyOf(findAll(tree, 'resource')[0])).toBe('plain text\n')
    expect(bodyOf(findAll(tree, 'fixture')[0])).toBe('plain text\n')
  })

  it('does not put the blocks after a paragraph or abbreviated test inside it', () => {
    for (const opener of ['=for test', '=test']) {
      const tree = parseDoc(`=begin pod
${opener}
=assert head2
=end pod`)
      const [test] = findAll(tree, 'test')
      expect(test).toBeDefined()
      expect(findAll(test.content, 'assert')).toHaveLength(0)
      expect(findAll(tree, 'assert')).toHaveLength(1)
    }
  })

  it('reads the options of a test and its children', () => {
    const tree = parseDoc(`=begin pod
=begin test :id<value-comma-stays> :caption('a comma stays')

=begin resource :name<data/a.csv>
a,b
=end resource

=for assert :absent :caption('no invoice lacks a number')
Invoice[ :!?number ]

=end test
=end pod`)
    const [test] = findAll(tree, 'test')
    expect(option(test, 'id')).toBeDefined()
    expect(option(test, 'caption')).toBeDefined()
    expect(option(findAll(tree, 'resource')[0], 'name')).toBeDefined()
    const [assert] = findAll(tree, 'assert')
    expect(option(assert, 'absent')).toBeDefined()
    expect(option(assert, 'caption')).toBeDefined()
  })
})

describe('the body of a fixture', () => {
  it('is not read as markup, whatever :allow says', () => {
    for (const src of [
      `=begin pod
=begin fixture :allow<B>
some B<bold> text
=end fixture
=end pod`,
      `=begin pod
=config fixture :allow<B>
=begin fixture
some B<bold> text
=end fixture
=end pod`,
    ]) {
      const [fixture] = findAll(parseDoc(src), 'fixture')
      expect(bodyOf(fixture)).toBe('some B<bold> text\n')
    }
  })

  it('ends at its own closing line, and two fixtures in a row stay two', () => {
    const tree = parseDoc(`=begin pod
=begin test
=begin fixture
=head1 One
=end fixture
=begin fixture
=head1 Two
=end fixture
=end test
=end pod`)
    expect(findAll(tree, 'fixture').map(bodyOf)).toEqual(['=head1 One\n', '=head1 Two\n'])
  })

  it('closes at the first closing line of the same indent, even inside a nested fixture', () => {
    const sameIndent = findAll(
      parseDoc(`=begin pod
=begin fixture
=begin fixture
=head1 Inner
=end fixture
=end fixture
=end pod`),
      'fixture',
    )
    expect(bodyOf(sameIndent[0])).toBe('=begin fixture\n=head1 Inner\n')

    const deeper = findAll(
      parseDoc(`=begin pod
=begin fixture
  =begin fixture
  =head1 Inner
  =end fixture
=end fixture
=end pod`),
      'fixture',
    )
    expect(deeper).toHaveLength(1)
    expect(bodyOf(deeper[0])).toBe('  =begin fixture\n  =head1 Inner\n  =end fixture\n')
  })

  it('may be empty', () => {
    const [fixture] = findAll(
      parseDoc(`=begin pod
=begin fixture
=end fixture
=end pod`),
      'fixture',
    )
    expect(fixture).toBeDefined()
    expect(bodyOf(fixture)).toBe('')
  })

  it('is taken relative to the indent of the fixture', () => {
    const [fixture] = findAll(
      parseDoc(`=begin pod
  =begin test
    =begin fixture
    =head2 H
      extra
    =end fixture
  =end test
=end pod`),
      'fixture',
    )
    expect(bodyOf(fixture)).toBe('=head2 H\n  extra\n')
  })

  it('yields no include node', () => {
    const tree = parseDoc(`=begin pod
=begin fixture
=include file:./guide.podlite
=end fixture
=end pod`)
    expect(findAll(tree, 'include')).toHaveLength(0)
  })
})

describe('markup codes in an assertion and a resource', () => {
  it('are left as text unless :allow opts in', () => {
    const plain = parseDoc(`=begin pod
=for assert
para[ :caption<B<x>> ]
=end pod`)
    expect(bodyOf(findAll(plain, 'assert')[0])).toBe('para[ :caption<B<x>> ]\n')

    for (const name of ['assert', 'resource']) {
      const allowed = parseDoc(`=begin pod
=for ${name} :allow<B>
some B<bold> text
=end pod`)
      const [node] = findAll(allowed, name)
      expect(JSON.stringify(node.content)).toContain('"name":"B"')
    }
  })
})

describe('selectors over a document with tests', () => {
  const src = `=begin pod
=head2 Real heading

=begin test
=begin fixture
=head2 Fixture heading
=end fixture

=for assert
head2
=end test
=end pod`

  it('do not reach the headings inside a fixture', () => {
    const blocks = runSelector('head2', [{ file: 'doc.podlite', node: parseDoc(src) }]) as any[]
    expect(blocks).toHaveLength(1)
  })

  it('reach the test itself', () => {
    const blocks = runSelector('test', [{ file: 'doc.podlite', node: parseDoc(src) }]) as any[]
    expect(blocks).toHaveLength(1)
  })
})

describe('the blocks of a test in html and markdown', () => {
  const src = `=begin pod
=head1 Doc

=begin test :id<v1.2> :caption('a heading inside a fixture stays source')
=begin resource :name<a.podlite>
=head1 Guide
=end resource

=begin fixture
=head2 Overview
=end fixture

=for assert :absent :caption('no third level')
head3
=end test
=end pod`

  const html = () => toHtml({}).run(src).toString()
  const md = () => toMarkdown({}).run(src).toString()

  it('show a test open, anchored the way a link to it is', () => {
    expect(html()).toContain('<details id="v12" class="test" open><summary class="test-summary">')
    expect(html()).toContain('<span class="test-caption">a heading inside a fixture stays source</span>')
  })

  it('show a fixture and a resource as source, not as markup', () => {
    const out = html()
    expect(out).toContain('<div class="test-fixture"><pre><code>=head2 Overview')
    expect(out).toContain('<span class="test-resource-name">a.podlite</span><pre><code>=head1 Guide')
    expect(out).not.toContain('<h2')
  })

  it('show what an assertion expects', () => {
    expect(html()).toContain(
      '<div class="test-assert test-absent"><code class="test-selector">head3\n</code> <span class="test-expect">must find no block</span> <span class="test-assert-caption">no third level</span></div>',
    )
    expect(toHtml({}).run('=begin test\n=for assert\npara\n=end test').toString()).toContain(
      '<span class="test-expect">must find a block</span>',
    )
  })

  it('leave a test folded when the author folds it', () => {
    const out = toHtml({}).run('=begin test :folded\n=for assert\npara\n=end test').toString()
    expect(out).toContain('<details class="test"><summary')
  })

  it('name a test by its id, then by the word test', () => {
    expect(toHtml({}).run('=begin test :id<t9>\n=for assert\npara\n=end test').toString()).toContain(
      '<span class="test-caption">t9</span>',
    )
    expect(toHtml({}).run('=begin test\n=for assert\npara\n=end test').toString()).toContain(
      '<span class="test-caption">test</span>',
    )
  })

  it('keep the body of an assertion that allows markup codes', () => {
    const out = toHtml({}).run('=begin test\n=for assert :allow<B>\npara[ :x<B<y>> ]\n=end test').toString()
    expect(out).toContain('<code class="test-selector">para[ :x&lt;<strong>y</strong>&gt; ]')
  })

  it('write a test open in markdown', () => {
    const out = md()
    expect(out).toContain('**Test** a heading inside a fixture stays source')
    expect(out).toContain('```podlite\n=head2 Overview\n```')
    expect(out).toContain('Resource `a.podlite`:\n\n```podlite\n=head1 Guide\n```')
    expect(out).toContain('- `head3` must find no block: no third level')
  })

  it('fence a body longer than any run of backticks in it', () => {
    const out = toMarkdown({})
      .run('=begin test\n=begin fixture\nC<```>\n=end fixture\n=for assert\npara[ :x<`> ]\n=end test')
      .toString()
    expect(out).toContain('````podlite\nC<```>\n````')
    expect(out).toContain('- ``para[ :x<`> ]`` must find a block')
  })
})
