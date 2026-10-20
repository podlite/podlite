import { scanSourceRules } from '../src/lint/grammar/scan'
import { TABLE_COLUMN_WIDTH_RULE_ID, tableColumnWidthRule } from '../src/lint/rules/table-column-width'

const check = (src: string) => scanSourceRules(src).filter(v => v.rule === TABLE_COLUMN_WIDTH_RULE_ID)

const table = (rows: string[]) => `=begin table\n${rows.join('\n')}\n=end table\n`

describe('table-column-width rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(TABLE_COLUMN_WIDTH_RULE_ID).toBe('table-column-width')
    expect(tableColumnWidthRule.severity).toBe('warning')
  })

  it('stays quiet on a table whose cells fit', () => {
    expect(check(table([' Name  | Value', ' =====|=========', ' one  | two']))).toEqual([])
  })

  it('flags a cell wider than its column', () => {
    const v = check(table([' Name  | Value', ' =====|=========', ' longcell| two']))
    expect(v).toHaveLength(1)
    expect(v[0].location?.start.line).toBe(4)
  })

  it('flags a cell that ends on the column boundary', () => {
    expect(check(table([' Name  | Value', ' =====|=========', ' wider| two']))).toHaveLength(1)
  })

  it('accepts a bar that stands one place before the boundary', () => {
    expect(
      check(
        table([
          ' What                | Left edge',
          ' =================== | ==========',
          ' one                | 201 px',
        ]),
      ),
    ).toEqual([])
  })

  it('ignores a table written as an example inside a code block', () => {
    const src = `=begin code :lang<podlite>\n${table([
      ' Name  | Value',
      ' =====|=========',
      ' longcell| two',
    ])}=end code\n`
    expect(check(src)).toEqual([])
  })

  it('takes a bar inside a link as content, not as a column edge', () => {
    const rows = [' Name | Link', ' ====|=================================', ' one | L<text|file:path.podlite> tail']
    expect(check(table(rows))).toEqual([])
  })

  it('says nothing about a table separated by whitespace only', () => {
    expect(check(table([' Name   Value', ' one   two']))).toEqual([])
  })

  describe('rows held apart by spaces while the separator draws bars', () => {
    it('lets a cell fill its column to the last place', () => {
      const rows = ['  VERSION   DATE', '  =======|========', '  0.1       2026-08-12']
      expect(check(table(rows))).toEqual([])
    })

    it('still flags content standing on the boundary', () => {
      const rows = ['  VERSIONING   DATE', '  =======|========', '  0.1          2026-08-12']
      expect(check(table(rows))).toHaveLength(1)
    })

    it('keeps flagging a row that draws its own bar with no space before it', () => {
      const rows = ['  Name | Size', '  =====|=====', '  wider| two']
      expect(check(table(rows))).toHaveLength(1)
    })

    it('accepts the same row once a space is left before the bar', () => {
      const rows = ['  Name | Size', '  =====|=====', '  one  | two']
      expect(check(table(rows))).toEqual([])
    })
  })

  describe('the end of an abbreviated table', () => {
    const rows = 'a | b\n--+--\nc | d\n=future abcdef\n'

    it('ends a paragraph or abbreviated table at a directive line, as the parser does', () => {
      expect(check(`=for table\n${rows}`)).toEqual([])
      expect(check(`=table\n${rows}`)).toEqual([])
    })

    it('ends an abbreviated table at a directive line inside a delimited table', () => {
      expect(check(`=begin table\n=for table\n${rows}=end table\n`)).toEqual([])
    })

    it('ends an abbreviated table at a blank line inside a delimited table', () => {
      expect(check(`=begin table\n=for table\na | b\n--+--\nc | d\n\nabcdef\n=end table\n`)).toEqual([])
    })
  })
})
