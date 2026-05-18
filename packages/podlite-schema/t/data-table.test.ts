var parse = require('..').parse

const findBlock = (tree: any, name: string): any => {
  if (!Array.isArray(tree)) return undefined
  for (const node of tree) {
    if (!node || typeof node !== 'object') continue
    if (node.name === name) return node
    if (Array.isArray(node.content)) {
      const found = findBlock(node.content, name)
      if (found) return found
    }
  }
  return undefined
}

const extractCellTexts = (tableNode: any): string[][] => {
  const result: string[][] = []
  if (!tableNode || !Array.isArray(tableNode.content)) return result
  for (const row of tableNode.content) {
    if (!row || row.name !== 'row') continue
    const cells: string[] = []
    for (const cell of row.content || []) {
      if (cell && cell.name === 'cell') {
        const text = (cell.content || [])
          .map((c: any) => (typeof c === 'string' ? c : c?.value || ''))
          .join('')
          .trim()
        cells.push(text)
      }
    }
    result.push(cells)
  }
  return result
}

describe('=data-table block recognition', () => {
  it('recognises =data-table typename in grammar (pre-plugin AST)', () => {
    const src = `=begin pod
=for data-table
  name,age
  Alice,30
=end pod`
    const raw = parse(src, { podMode: 1, skipChain: 1 })
    const dataTable = findBlock(raw, 'data-table')
    expect(dataTable).toBeDefined()
    expect(dataTable.type).toBe('block')
  })
})

describe('=data-table inline body', () => {
  it('parses CSV inline body with header=present', () => {
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present')
name,age
Alice,30
Bob,25
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    expect(table).toBeDefined()
    const cells = extractCellTexts(table)
    expect(cells[0]).toEqual(['name', 'age'])
    expect(cells[1]).toEqual(['Alice', '30'])
    expect(cells[2]).toEqual(['Bob', '25'])
  })

  it('inline body without :mime-type renders as empty with warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const src = `=begin pod
=begin data-table
name,age
Alice,30
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    expect(table).toBeDefined()
    expect(table.content).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('=data-table data: reference', () => {
  it('reads CSV from referenced =data block', () => {
    const src = `=begin pod
=begin data :key<planets> :mime-type('text/csv; header=present')
name,radius_km
Mercury,2440
Venus,6052
=end data

=for data-table :src<data:planets>
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    expect(table).toBeDefined()
    const cells = extractCellTexts(table)
    expect(cells[0]).toEqual(['name', 'radius_km'])
    expect(cells[1]).toEqual(['Mercury', '2440'])
    expect(cells[2]).toEqual(['Venus', '6052'])
  })

  it('renders empty with warning when referenced =data block is missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const src = `=begin pod
=for data-table :src<data:nonexistent>
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    expect(table).toBeDefined()
    expect(table.content).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('=data-table :columns projection', () => {
  it('projects columns by name', () => {
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present') :columns<name,city>
name,age,city
Alice,30,London
Bob,25,Paris
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    const cells = extractCellTexts(table)
    expect(cells[0]).toEqual(['name', 'city'])
    expect(cells[1]).toEqual(['Alice', 'London'])
    expect(cells[2]).toEqual(['Bob', 'Paris'])
  })

  it('projects columns by 1-based index', () => {
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present') :columns<1,3>
name,age,city
Alice,30,London
Bob,25,Paris
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    const cells = extractCellTexts(table)
    expect(cells[0]).toEqual(['name', 'city'])
    expect(cells[1]).toEqual(['Alice', 'London'])
  })

  it('reorders columns according to list order', () => {
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present') :columns<age,name>
name,age
Alice,30
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    const cells = extractCellTexts(table)
    expect(cells[0]).toEqual(['age', 'name'])
    expect(cells[1]).toEqual(['30', 'Alice'])
  })

  it('out-of-range column index renders empty with warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present') :columns<99>
name,age
Alice,30
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    expect(table.content).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('=data-table :src deferred schemes', () => {
  it('preserves node unchanged for :src<file:X.csv>', () => {
    const src = `=begin pod
=for data-table :src<file:./planets.csv>
=end pod`
    const tree = parse(src, { podMode: 1 })
    const dt = findBlock(tree, 'data-table')
    expect(dt).toBeDefined()
    expect(dt.name).toBe('data-table')
  })

  it('preserves node unchanged for :src<https://...>', () => {
    const src = `=begin pod
=for data-table :src<https://example.com/data.csv>
=end pod`
    const tree = parse(src, { podMode: 1 })
    const dt = findBlock(tree, 'data-table')
    expect(dt).toBeDefined()
    expect(dt.name).toBe('data-table')
  })

  it('preserves node unchanged for :src<file:X.tsv>', () => {
    const src = `=begin pod
=for data-table :src<file:./planets.tsv>
=end pod`
    const tree = parse(src, { podMode: 1 })
    const dt = findBlock(tree, 'data-table')
    expect(dt).toBeDefined()
    expect(dt.name).toBe('data-table')
  })
})

describe('=data-table :caption propagation', () => {
  it('preserves :caption attribute through plugin', () => {
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present') :caption('Inner planets')
name,radius
Mercury,2440
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    expect(table).toBeDefined()
    expect(table.config).toBeDefined()
    const caption = table.config.find((c: any) => c.name === 'caption')
    expect(caption).toBeDefined()
    expect(caption.value).toBe('Inner planets')
  })
})

describe('=data-table error recovery', () => {
  it('malformed CSV with unequal cells produces padded table + warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present')
name,age,city
Alice,30
Bob,25,Paris,Extra
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    expect(table).toBeDefined()
    const cells = extractCellTexts(table)
    expect(cells.length).toBe(3)
    expect(cells[0]).toEqual(['name', 'age', 'city'])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('=data-table :allow cell markup', () => {
  it(':allow<B> on =data-table preserves :allow on output =table', () => {
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present') :allow<B>
name,description
Alice,B<Important>
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    expect(table).toBeDefined()
    expect(table.config).toBeDefined()
    const allow = table.config.find((c: any) => c.name === 'allow')
    expect(allow).toBeDefined()
  })
})

describe('=data-table :rename overrides', () => {
  it('renames header columns via sparse hash', () => {
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present') :rename{age=>'Years'}
name,age
Alice,30
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    const cells = extractCellTexts(table)
    expect(cells[0]).toEqual(['name', 'Years'])
    expect(cells[1]).toEqual(['Alice', '30'])
  })

  it('renames by 1-based index', () => {
    const src = `=begin pod
=begin data-table :mime-type('text/csv; header=present') :rename{1=>'Person'}
name,age
Alice,30
=end data-table
=end pod`
    const tree = parse(src, { podMode: 1 })
    const table = findBlock(tree, 'table')
    const cells = extractCellTexts(table)
    expect(cells[0]).toEqual(['Person', 'age'])
  })
})
