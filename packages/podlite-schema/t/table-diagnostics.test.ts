import { podlitePluggable } from '../src'

const diagnostics = (src: string) => (podlitePluggable().parse(src, { podMode: 1 }).diagnostics || []).map(d => d.code)
const messages = (src: string) => (podlitePluggable().parse(src, { podMode: 1 }).diagnostics || []).map(d => d.message)

describe('table reports reach the tree', () => {
  const short =
    '=begin table\n=begin row :header\n=cell A\n=cell B\n=cell C\n=end row\n=begin row\n=cell 1\n=end row\n=end table\n'
  const long =
    '=begin table\n=begin row :header\n=cell A\n=cell B\n=end row\n=begin row\n=cell 1\n=cell 2\n=cell 3\n=end row\n=end table\n'
  const even =
    '=begin table\n=begin row :header\n=cell A\n=cell B\n=end row\n=begin row\n=cell 1\n=cell 2\n=end row\n=end table\n'

  it('reports a padded row', () => {
    expect(diagnostics(short)).toEqual(['table-row-cells'])
    expect(messages(short)[0]).toContain('1 of 3 cells')
  })

  it('reports a row cut to the table width', () => {
    expect(messages(long)[0]).toContain('dropped 1')
  })

  it('reports mixed separator styles', () => {
    expect(diagnostics('=begin table\n A | B\n ==|==\n 1   2\n=end table\n')).toContain('table-mixed-separators')
  })

  it('says nothing about an even table', () => {
    expect(diagnostics(even)).toEqual([])
  })

  it('carries the place of the table', () => {
    const tree = podlitePluggable().parse(`=para text\n\n${short}`, { podMode: 1 })
    expect(tree.diagnostics?.[0].location.start.line).toBe(3)
  })
})

describe('every row a table repairs is reported, by its number', () => {
  const reports = (src: string) =>
    (podlitePluggable().parse(src, { podMode: 1 }).diagnostics || []).map(d => [d.code, d.message])
  const rowNumbers = (src: string) =>
    reports(src)
      .filter(([code]) => code === 'table-row-cells')
      .map(([, message]) => (message.match(/row (\d+) has/) || [])[1])

  it('reports a padded row next to mixed separators', () => {
    const r = reports('=begin table\nA | B | C\nx    y\n=end table\n')
    expect(r.map(([code]) => code)).toEqual(['table-mixed-separators', 'table-row-cells'])
    expect(r[1][1]).toMatch(/^table row 2 has 2 of 3 cells, padded with 1 empty/)
  })

  it('counts the even rows too', () => {
    expect(rowNumbers('=begin table\nA | B | C\n==|==|==\nx | y\na | b | c\np | q\n=end table\n')).toEqual(['2', '4'])
  })

  it('numbers a padded and a truncated row under a header', () => {
    const r = reports('=begin table\nA | B | C\n==|==|==\nx | y\np | q | r | s\n=end table\n')
    expect(r.map(([, message]) => message.split(',')[0])).toEqual([
      'table row 2 has 2 of 3 cells',
      'table row 3 has 4 of 3 cells',
    ])
    expect(r[1][1]).toMatch(/dropped 1$/)
  })

  it('counts rows, not blank lines between structured rows', () => {
    const src =
      '=begin table\n\n=begin row :header\n=cell A\n=cell B\n=cell C\n=end row\n\n=begin row\n=cell 1\n=end row\n\n=begin row\n=cell 2\n=end row\n\n=end table\n'
    expect(rowNumbers(src)).toEqual(['2', '3'])
  })

  it('counts the first row when the table has no header', () => {
    expect(rowNumbers('=begin table\nx | y\na | b | c\n=end table\n')).toEqual(['1'])
  })

  const csv = 'A,B,C\n"first\ncontinued",x,y\nshort,z\nfull,a,b\nlast,z\n'

  it('counts parsed rows of a table read from a data block, not lines of the data', () => {
    const src = `=begin data :key<d> :mime-type("text/csv; header=present")\n${csv}=end data\n\n=table data:d\n`
    expect(rowNumbers(src)).toEqual(['3', '5'])
    expect(reports(src)[0][1]).toMatch(/^table data:d row 3 has/)
  })

  it('counts parsed rows of a data table, not lines of its body', () => {
    const src = `=begin data-table :mime-type("text/csv; header=present")\n${csv}=end data-table\n`
    expect(rowNumbers(src)).toEqual(['3', '5'])
    expect(reports(src)[0][1]).toMatch(/^data-table row 3 has/)
  })

  it('keeps a padded row next to a value that could not be read', () => {
    const codes = reports('=begin table :width(abc)\nA | B | C\nx | y\n=end table\n').map(([code]) => code)
    expect(codes).toEqual(['value-unreadable', 'table-row-cells'])
  })

  it('keeps cells outside a row and the truncation they cause', () => {
    const src = '=begin table\n=begin row :header\n=cell A\n=end row\n=for row\n=cell 1\n=cell 2\n=end table\n'
    expect(reports(src).map(([code]) => code)).toEqual(['table-cell-outside-row', 'table-row-cells'])
  })

  it('says the row a dropped column choice left short, after the value it dropped', () => {
    const src = '=begin data-table :mime-type<text/csv> :columns[1,2]\nA,B,C\nx,y\n=end data-table\n'
    expect(reports(src).map(([code]) => code)).toEqual(['value-unreadable', 'table-row-cells'])
  })
})

describe('reports a table does not add', () => {
  const codes = (src: string) => (podlitePluggable().parse(src, { podMode: 1 }).diagnostics || []).map(d => d.code)

  it('gives one report for mixed separators alone', () => {
    expect(codes('=begin table\n A | B\n ==|==\n 1   2\n=end table\n')).toEqual(['table-mixed-separators'])
  })

  it('does not say a written media type is missing when its value was dropped', () => {
    expect(codes('=for data-table :mime-type(text/csv)\na,b\n')).toEqual(['value-unreadable'])
  })
})
