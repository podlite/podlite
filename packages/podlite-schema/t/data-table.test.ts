var parse = require('..').parse

describe('=data-table block recognition', () => {
  it('parses bare =data-table directive', () => {
    const src = `=begin pod
=for data-table
  name,age
  Alice,30
=end pod`
    const tree = parse(src, { podMode: 1 })
    const root = tree[0]
    expect(root.name).toBe('pod')
    const dataTable = root.content.find((c: any) => c && c.name === 'data-table')
    expect(dataTable).toBeDefined()
    expect(dataTable.type).toBe('block')
  })
})
