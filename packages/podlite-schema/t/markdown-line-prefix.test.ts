import { podlite } from '../../core/src'
import { podlitePluggable } from '../src/pluggableParser'
import { toMarkdown, toAnyRules } from '../src'
import Writer from '../src/writer'
import WriterMarkdown from '../src/writerMarkdown'

// the parser of this package, and the path of the command line: the core with its plugins
const p = podlitePluggable()
const tree = (doc: string) => p.toAst(p.parse(doc, { podMode: 1 }))
const bare = (doc: string) => String(p.toMarkdown(tree(doc)))
const core = podlite({ importPlugins: true })
const markdown = (doc: string, renderMode = 'production') =>
  String(
    toMarkdown({ renderMode })
      .use(toAnyRules('toMarkdown', core.getPlugins()))
      .run(core.toAst(core.parse(doc, { podMode: 1 }))),
  )
const After = '\n=para After\n'

describe('the lines of a quote in markdown output', () => {
  it('puts the sign of the quote on every line of its paragraphs, items and code', () => {
    expect(bare('=begin nested\nPara one\n\nPara two\n=end nested\n' + After)).toBe(
      '> Para one\n>\n> Para two\n\nAfter\n\n',
    )
    expect(bare('=begin nested\n=item one\n=item two\n=end nested\n' + After)).toBe('> - one\n>\n> - two\n\nAfter\n\n')
    expect(bare('=begin nested\n=begin code\nfirst\nsecond\n=end code\n=end nested\n' + After)).toBe(
      '> ```\n> first\n> second\n> ```\n\nAfter\n\n',
    )
    expect(bare('=begin nested\n=begin table\na | b\nc | d\n=end table\n=end nested\n' + After)).toBe(
      '> | a | b |\n> | --- | --- |\n> | c | d |\n\nAfter\n\n',
    )
  })

  it('keeps a blank line of code inside the fence', () => {
    expect(bare('=begin nested\n=begin code\nx\n\ny\n=end code\n=end nested\n')).toBe('> ```\n> x\n>\n> y\n> ```\n\n')
  })

  it('writes every level of a quote', () => {
    expect(bare('=begin input :nested(2)\na\nb\n=end input\n' + After)).toBe(
      '> > ```\n> > a\n> > b\n> > ```\n\nAfter\n\n',
    )
    expect(bare('=for para :nested(3)\none\n' + After)).toBe('> > > one\n\nAfter\n\n')
    expect(
      bare('=begin nested\nOuter\n\n=begin nested\nInner one\n\nInner two\n=end nested\n\nOuter again\n=end nested\n'),
    ).toBe('> Outer\n>\n> > Inner one\n> >\n> > Inner two\n>\n> Outer again\n\n')
    expect(
      bare(
        '=begin nested\n=begin nested\nIn one\n=end nested\n\n=begin nested\nIn two\n=end nested\n\nLast\n=end nested\n',
      ),
    ).toBe('> > In one\n>\n> > In two\n>\n> Last\n\n')
  })

  it('writes a quote with nothing to show as one sign', () => {
    expect(bare('=begin nested\n=comment empty\n=end nested\n\n=output <After>\n')).toBe('>\n\n```\n<After>\n```\n')
  })

  it('ends the quote before a sample after it', () => {
    expect(bare('=begin nested\n=input <Before>\n=end nested\n\n=output <After>\n')).toBe(
      '> ```\n> <Before>\n> ```\n\n```\n<After>\n```\n',
    )
    expect(bare('=begin nested\n=begin code\nfirst\n=end code\n=end nested\n\n=output <After>\n')).toBe(
      '> ```\n> first\n> ```\n\n```\n<After>\n```\n',
    )
  })

  it('starts a quote after the term of a definition on a line of its own', () => {
    expect(bare('=begin defn\nTerm\n=for para :nested(1)\nq\n=end defn\n')).toBe('**Term:** \n> q\n\n\n')
  })

  it('writes a block without a rule and an =Html block inside a quote as fences', () => {
    const body = '```\na\n\nb\n'
    const fenced = '> ````\n> ```\n> a\n>\n> b\n> ````\n\nAfter\n\n'
    expect(markdown(`=begin nested\n=begin Unknown\n${body}=end Unknown\n=end nested\n` + After)).toBe(fenced)
    expect(markdown(`=begin nested\n=begin Html\n${body}=end Html\n=end nested\n` + After)).toBe(fenced)
  })

  it('writes a diagram inside a quote as a fence, hidden or not', () => {
    expect(markdown('=begin nested\n=begin Mermaid\ngraph TD\n  A --> B\n=end Mermaid\n=end nested\n' + After)).toBe(
      '> ```mermaid\n> graph TD\n>   A --> B\n> ```\n\nAfter\n\n',
    )
    const hidden = '=begin nested\n=begin Mermaid :masked\ngraph TD\n=end Mermaid\n=end nested\n' + After
    expect(markdown(hidden)).toBe('> ```\n> █████ ██\n> ```\n\nAfter\n\n')
    expect(markdown(hidden, 'draft')).toBe('> ```mermaid\n> graph TD\n> ```\n\nAfter\n\n')
  })

  it('keeps the caption of a picture inside the quote and the item', () => {
    const picture = '=begin picture :caption<Cap>\nx.png\n=end picture\n'
    expect(markdown(`=begin nested\n${picture}=end nested\n` + After)).toBe('> ![](x.png)\n>\n> Cap\n\nAfter\n\n')
    expect(markdown(`=begin item\n${picture}=end item\n` + After)).toBe('- ![](x.png)\n\n  Cap\n\nAfter\n\n')
  })

  it('keeps the anchor of a heading inside the quote', () => {
    expect(markdown('=begin nested\n=for head1 :id<here>\nHead\n=end nested\n\nL<to it|#here>\n')).toBe(
      '> <a name="here"></a>\n>\n> # Head\n\n[to it](#here)\n\n',
    )
  })

  it('writes a quote in a frame of a table with the sign on every line', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell :colspan(2)\n=begin nested\n=begin code\nx\ny\n=end code\n=end nested\n=end cell\n=end row\n=begin row\n=cell L\n=cell R\n=end row\n=end table\n'
    expect(bare(doc)).toContain('<td colspan="2">\n\n> ```\n> x\n> y\n> ```\n\n</td>')
  })
})

