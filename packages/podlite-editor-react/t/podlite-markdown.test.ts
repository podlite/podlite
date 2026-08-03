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
