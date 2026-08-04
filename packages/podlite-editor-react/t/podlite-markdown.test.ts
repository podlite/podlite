import { parser as mdParser } from '@lezer/markdown'
import { podliteMarkdownExtension } from '../src/podliteMarkdown'

const parser = mdParser.configure(podliteMarkdownExtension as any)

const nodes = (src: string): string[] => {
  const out: string[] = []
  parser.parse(src).iterate({ enter: n => void out.push(n.name) })
  return out
}

const textOf = (src: string, name: string): string | undefined => {
  let found: string | undefined
  parser.parse(src).iterate({
    enter: n => {
      if (!found && n.name === name) found = src.slice(n.from, n.to)
    },
  })
  return found
}

describe('podlite read on top of markdown', () => {
  it('splits a marker line into keyword, block name and attributes', () => {
    const src = "=begin pod :type('journal-note') :id<x>\n"
    expect(nodes(src)).toEqual(
      expect.arrayContaining(['PodDirective', 'PodKeyword', 'PodBlockName', 'PodAttrName', 'PodAttrValue']),
    )
    expect(textOf(src, 'PodKeyword')).toBe('=begin')
    expect(textOf(src, 'PodBlockName')).toBe('pod')
    expect(textOf(src, 'PodAttrName')).toBe(':type')
    expect(textOf(src, 'PodAttrValue')).toBe("('journal-note')")
  })

  it('reads the content of a markdown block as markdown, with the fence language', () => {
    const src = '=begin markdown\n\n```js\nvar i = 0;\n```\ntext\n\n=end markdown\n'
    const found = nodes(src)
    expect(found).toEqual(expect.arrayContaining(['PodDirective', 'FencedCode', 'CodeInfo', 'CodeText']))
    expect(textOf(src, 'CodeInfo')).toBe('js')
    expect(textOf(src, 'CodeText')).toBe('var i = 0;')
  })

  it('keeps markdown out of a block whose content is taken as written', () => {
    const src = '=begin code :lang<js>\nvar i = 0;\n# not a heading\n=end code\n\ntext\n'
    const found = nodes(src)
    expect(found).toContain('PodVerbatim')
    expect(found).not.toContain('ATXHeading1')
    expect(textOf(src, 'PodVerbatim')).toContain('# not a heading')
  })

  it('leaves ordinary markdown alone', () => {
    expect(nodes('- list item\n')).toEqual(expect.arrayContaining(['BulletList', 'ListItem']))
  })

  it('reads a value in every delimiter the norm has', () => {
    const src = '=for para :a<x> :b(\'y\') :c{k=>1} :d"z" :e｢w｣\n'
    const values: string[] = []
    parser.parse(src).iterate({
      enter: n => {
        if (n.name === 'PodAttrValue') values.push(src.slice(n.from, n.to))
      },
    })
    expect(values).toEqual(['<x>', "('y')", '{k=>1}', '"z"', '｢w｣'])
  })
})

