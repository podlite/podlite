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
    expect(check(table([' Имя  | Значение', ' =====|=========', ' раз  | два']))).toEqual([])
  })

  it('flags a cell wider than its column', () => {
    const v = check(table([' Имя  | Значение', ' =====|=========', ' длинное| два']))
    expect(v).toHaveLength(1)
    expect(v[0].location?.start.line).toBe(4)
  })

  it('flags a cell that ends on the column boundary', () => {
    expect(check(table([' Имя  | Значение', ' =====|=========', ' разик| два']))).toHaveLength(1)
  })

  it('accepts a bar that stands one place before the boundary', () => {
    expect(
      check(
        table([
          ' Что                | Левый край',
          ' =================== | ==========',
          ' раз                | 201 px',
        ]),
      ),
    ).toEqual([])
  })

  it('ignores a table written as an example inside a code block', () => {
    const src = `=begin code :lang<podlite>\n${table([
      ' Имя  | Значение',
      ' =====|=========',
      ' длинное| два',
    ])}=end code\n`
    expect(check(src)).toEqual([])
  })

  it('takes a bar inside a link as content, not as a column edge', () => {
    const rows = [' Имя | Ссылка', ' ====|=================================', ' раз | L<текст|file:путь.podlite> хвост']
    expect(check(table(rows))).toEqual([])
  })

  it('says nothing about a table separated by whitespace only', () => {
    expect(check(table([' Имя   Значение', ' раз   два']))).toEqual([])
  })
})