describe('the lines of an item in markdown output', () => {
  it('indents the lines after the marker by its width', () => {
    expect(bare('=begin item\n=para first\n\n=para second\n=end item\n' + After)).toBe(
      '- first\n\n  second\n\nAfter\n\n',
    )
    expect(bare('=begin item :!checked\nfirst\n\nsecond\n=end item\n')).toBe('- [ ] first\n\n  second\n\n')
    expect(bare('=item1 # one\n=begin item2\nsub\n\n=begin code\nc\n=end code\n=end item2\n=item1 # two\n')).toBe(
      '1. one\n\n   - sub\n\n     ```\n     c\n     ```\n2. two\n\n',
    )
    const ten = Array.from({ length: 10 }, (_, i) => `=item1 # n${i + 1}\n`).join('')
    expect(bare(ten + '=begin item2\nsub\n\nsecond\n=end item2\n')).toContain(
      '10. n10\n\n    - sub\n\n      second\n\n',
    )
  })

  it('opens a fence or a quote on the line of the marker', () => {
    expect(bare('=begin item\nIntro\n\n=begin code\nx <y>\nz\n=end code\n=end item\n')).toBe(
      '- Intro\n\n  ```\n  x <y>\n  z\n  ```\n',
    )
    expect(bare('=begin item\n=begin code\nx\n=end code\n\nafter code\n=end item\n')).toBe(
      '- ```\n  x\n  ```\n  after code\n\n',
    )
    expect(bare('=begin item\n=begin nested\nq\n=end nested\n=end item\n' + After)).toBe('- > q\n\nAfter\n\n')
    expect(
      bare('=begin nested\n=begin item\n=begin nested\nq\n=end nested\n=end item\n\nAfter in\n=end nested\n' + After),
    ).toBe('> - > q\n>\n> After in\n\nAfter\n\n')
  })

  it('keeps a quote inside an item inside a quote', () => {
    expect(
      bare(
        '=begin nested\n=begin item\nIntro\n\n=begin nested\nq1\n\nq2\n=end nested\n=end item\n=end nested\n' + After,
      ),
    ).toBe('> - Intro\n>\n>   > q1\n>   >\n>   > q2\n\nAfter\n\n')
  })

  it('writes a deeper list inside the item before it', () => {
    expect(
      bare('=item1 one\n=begin item2\nsub\n\n=begin code\nc\nd\n=end code\n=end item2\n=item1 two\n' + After),
    ).toBe('- one\n\n  - sub\n\n    ```\n    c\n    d\n    ```\n- two\n\nAfter\n\n')
  })
})

