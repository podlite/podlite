import { getFromTree } from '@podlite/schema'
import { lintSource } from '../src/lint'
import { parseContent } from '../src/lint/loader'

const RULE = 'allow-value'

const NOT_A_LIST = ':allow takes a list of markup code letters, as in :allow<B I>; this value allows no code'
const holds = (named: string) =>
  `:allow holds ${named}: a markup code is named by one letter, and the codes are listed with spaces, as in :allow<B I>; ${named} allows no code`

const lint = (src: string) => lintSource(src, 'doc.podlite', {}).violations
const found = (src: string) =>
  lint(src)
    .filter(v => v.rule === RULE)
    .map(v => [v.location?.start.line, v.message])
const code = (attrs: string) => `=begin pod\n\n=begin code ${attrs}\nx\n=end code\n\n=end pod\n`
const given = (source: string, message: string) => message.replace(/^:allow/, `:allow given by =${source}`)
const csv = (attrs: string) => `=begin data-table ${attrs} :mime-type<text/csv>\na,b\n1,2\n=end data-table\n`

// a csv table that was read: four cells and no report that its source could not be read
const readTable = (src: string) => {
  const ast = parseContent(src, 'podlite') as { diagnostics?: Array<{ code: string }> }
  expect(getFromTree(ast as never, (n: { name?: string }) => n?.name === 'cell')).toHaveLength(4)
  expect((ast.diagnostics || []).map(d => d.code)).not.toContain('table-source-unreadable')
}