// the same ground the stream highlighter covers, read off the tree
describe('parity with the stream highlighter', () => {
  const nameNode = (src: string, name: string): string | undefined => {
    let found: string | undefined
    parser.parse(src).iterate({
      enter: n => {
        if (!found && n.name.startsWith('Pod') && src.slice(n.from, n.to) === name) found = n.name
      },
    })
    return found
  }

  it('names a section of the document apart from a standard block', () => {
    expect(nameNode('=begin SYNOPSIS\ntext\n=end SYNOPSIS\n', 'SYNOPSIS')).toBe('PodSemanticBlock')
    expect(nameNode('=begin SEE-ALSO\ntext\n=end SEE-ALSO\n', 'SEE-ALSO')).toBe('PodSemanticBlock')
    expect(nameNode('=for AUTHOR\ntext\n', 'AUTHOR')).toBe('PodSemanticBlock')
  })

  it('names a block the author brought in apart from both', () => {
    expect(nameNode('=begin Image\ntext\n=end Image\n', 'Image')).toBe('PodCustomBlock')
    expect(nameNode('=for Diagram\ntext\n', 'Diagram')).toBe('PodCustomBlock')
  })

  it('keeps a standard block standard', () => {
    for (const name of ['code', 'data-table', 'row', 'cell', 'table', 'pod'])
      expect(nameNode(`=begin ${name}\ntext\n=end ${name}\n`, name)).toBe('PodBlockName')
    expect(nameNode('=end data-table\n', 'data-table')).toBe('PodBlockName')
  })

  it('reads a closing marker on its own', () => {
    expect(nameNode('=end SYNOPSIS\n', 'SYNOPSIS')).toBe('PodSemanticBlock')
    expect(nameNode('=end Image\n', 'Image')).toBe('PodCustomBlock')
  })

  it('leaves a lowercase name it does not know as such', () => {
    expect(nameNode('=begin foo\ntext\n=end foo\n', 'foo')).toBe('PodUnknownBlock')
    expect(nameNode('=foo text\n', 'foo')).toBe('PodUnknownBlock')
  })

  it('reads the abbreviated form the same way', () => {
    expect(nameNode('=TITLE Heading\n', 'TITLE')).toBe('PodSemanticBlock')
    expect(nameNode('=NAME Name\n', 'NAME')).toBe('PodSemanticBlock')
    expect(nameNode('=SEE-ALSO links\n', 'SEE-ALSO')).toBe('PodSemanticBlock')
    expect(nameNode('=Diagram diagram\n', 'Diagram')).toBe('PodCustomBlock')
    expect(textOf('=head1 Title\n', 'PodKeyword')).toBe('=head1')
    expect(textOf('=item1 One\n', 'PodKeyword')).toBe('=item1')
  })

  it('reads a directive that goes on over the next line', () => {
    const src = '=set :caption<Multi>\n=    :id<x>\n'
    const marks: string[] = []
    parser.parse(src).iterate({
      enter: n => void (n.name === 'PodKeyword' && marks.push(src.slice(n.from, n.to))),
    })
    expect(marks).toEqual(['=set', '='])
    expect(textOf(src, 'PodAttrValue')).toBe('<Multi>')
  })

  it('does not let one directive swallow the next', () => {
    const src = '=set :id<x>\n\n=head1 Title\n'
    const keywords: string[] = []
    parser.parse(src).iterate({
      enter: n => void (n.name === 'PodKeyword' && keywords.push(src.slice(n.from, n.to))),
    })
    expect(keywords).toEqual(['=set', '=head1'])
  })

  it('starts a directive under a line of text', () => {
    expect(textOf('text\n=head1 Title\n', 'PodKeyword')).toBe('=head1')
  })

  it('reads the attribute forms the highlighter knew', () => {
    expect(textOf('=for para :masked\n', 'PodAttrName')).toBe(':masked')
    expect(textOf('=for table :rename{a=>b}\n', 'PodAttrValue')).toBe('{a=>b}')
    const src = '=begin data-table :src<file:./x.csv> :columns<a,b>\n=end data-table\n'
    const values: string[] = []
    parser.parse(src).iterate({
      enter: n => void (n.name === 'PodAttrValue' && values.push(src.slice(n.from, n.to))),
    })
    expect(values).toEqual(['<file:./x.csv>', '<a,b>'])
  })

  it('reads a boundary directive with its caption', () => {
    expect(textOf('=boundary :caption<End>\n', 'PodKeyword')).toBe('=boundary')
    expect(textOf('=boundary :caption<End>\n', 'PodAttrValue')).toBe('<End>')
  })

  // the three the stream highlighter got wrong (T428)
  it('takes a hyphenated name and a negation whole', () => {
    expect(textOf('=for table :mime-type<text/csv>\n', 'PodAttrName')).toBe(':mime-type')
    expect(textOf('=for pod :folded-levels<2>\n', 'PodAttrName')).toBe(':folded-levels')
    expect(textOf('=for pod :!toc\n', 'PodAttrName')).toBe(':!toc')
  })

  it('marks a value in a bare delimiter', () => {
    expect(textOf("=for pod :a'string'\n", 'PodAttrValue')).toBe("'string'")
    expect(textOf('=for pod :a"string"\n', 'PodAttrValue')).toBe('"string"')
    expect(textOf('=for pod :a｢string｣\n', 'PodAttrValue')).toBe('｢string｣')
  })

  it('takes only a matching pair for a value', () => {
    const src = '=for pod :a<x)\n'
    const values: string[] = []
    parser.parse(src).iterate({
      enter: n => void (n.name === 'PodAttrValue' && values.push(src.slice(n.from, n.to))),
    })
    expect(values).toEqual([])
  })

  it('marks content hidden from the reader', () => {
    expect(textOf('The password is G<hunter2> here.\n', 'PodCodeG')).toBe('G<hunter2>')
  })
})

describe('markup codes', () => {
  const codeNodes = (src: string): string[] => {
    const out: string[] = []
    parser.parse(src).iterate({ enter: n => void (n.name.startsWith('PodCode') && out.push(n.name)) })
    return out
  }

  it('reads every code the highlighter knew', () => {
    for (const letter of ['A', 'B', 'C', 'F', 'G', 'I', 'L', 'O', 'U', 'Z']) {
      expect(codeNodes(`text ${letter}<inside> tail\n`)).toContain(`PodCode${letter}`)
    }
  })

  it('reads multiple angles and guillemets', () => {
    expect(codeNodes('text C<< a > b >> tail\n')).toContain('PodCodeC')
    expect(codeNodes('text B«bold» tail\n')).toContain('PodCodeB')
  })

  it('takes the whole span, not the first closing bracket', () => {
    expect(textOf('C<< $x > 5 >>\n', 'PodCodeC')).toBe('C<< $x > 5 >>')
  })

  it('reads a code inside a code', () => {
    const found = codeNodes('B<bold I<and italic>>\n')
    expect(found).toContain('PodCodeB')
    expect(found).toContain('PodCodeI')
  })

  it('stands next to markdown markup without breaking it', () => {
    const src = 'B<bold> and [a link](/a) and **markdown** and _italic_\n'
    expect(codeNodes(src)).toContain('PodCodeB')
    expect(nodes(src)).toEqual(expect.arrayContaining(['Link', 'StrongEmphasis', 'Emphasis']))
    expect(textOf(src, 'PodCodeB')).toBe('B<bold>')
  })

  it('leaves a lone capital letter alone', () => {
    expect(codeNodes('Just X and text\n')).toEqual([])
  })
})