describe('what stays as it was', () => {
  it('keeps a quote of one paragraph and two quotes in a row', () => {
    expect(bare('=nested text\n')).toBe('> text\n\n')
    expect(bare('=nested one\n\n=nested two\n')).toBe('> one\n\n> two\n\n')
  })

  it('keeps nested lists without blocks', () => {
    expect(bare('=item1 a\n=item2 b\n=item1 c\n')).toBe('- a\n\n  - b\n\n- c\n\n')
    expect(bare('=item1 a\n\n=item2 b\n\n=item1 c\n')).toBe('- a\n\n  - b\n\n- c\n\n')
    expect(bare('=item1 a\n=item2 # one\n=item2 # two\n=item1 b\n')).toBe('- a\n\n  1. one\n\n  2. two\n\n- b\n\n')
    expect(bare('=item1 a\n=item2 b\n=item3 c\n=item1 d\n=item3 e\n=item1 f\n')).toBe(
      '- a\n\n  - b\n\n    - c\n\n- d\n\n  - e\n\n- f\n\n',
    )
  })

  it('does not hide a list after a hidden item', () => {
    expect(bare('=for item1 :masked\nsecret\n=item2 open\n=item1 next\n')).toBe('- ██████\n\n  - open\n\n- next\n\n')
  })

  it('keeps a tight list of markdown tight', () => {
    expect(markdown('=begin markdown\n- a\n- b\n=end markdown\n')).toContain('- a\n- b\n')
  })

  it('keeps a cell of a pipe table on one line', () => {
    expect(
      bare(
        '=begin table\n=begin row\n=begin cell\n=for para :nested(1)\nq\n=end cell\n=cell b\n=end row\n=end table\n',
      ),
    ).toBe('| > q | b |\n| --- | --- |\n\n')
  })

  it('keeps a footnote of a quote at the end of the document', () => {
    expect(bare('=begin nested\nText N<note>\n=end nested\n')).toBe('> Text [^1]\n\n\n\n---\n\n[^1]: note\n')
  })

  it('writes for a writer of its own as before', () => {
    const doc =
      '=begin nested\nq1\n\n=begin code\nx\n=end code\n=end nested\n\n=item1 a\n=begin item2\nsub\n\nmore\n=end item2\n=item1 b\n\n=para After C<c>\n'
    const out: string[] = []
    toMarkdown({ writer: new Writer((str: string) => out.push(str)) }).run(tree(doc))
    expect(out.join('')).toBe('q1\n\n```\nx\n```\n- a\n\n  - sub\n\nmore\n\n- b\n\nAfter `c`\n\n')
    const logged: string[] = []
    const log = jest.spyOn(console, 'log').mockImplementation((str: unknown) => void logged.push(String(str)))
    try {
      toMarkdown({ writer: new WriterMarkdown() }).run(tree(doc))
    } finally {
      log.mockRestore()
    }
    expect(logged.join('')).toBe('> q1\n\n```\nx\n```\n- a\n\n  - sub\n\nmore\n\n- b\n\nAfter `c`\n\n')
  })
})
