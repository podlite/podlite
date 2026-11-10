import { lintSource } from '../src/lint'

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
      const csv = '=begin data-table :allow<*> :format<csv>\na,b\n1,2\n=end data-table\n'
      expect(found(csv)).toEqual([[1, holds('"*"')]])
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
      expect(found('=begin data-table :allow<B> :format<csv>\na,b\n=end data-table\n')).toEqual([])
    })

    it('leaves a value given by =config or =set to the directive', () => {
      expect(found('=config code :allow<*>\n\n=begin code\nx\n=end code\n')).toEqual([])
      expect(found('=set :allow<*>\n\n=begin code\nx\n=end code\n')).toEqual([])
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
})
