import { lintSource } from '../src/lint'
import { DEAD_DEFINITIONS_RULE_ID, deadDefinitionsRule } from '../src/lint/rules/dead-definitions'

const check = (src: string) =>
  lintSource(src, 'doc.podlite', {}).violations.filter(v => v.rule === DEAD_DEFINITIONS_RULE_ID)

const dataBlock = (key: string) => `=begin data :key<${key}> :mime-type<text/csv>\nname,count\nalpha,1\n=end data\n`

describe('dead-definitions rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(DEAD_DEFINITIONS_RULE_ID).toBe('dead-definitions')
    expect(deadDefinitionsRule.severity).toBe('warning')
  })

  it('says nothing about a document that declares neither', () => {
    expect(check('=head1 Title\n\ntext\n')).toEqual([])
  })

  describe('an alias', () => {
    it('is left alone when a markup code calls it', () => {
      expect(check('=alias PRODUCT My Product\n\nA<PRODUCT> ships today.\n')).toEqual([])
    })

    it('is reported when nothing calls it', () => {
      const found = check('=alias PRODUCT My Product\n\nplain text only\n')
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('PRODUCT')
    })

    it('is reported once per alias left unused', () => {
      expect(check('=alias ONE first\n=alias TWO second\n\ntext\n')).toHaveLength(2)
    })

    it('is not confused by a similar name', () => {
      expect(check('=alias PRODUCT My Product\n\nA<PRODUCTION> elsewhere\n')).toHaveLength(1)
    })
  })

  describe('a data block', () => {
    it('is left alone when a table reads it', () => {
      expect(check(`${dataBlock('rows')}\n=table data:rows\n`)).toEqual([])
    })

    it('is left alone when an attribute points at it', () => {
      expect(check(`${dataBlock('img')}\n=for picture :src<data:img>\nalt text\n`)).toEqual([])
    })

    it('is reported when the key is named nowhere', () => {
      const found = check(`${dataBlock('rows')}\ntext\n`)
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('rows')
    })

    it('catches the key that was mistyped at the reference', () => {
      const found = check(`${dataBlock('rows')}\n=table data:rowz\n`)
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('rows')
    })

    it('says nothing about a data block that carries no key', () => {
      expect(check('=begin data\nname,count\n=end data\n\ntext\n')).toEqual([])
    })
  })

  it('points at the line the definition stands on', () => {
    const found = check('=head1 Title\n\n=alias PRODUCT My Product\n\ntext\n')
    expect(found[0].location?.start.line).toBe(3)
  })
})

describe('without the source text', () => {
  it('keeps checking aliases, which the tree carries', () => {
    const { runRules } = require('../src/lint/engine')
    const { parseContent } = require('../src/lint/loader')
    const ast = parseContent('=alias PRODUCT My Product\n\ntext\n', 'podlite')
    const found = runRules(ast, [deadDefinitionsRule], { filePath: 'doc.podlite', fileType: 'podlite', config: {} })
    expect(found).toHaveLength(1)
  })

  it('says nothing about data keys it cannot look up', () => {
    const { runRules } = require('../src/lint/engine')
    const { parseContent } = require('../src/lint/loader')
    const ast = parseContent('=begin data :key<rows>\na,b\n=end data\n\ntext\n', 'podlite')
    const found = runRules(ast, [deadDefinitionsRule], { filePath: 'doc.podlite', fileType: 'podlite', config: {} })
    expect(found).toEqual([])
  })
})