describe('allow-value rule', () => {
  describe('reports a value that is not a list of code letters', () => {
    it.each([
      [':allow<*>', '"*"'],
      [':allow<B,I>', '"B,I"'],
      [':allow<BI>', '"BI"'],
      [':allow("B I")', '"B I"'],
      [':allow(" B ")', '" B "'],
      [":allow('')", '""'],
      [':allow<A Z a>', '"a"'],
      [':allow<* C*>', '"*", "C*"'],
      [':allow("B",42)', '42'],
    ])('%s', (attrs, named) => {
      expect(found(code(attrs))).toEqual([[3, holds(named)]])
    })

    it('names only the wrong items', () => {
      expect(found('=for para :allow<B C*>\ntext\n')).toEqual([[1, holds('"C*"')]])
    })

    it.each([':allow(42)', ':allow(0)', ':allow{B=>1}', ':allow'])('%s is not a list', attrs => {
      expect(found(code(attrs))).toEqual([[3, NOT_A_LIST]])
    })

    it('reads every :allow written on the block', () => {
      expect(found(code(':allow<B> :allow<*>'))).toEqual([[3, holds('"*"')]])
      expect(found(code(':allow<*> :allow<C*>'))).toEqual([
        [3, holds('"*"')],
        [3, holds('"C*"')],
      ])
    })

    it('reads :allow on a continuation of the marker', () => {
      expect(found('=begin code :allow<B>\n= :allow<*>\nx\n=end code\n')).toEqual([[1, holds('"*"')]])
    })

    it('reports a table once, on the table, not on the cells it makes', () => {
      const table = '=begin table :allow<*>\n=begin row\n=cell a\n=cell b\n=end row\n=end table\n'
      expect(found(table)).toEqual([[1, holds('"*"')]])
      readTable(csv(':allow<*>'))
      expect(found(csv(':allow<*>'))).toEqual([[1, holds('"*"')]])
    })

    it('reports a cell written with its own :allow', () => {
      const table = '=begin table\n=begin row\n=begin cell :allow<*>\na\n=end cell\n=end row\n=end table\n'
      expect(found(table)).toEqual([[3, holds('"*"')]])
    })

    it('reports a semantic block and a list item', () => {
      expect(found('=for DESCRIPTION :allow<*>\ntext\n\n=for item1 :allow<*>\none\n')).toEqual([
        [1, holds('"*"')],
        [4, holds('"*"')],
      ])
    })
  })

  describe('leaves a list of code letters alone', () => {
    it.each([
      ':allow<B I>',
      ':allow("B","I")',
      ':allow<Q Y>',
      ':allow<>',
      ':!allow',
      ':allow< R >',
      ':allow<B >',
      ":allow('B')",
      ':!allow<G>',
      ':allow<A B C D E F G H I J K L M N O P Q R S T U V W X Y Z>',
    ])('%s', attrs => {
      expect(found(code(attrs))).toEqual([])
    })

    it('leaves a table and a csv table that allow a letter', () => {
      expect(found('=begin table :allow<B>\n=begin row\n=cell a\n=end row\n=end table\n')).toEqual([])
      readTable(csv(':allow<B>'))
      expect(found(csv(':allow<B>'))).toEqual([])
    })

    it.each([
      ['a right list from =config', '=config code :allow<B I>\n\n=begin code\nx\n=end code\n'],
      ['a right list from =set', '=set :allow<B I>\n\n=begin code\nx\n=end code\n'],
      ['a negated =set', '=set :!allow\n\n=begin code\nx\n=end code\n'],
      ['an empty =set', '=set :allow<>\n\n=begin code\nx\n=end code\n'],
      ['a wrong =set followed by a right one', '=set :allow<*>\n=set :allow<B>\n=begin code\nx\n=end code\n'],
      ['a block with its own :allow after =config', '=config code :allow<*>\n\n=begin code :allow<B>\nx\n=end code\n'],
      ['a block before =config', '=begin code\nx\n=end code\n\n=config code :allow<*>\n'],
      ['a named block given :allow by =config', '=config MyBlock :allow<*>\n\n=begin MyBlock\nx\n=end MyBlock\n'],
      ['a =set that goes to an include', '=set :allow<*>\n=include file:other.podlite\n\n=begin code\nx\n=end code\n'],
    ])('leaves %s', (_, src) => {
      expect(found(src)).toEqual([])
    })

    it.each([
      ['=set', '=set :allow<B\n\n=begin code\nx\n=end code\n'],
      ['=set before a csv table', `=set :allow<B\n\n${csv('')}`],
      ['=config', '=config code :allow<B\n\n=begin code\nx\n=end code\n'],
    ])('leaves an unreadable value of %s to the report of the dropped attribute', (_, src) => {
      const all = lint(src)
      expect(all.filter(v => v.rule === RULE)).toEqual([])
      expect(all.filter(v => v.rule === 'attr-value-dropped').map(v => v.location?.start.line)).toEqual([1])
    })

    it('leaves a value the parser could not read to the report of the dropped attribute', () => {
      const all = lint('=begin code :allow<B\nx\n=end code\n')
      expect(all.filter(v => v.rule === RULE)).toEqual([])
      expect(all.filter(v => v.rule === 'attr-value-dropped')).toHaveLength(1)
    })

    it('leaves a named block to its handler', () => {
      expect(found('=begin MyBlock :allow<*>\nx\n=end MyBlock\n')).toEqual([])
    })

    it('leaves text that looks like the attribute', () => {
      expect(found('=pod\n\n:allow<*> plain\n')).toEqual([])
    })
  })

  describe('reports a value given by =config or =set on each block it reached', () => {
    it('reports =config on every block it reached', () => {
      expect(found('=config code :allow<*>\n\n=begin code\nx\n=end code\n\n=begin code\ny\n=end code\n')).toEqual([
        [3, given('config', holds('"*"'))],
        [7, given('config', holds('"*"'))],
      ])
    })

    it('reports =set on the block after it', () => {
      expect(found('=set :allow<*>\n\n=begin code\nx\n=end code\n')).toEqual([[3, given('set', holds('"*"'))]])
    })

    it.each(['config code', 'set'])('reports a value that is not a list, given by =%s', directive => {
      const source = directive.split(' ')[0]
      expect(found(`=${directive} :allow(42)\n\n=begin code\nx\n=end code\n`)).toEqual([[3, given(source, NOT_A_LIST)]])
    })

    it.each([
      ['para', '=for para\nx\n'],
      ['item1', '=item1 x\n'],
      ['head1', '=head1 x\n'],
      ['DESCRIPTION', '=for DESCRIPTION\nx\n'],
      ['table', '=begin table\n=begin row\n=cell a\n=cell b\n=end row\n=end table\n'],
    ])('reports =config %s on its block', (name, block) => {
      expect(found(`=config ${name} :allow<*>\n\n${block}`)).toEqual([[3, given('config', holds('"*"'))]])
    })

    it('reports =config data-table on a csv table, not on its cells', () => {
      const src = `=config data-table :allow<*>\n\n${csv('')}`
      readTable(src)
      expect(found(src)).toEqual([[3, given('config', holds('"*"'))]])
    })

    it.each([
      ['a paragraph after =config', '=config para :allow<*>\n\nx\n', 'config'],
      ['a paragraph after =set', '=set :allow<*>\n\nx\n', 'set'],
      ['indented code after =config', '=config code :allow<*>\n\n  x\n', 'config'],
      ['indented code after =set', '=set :allow<*>\n\n  x\n', 'set'],
    ])('reports %s', (_, src, source) => {
      expect(found(src)).toEqual([[3, given(source, holds('"*"'))]])
    })

    it('reports every wrong :allow of one =config', () => {
      expect(found('=config code :allow<B> :allow<*>\n\n=begin code\nx\n=end code\n')).toEqual([
        [3, given('config', holds('"*"'))],
      ])
      expect(found('=config code :allow<*> :allow<C*>\n\n=begin code\nx\n=end code\n')).toEqual([
        [3, given('config', holds('"*"'))],
        [3, given('config', holds('"C*"'))],
      ])
    })

    it('reports a right =set followed by a wrong one', () => {
      expect(found('=set :allow<B>\n=set :allow<*>\n=begin code\nx\n=end code\n')).toEqual([
        [3, given('set', holds('"*"'))],
      ])
    })

    it('reports =set that passes a directive on its way', () => {
      expect(found('=set :allow<*>\n=alias A x\n\n=begin code\nx\n=end code\n')).toEqual([
        [4, given('set', holds('"*"'))],
      ])
    })

    it('keeps =config inside the block it is written in', () => {
      const src =
        '=begin pod\n=config code :allow<*>\n\n=begin code\nx\n=end code\n=end pod\n\n=begin code\ny\n=end code\n'
      expect(found(src)).toEqual([[4, given('config', holds('"*"'))]])
    })
  })
})