describe('a data key is used only where the document reads it', () => {
  const block = (key = 'k') => `=begin data :key<${key}> :mime-type<text/csv>\nname\nalpha\n=end data\n\n`
  const count = (src: string) => check(src).length

  it.each([
    ['a comment', '=comment see data:k\n'],
    ['prose', 'The data:k block holds the names.\n'],
    ['code in a paragraph', 'Read C<data:k> here.\n'],
    ['a code block', '=begin code\n=table data:k\n=end code\n'],
    ['a caption', '=for para :caption<data:k>\ntext\n'],
    ['a literal selector operand', "=include file:x.podlite | X[ :a(in 'data:k') ]\n"],
    ['the label of a link elsewhere', 'L<data:k|https://example.org>\n'],
    ['a picture code in a comment', '=comment P<data:k>\n'],
    ['a link in Z<>', 'Z<L<data:k>>\n'],
    ['a Markdown link in code', '=begin markdown\n```\n[x](data:k)\n[r]: data:k\n```\n=end markdown\n'],
    ['the text of an abbreviated picture, which is its caption', '=picture data:k\n'],
    ['the first line of a picture body', '=begin picture :src<x.png>\n\ndata:k\n=end picture\n'],
    ['an address after a description in a picture body', '=picture Logo data:k\n'],
  ])('does not count %s', (_, use) => {
    expect(count(`${block()}${use}`)).toBe(1)
  })

  it.each([
    ['a table', '=table data:k\n'],
    ['a data table', '=for data-table :src<data:k>\n'],
    ['a source set for the next block', '=set :src<data:k>\n=for data-table\n'],
    ['an =Image source', '=Image data:k\n'],
    ['an =Image source after its description', '=Image Logo data:k\n'],
    ['a picture source', '=for picture :src<data:k>\nalt\n'],
    ['an inline picture', 'See P<alt|data:k>.\n'],
    ['a link to a column', 'See L<x|data:k#name>.\n'],
    ['a web link', 'See W<t|data:k>.\n'],
    ['a link a code block allows', '=begin code :allow<L W>\nL<data:k>\n=end code\n'],
    ['a selector operand', '=include file:x.podlite | X[ :a(in data:k) ]\n'],
    ['a nested selector operand', '=include file:x.podlite | X[ :a(in file:g.podlite | defn[ :b(in data:k) ]) ]\n'],
    ['a contents selector', '=toc X[ :a(in data:k#name) ]\n'],
    ['an assertion', '=begin test :id<t>\n=for assert\nX[ :a(in data:k) ]\n=end test\n'],
    ['an =Image whose source follows a blank line', '=begin Image\n\ndata:k\n=end Image\n'],
    ['a picture code on the first line of a picture body', '=begin picture :src<x.png>\nP<alt|data:k>\n=end picture\n'],
    ['a link an alias holds', '=alias R L<read|data:k>\n\nA<R>\n'],
    ['a picture an alias holds', '=alias R P<alt|data:k>\n\nA<R>\n'],
    ['a Markdown link and image', '=begin markdown\n[x](data:k) ![alt](data:k)\n=end markdown\n'],
    ['a Markdown reference link', '=begin markdown\nSee [x][ref].\n\n[ref]: data:k\n=end markdown\n'],
    ['a Markdown reference in a list', '=begin markdown\n- See [x][ref].\n\n  [ref]: data:k\n=end markdown\n'],
    ['a Markdown image by reference in a quote', '=begin markdown\n> ![a][r]\n>\n> [r]: data:k\n=end markdown\n'],
    ['a caption given by =set', '=set :caption L<read|data:k>\n=for picture :src<file:x.png>\n'],
    ['a picture link', '=for picture :link<data:k>\nfile:x.png\n'],
    ['a link with a coded label an alias holds', '=alias R L<B<read>|data:k>\n\nA<R>\n'],
    ['a link in double angles an alias holds', '=alias R L<<data:k>>\n\nA<R>\n'],
    ['a picture code in guillemets in a caption', '=for picture :src<file:x.png>\nSee P«data:k»\n'],
    ['a link an alias named comment holds', '=alias comment L<data:k>\n\nA<comment>\n'],
  ])('counts %s', (_, use) => {
    expect(count(`${block()}${use}`)).toBe(0)
  })

  it('matches a key with a space or a hash as the table reading it does', () => {
    expect(
      count("=begin data :key('k v') :mime-type<text/csv>\nname\n=end data\n\n=for data-table :src('data:k v')\n"),
    ).toBe(0)
    expect(count("=begin data :key('k#col') :mime-type<text/csv>\nname\n=end data\n\n=table data:k#col\n")).toBe(0)
  })

  it('takes the whole key, dots and all', () => {
    expect(count(`${block('k.v2')}=table data:k.v2\n`)).toBe(0)
    expect(count(`${block('Logo.png')}=for picture :src<data:Logo.png>\n`)).toBe(0)
  })

  it('says the key is never used, without claiming its spelling appears nowhere', () => {
    expect(check(`${block()}=comment data:k\n`)[0].message).toBe('=data :key<k> is never used')
  })
})
