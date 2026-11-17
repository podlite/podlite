import { podlitePluggable, toHtml, toMarkdown, validateAstTree, validatePodliteAst } from '../src'
import { CsvError, parseCsv, parseTsv } from '../src/plugin-tables'
import { runSelector, SelectorDoc, SelectorError } from '../src/selectors'

// CSV and TSV are read the same way by every reader: =table data:, =data-table
// with :src or a body, and a selector reading a column

const parse = (src: string, raw = false) => podlitePluggable().parse(src, { podMode: 1, skipChain: raw ? 1 : 0 })
const diagnostics = (src: string) => (parse(src).diagnostics || []).map(d => [d.severity, d.code])

type Node = Record<string, unknown>
const isNode = (x: unknown): x is Node => typeof x === 'object' && x !== null && !Array.isArray(x)
const listOf = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])

const find = (node: unknown, name: string): Node[] => {
  const out: Node[] = []
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!isNode(n)) return
    if (n.name === name) out.push(n)
    listOf(n.content).forEach(walk)
  }
  walk(node)
  return out
}
const configOf = (n: unknown): Node[] => (isNode(n) ? listOf(n.config).filter(isNode) : [])
const valueOf = (n: unknown, name: string) => configOf(n).find(c => c.name === name)?.value
const cellText = (cell: unknown) =>
  listOf(isNode(cell) ? cell.content : [])
    .map(c => (typeof c === 'string' ? c : isNode(c) && typeof c.value === 'string' ? c.value : ''))
    .join('')
const rowsOf = (table: unknown) => find(table, 'row').map(row => find(row, 'cell').map(cellText))
const headerRows = (table: unknown) => find(table, 'row').map(row => valueOf(row, 'header') === true)
const spanOf = (n: unknown) => {
  const location = isNode(n) && isNode(n.location) ? n.location : {}
  const at = (x: unknown) => (isNode(x) ? x.offset : undefined)
  return [at(location.start), at(location.end)]
}
const idsOf = (found: unknown[]) => found.map(b => valueOf(b, 'id'))

// the three ways a table reads data: one source, three readers
const readers = (mime: string, body: string) => ({
  'table data:': `=begin data :key<d> :mime-type('${mime}')\n${body}=end data\n\n=table data:d\n`,
  'data-table :src': `=begin data :key<d> :mime-type('${mime}')\n${body}=end data\n\n=for data-table :src<data:d>\n`,
  'data-table body': `=begin data-table :mime-type('${mime}')\n${body}=end data-table\n`,
})

describe('rows and fields as the norm reads them', () => {
  it.each([
    ['CSV', parseCsv],
    ['TSV', parseTsv],
  ])('%s keeps empty lines and lines of spaces as rows', (_, read) => {
    expect(read('h\n\n   \nz\n')).toEqual([['h'], [''], ['   '], ['z']])
    expect(read('')).toEqual([])
    expect(read('\n')).toEqual([['']])
    expect(read('\n\n')).toEqual([[''], ['']])
    expect(read('h\n')).toEqual([['h']])
  })

  it('CSV keeps a line break inside quotes, an empty line too, in the field', () => {
    expect(parseCsv('h\n"a\n\nb"\n')).toEqual([['h'], ['a\n\nb']])
  })

  it('CSV keeps a quoted empty field at the end of the data as a record', () => {
    expect(parseCsv('h\n""')).toEqual([['h'], ['']])
  })

  it('TSV ends a line at LF only, a CR elsewhere belongs to the field', () => {
    expect(parseTsv('a\rb')).toEqual([['a\rb']])
    expect(parseTsv('a\r')).toEqual([['a\r']])
    expect(parseTsv('a\r\nb')).toEqual([['a'], ['b']])
    expect(parseTsv('\r')).toEqual([['\r']])
  })

  it('CSV refuses a quote inside an unquoted field and text after a closing quote', () => {
    expect(() => parseCsv('a"b,c')).toThrow(/a quote inside an unquoted field/)
    expect(() => parseCsv('"a"x,c')).toThrow(/text after a closing quote/)
    expect(parseCsv('"x,y","a""b"')).toEqual([['x,y', 'a"b']])
  })

  it('keeps a CR inside a TSV field in the cell', () => {
    const src =
      "=begin data :key<d> :mime-type('text/tab-separated-values; header=present')\nh\tj\na\r\tz\n=end data\n\n=table data:d\n"
    expect(rowsOf(find(parse(src), 'table')[0])).toEqual([
      ['h', 'j'],
      ['a\r', 'z'],
    ])
  })

  it('a selector reads the same TSV value with its CR', () => {
    const src = "=begin data :key<d> :mime-type('text/tab-separated-values; header=present')\nh\tj\na\r\tz\n=end data\n"
    // a CR cannot be written in an attribute value, so the value is set on the tree
    const holder = parse('=for para :status<placeholder>\nx\n')
    const status = configOf(find(holder, 'para')[0]).find(c => c.name === 'status')
    if (status) status.value = 'a\r'
    const docs: SelectorDoc[] = [
      { file: 'x.podlite', node: parse(src) },
      { file: 'y.podlite', node: holder },
    ]
    expect(runSelector('| para[ :status(in data:d#h) ]', docs).length).toBe(1)
  })
})

describe('the header in force', () => {
  const doc = (mime: string) =>
    `=begin data :key<d> :mime-type('${mime}')\nname\n Ada \n=end data\n\n=for Item :id<h> :v<name>\nH.\n\n=for Item :id<v> :v(' Ada ')\nV.\n`
  const ids = (selector: string, mime: string) =>
    idsOf(runSelector(selector, [{ file: 'x.podlite', node: parse(doc(mime)) }]))
  const failure = (selector: string, mime: string) => {
    try {
      ids(selector, mime)
      return undefined
    } catch (e) {
      return e instanceof SelectorError ? e.kind : 'other'
    }
  }

  describe.each(['text/csv', 'text/tab-separated-values'])('%s', type => {
    it('omitted: the first row is the header, for every reader and for a selector', () => {
      for (const src of Object.values(readers(type, 'name\n Ada \n')))
        expect(headerRows(find(parse(src), 'table')[0])).toEqual([true, false])
      expect(ids('| Item[ :v(in data:d) ]', type)).toEqual(['v'])
      expect(ids('| Item[ :v(in data:d#name) ]', type)).toEqual(['v'])
    })

    it('present: the same, and the heading is not a value', () => {
      expect(ids('| Item[ :v(in data:d) ]', `${type}; header=present`)).toEqual(['v'])
      expect(ids('| Item[ :v(in data:d#name) ]', `${type}; header=present`)).toEqual(['v'])
    })

    it('absent: every row is data, and no column has a name', () => {
      for (const src of Object.values(readers(`${type}; header=absent`, 'name\n Ada \n'))) {
        expect(headerRows(find(parse(src), 'table')[0])).toEqual([false, false])
        expect(diagnostics(src)).toEqual([])
      }
      expect(ids('| Item[ :v(in data:d) ]', `${type}; header=absent`)).toEqual(['h', 'v'])
      expect(failure('| Item[ :v(in data:d#name) ]', `${type}; header=absent`)).toBe('address')
    })

    it('any other value is an error; the table reads as present, a selector fails', () => {
      for (const src of Object.values(readers(`${type}; header=maybe`, 'name\n Ada \n'))) {
        expect(headerRows(find(parse(src), 'table')[0])).toEqual([true, false])
        expect(diagnostics(src)).toEqual([['error', 'table-header-invalid']])
      }
      expect(failure('| Item[ :v(in data:d) ]', `${type}; header=maybe`)).toBe('format')
      expect(failure('| Item[ :v(in data:d#name) ]', `${type}; header=maybe`)).toBe('format')
      expect(failure('| Nothing[ :v(in data:d) ]', `${type}; header=maybe`)).toBe('format')
    })

    it('reports a wrong header once, at the block it is written on, read or not', () => {
      const data = `=para x\n\n=begin data :key<d> :mime-type('${type}; header=maybe')\nname\nv\n=end data\n`
      const at = (src: string) =>
        (parse(src).diagnostics || [])
          .filter(d => String(d.code) === 'table-header-invalid')
          .map(d => [d.location.start.line, d.message])
      const message = `=data :key<d>: header=maybe is neither present nor absent, read as header=present`
      expect(at(data)).toEqual([[3, message]])
      expect(at(`${data}\n=table data:d\n\n=for data-table :src<data:d>\n\n=table data:d\n`)).toEqual([[3, message]])
    })

    it('reports a wrong header written on the data table and on its source, each at its place', () => {
      const src = `=begin data :key<d> :mime-type('${type}; header=maybe')\nname\nv\n=end data\n\n=for data-table :src<data:d> :mime-type('${type}; header=maybe')\n`
      expect((parse(src).diagnostics || []).map(d => [d.code, d.location.start.line])).toEqual([
        ['table-header-invalid', 1],
        ['table-header-invalid', 6],
      ])
    })

    it('an empty value is an error too', () => {
      expect(diagnostics(readers(`${type}; header=`, 'name\n')['data-table body'])).toEqual([
        ['error', 'table-header-invalid'],
      ])
    })

    it('reports the header of an empty source with its emptiness', () => {
      const src = `=begin data :key<e> :mime-type('${type}; header=maybe')\n=end data\n\n=table data:e\n`
      expect(diagnostics(src)).toEqual([
        ['error', 'table-header-invalid'],
        ['warning', 'table-source-empty'],
      ])
    })
  })

  it.each([['header'], ['header=Present'], ['header=yes']])('reads %s as a header the norm does not know', param => {
    expect(diagnostics(readers(`text/csv; ${param}`, 'h\nv\n')['data-table body'])).toEqual([
      ['error', 'table-header-invalid'],
    ])
  })

  it('reads a quoted value as written', () => {
    const src = readers('text/csv; header="absent"', 'h\nv\n')['data-table body']
    expect(headerRows(find(parse(src), 'table')[0])).toEqual([false, false])
    expect(diagnostics(src)).toEqual([])
  })

  it('a :mime-type given by =config does not replace the format of the source', () => {
    const src =
      "=config data-table :mime-type('text/csv; header=absent')\n\n=begin data :key<d> :mime-type('text/csv')\nh\nv\n=end data\n\n=for data-table :src<data:d>\n"
    expect(headerRows(find(parse(src), 'table')[0])).toEqual([true, false])
  })

  it('measures the rows against the header row, so a wider row loses its extra cells', () => {
    const src = "=begin data-table :mime-type('text/csv')\nh,j\na,b,c\n=end data-table\n"
    expect(rowsOf(find(parse(src), 'table')[0])).toEqual([
      ['h', 'j'],
      ['a', 'b'],
    ])
    expect((parse(src).diagnostics || []).map(d => d.message)).toEqual(['data-table row 2 has 3 of 2 cells, dropped 1'])
  })

  it(':rename acts on CSV without a header parameter, whose first row is the header', () => {
    const src = "=begin data-table :mime-type('text/csv') :rename{h => 'Head'}\nh,j\na,b\n=end data-table\n"
    expect(rowsOf(find(parse(src), 'table')[0])[0]).toEqual(['Head', 'j'])
  })

  it('leaves the header of a type that is not CSV or TSV alone', () => {
    const codes = diagnostics("=begin data-table :mime-type('text/plain; header=maybe')\nx\n=end data-table\n").map(
      d => d[1],
    )
    expect(codes).toEqual(['table-source-unreadable'])
  })

  it('keeps the header error next to an unreadable attribute of the same block', () => {
    const src = "=begin data-table :mime-type('text/csv; header=maybe') :width(abc)\nh\nv\n=end data-table\n"
    const tree = parse(src)
    const codes = (tree.diagnostics || []).map(d => d.code)
    expect(codes.filter(c => String(c) === 'table-header-invalid')).toHaveLength(1)
    expect(codes.filter(c => c === 'value-unreadable')).toHaveLength(1)
    expect((tree.diagnostics || []).every(d => d.location)).toBe(true)
  })

  it('a document with the new reports is valid by both schemas', () => {
    for (const [src, report] of <Array<[string, string[]]>>[
      [
        "=begin data-table :mime-type('text/csv; header=maybe')\nh\nv\n=end data-table\n",
        ['error', 'table-header-invalid'],
      ],
      ["=begin data-table :mime-type('text/csv')\na\"b\n=end data-table\n", ['warning', 'table-source-not-csv']],
    ]) {
      const doc = parse(src)
      expect(diagnostics(src)).toEqual([report])
      expect(validatePodliteAst(doc)).toEqual([])
      expect(validateAstTree([doc])).toEqual([])
    }
  })

  describe('a MIME type written on the data table replaces that of the source, parameters and all', () => {
    const src = (source: string, own: string) =>
      `=begin data :key<d> :mime-type('${source}')\nh\nv\n=end data\n\n=for data-table :src<data:d> :mime-type('${own}')\n`
    it.each([
      ['text/csv; header=absent', 'text/csv', [true, false], []],
      ['text/csv; header=maybe', 'text/csv', [true, false], [['error', 'table-header-invalid']]],
      ['text/csv; header=present', 'text/csv; header=maybe', [true, false], [['error', 'table-header-invalid']]],
      ['text/csv; header=present', 'text/csv; header=absent', [false, false], []],
    ])('source %s, table %s', (source, own, header, reports) => {
      expect(headerRows(find(parse(src(source, own)), 'table')[0])).toEqual(header)
      expect(diagnostics(src(source, own))).toEqual(reports)
    })
  })
})

describe('spaces at the edge of a field', () => {
  const src = "=begin data :key<d> :mime-type('text/csv; header=present')\nh,j\n a , b \n=end data\n\n=table data:d\n"

  it('are part of the cell, a no-break space as well', () => {
    expect(rowsOf(find(parse(src), 'table')[0])[1]).toEqual([' a ', ' b '])
  })

  it('are part of the value a selector reads', () => {
    const doc = `${src}\n=for Item :id<x> :v(' a ')\nX.\n`
    const found = runSelector('| Item[ :v(in data:d#h) ]', [{ file: 'x.podlite', node: parse(doc) }])
    expect(found.length).toBe(1)
  })

  it('stand around a markup code the table allows, and around text it does not', () => {
    const body = 'h\n B<x> \n'
    const allowed = parse(
      `=begin data :key<d> :mime-type('text/csv')\n${body}=end data\n\n=for table :allow<B>\ndata:d\n`,
    )
    const cell = find(find(allowed, 'table')[0], 'cell')[1]
    expect(listOf(cell.content).map(c => (typeof c === 'string' ? c : isNode(c) ? c.name ?? c.value : c))).toEqual([
      ' ',
      'B',
      ' ',
    ])
    const plain = parse(`=begin data :key<d> :mime-type('text/csv')\n${body}=end data\n\n=table data:d\n`)
    expect(cellText(find(find(plain, 'table')[0], 'cell')[1])).toBe(' B<x> ')
  })

  it('reach the HTML of the cell; Markdown squeezes them on output', () => {
    const doc = "=begin data-table :mime-type('text/csv; header=absent')\n  A  B  \n=end data-table\n"
    const tree = parse(doc)
    expect(String(toHtml({}).run(tree).toString())).toContain('<td>  A  B  </td>')
    expect(String(toMarkdown({}).run(tree).toString())).toContain('| A  B |')
  })
})

describe(':columns', () => {
  const doc = (columns: string) =>
    `=begin data-table :mime-type('text/csv') ${columns}\n" name ",name,city," 2 "\n" A ",B,C,D\n=end data-table\n`
  const picked = (columns: string) => rowsOf(find(parse(doc(columns)), 'table')[0])[1]

  it.each([
    ["(' name ')", [' A ']],
    ['<name>', ['B']],
    ['<name, city>', ['B', 'C']],
    ["(' 2 ')", ['D']],
    ['(2)', ['B']],
    ['<2>', ['B']],
    ["('2')", ['B']],
    ['<1,3>', [' A ', 'C']],
  ])(':columns%s', (value, expected) => {
    expect(picked(`:columns${value}`)).toEqual(expected)
  })
})

describe('content that is not CSV', () => {
  const body = 'h,j\n"a"x,c\n'

  it.each(Object.entries(readers('text/csv; header=present', body)))('is shown as code by %s', (_, src) => {
    const tree = parse(src)
    expect(find(tree, 'table')).toEqual([])
    const code = find(tree, 'code')
    expect(code).toHaveLength(1)
    expect(code[0].content).toEqual([{ type: 'verbatim', value: body }])
    // the place of the block that read the data, not of the data
    const reader = find(parse(src, true), src.includes('=table') ? 'table' : 'data-table')[0]
    expect(spanOf(code[0])).toEqual(spanOf(reader))
    expect(spanOf(reader)[0]).toEqual(expect.any(Number))
    expect(diagnostics(src)).toEqual([['warning', 'table-source-not-csv']])
  })

  it('reads a quote inside an unquoted field as not CSV', () => {
    expect(diagnostics(readers('text/csv', 'a"b,c\n')['data-table body'])).toEqual([
      ['warning', 'table-source-not-csv'],
    ])
  })

  it('keeps markup in the code literal, whatever the table or =config code allows', () => {
    const bad = 'h,j\na"b,B<X>\n'
    for (const src of [
      `=begin data :key<d> :mime-type('text/csv')\n${bad}=end data\n\n=for table :allow<B>\ndata:d\n`,
      `=config code :allow<B>\n\n=begin data :key<d> :mime-type('text/csv')\n${bad}=end data\n\n=table data:d\n`,
    ]) {
      const html = String(toHtml({}).run(parse(src)).toString())
      expect(html).toContain('B&lt;X&gt;')
      expect(html).not.toContain('<strong>')
    }
  })

  it('reports both mistakes of a source with a wrong header and a stray quote', () => {
    const src = readers('text/csv; header=maybe', 'h\n"a"x\n')['data-table body']
    expect(find(parse(src), 'code')).toHaveLength(1)
    expect(diagnostics(src)).toEqual([
      ['error', 'table-header-invalid'],
      ['warning', 'table-source-not-csv'],
    ])
  })

  it('is an error of the format for a selector', () => {
    const doc = `=begin data :key<d> :mime-type('text/csv')\n${body}=end data\n\n=for Item :v<a>\nX.\n`
    let kind: string | undefined
    try {
      runSelector('| Item[ :v(in data:d) ]', [{ file: 'x.podlite', node: parse(doc) }])
    } catch (e) {
      kind = e instanceof SelectorError ? e.kind : 'other'
    }
    expect(kind).toBe('format')
  })
})

describe('a padded row read from data', () => {
  const report = (src: string) =>
    (parse(src).diagnostics || []).filter(d => d.code === 'table-row-cells').map(d => d.message)

  it.each([
    ['CSV', 'text/csv', 'h,j\n\n'],
    ['TSV', 'text/tab-separated-values', 'h\tj\n\n'],
  ])('%s: an empty record is one empty cell, padded without advice', (_, type, body) => {
    const src = `=begin data :key<d> :mime-type('${type}')\n${body}=end data\n\n=table data:d\n`
    expect(rowsOf(find(parse(src), 'table')[0])).toEqual([
      ['h', 'j'],
      ['', ''],
    ])
    expect(report(src)).toEqual(['table data:d row 2 has 1 of 2 cells, padded with 1 empty'])
    expect(report(`=begin data-table :mime-type('${type}')\n${body}=end data-table\n`)).toEqual([
      'data-table row 2 has 1 of 2 cells, padded with 1 empty',
    ])
  })

  it('a table typed as text keeps the advice, a table of rows does not', () => {
    expect(report('=begin table\nA | B | C\nx | y\n=end table\n')[0]).toMatch(
      /^table row 2 has 2 of 3 cells, padded with 1 empty\. A row continued/,
    )
    expect(
      report(
        '=begin table\n=begin row :header\n=cell A\n=cell B\n=end row\n=begin row\n=cell 1\n=end row\n=end table\n',
      ),
    ).toEqual(['table row 2 has 1 of 2 cells, padded with 1 empty'])
  })
})

describe('covered data stays covered when it is shown as code', () => {
  const SECRET = 'hunter2'
  const bad = `h\na"b,${SECRET}\n`
  const render = (src: string, renderMode: string) => String(toHtml({ renderMode }).run(parse(src)).toString())
  it.each([
    ['the source', `=begin data :key<d> :masked :mime-type('text/csv')\n${bad}=end data\n\n=table data:d\n`],
    [
      'the reading table',
      `=begin data :key<d> :mime-type('text/csv')\n${bad}=end data\n\n=for table :masked\ndata:d\n`,
    ],
    [
      '=config data',
      `=config data :masked\n\n=begin data :key<d> :mime-type('text/csv')\n${bad}=end data\n\n=table data:d\n`,
    ],
    [
      'the pod around',
      `=begin pod :masked\n\n=begin data :key<d> :mime-type('text/csv')\n${bad}=end data\n\n=table data:d\n\n=end pod\n`,
    ],
    [
      'the source of a data table',
      `=begin data :key<d> :masked :mime-type('text/csv')\n${bad}=end data\n\n=for data-table :src<data:d>\n`,
    ],
    [
      '=config data, for a data table',
      `=config data :masked\n\n=begin data :key<d> :mime-type('text/csv')\n${bad}=end data\n\n=for data-table :src<data:d>\n`,
    ],
    ['the data table with a body', `=begin data-table :masked :mime-type('text/csv')\n${bad}=end data-table\n`],
  ])('masked by %s', (_, src) => {
    expect(find(parse(src), 'code')).toHaveLength(1)
    expect(render(src, 'production')).not.toContain(SECRET)
    expect(render(src, 'draft')).toContain(SECRET)
  })

  it.each([
    [
      'on the source',
      `=begin data :key<d> :masked :mime-type('text/csv')\nh\n${SECRET}\n=end data\n\n=for data-table :src<data:d>\n`,
    ],
    [
      'by =config data',
      `=config data :masked\n\n=begin data :key<d> :mime-type('text/csv')\nh\n${SECRET}\n=end data\n\n=for data-table :src<data:d>\n`,
    ],
  ])('a data table read from a source masked %s is covered', (_, src) => {
    expect(find(parse(src), 'table')).toHaveLength(1)
    expect(render(src, 'production')).not.toContain(SECRET)
    expect(render(src, 'draft')).toContain(SECRET)
  })

  it('a table read from data masked by =config is covered too', () => {
    const src = `=config data :masked\n\n=begin data :key<d> :mime-type('text/csv')\nh\n${SECRET}\n=end data\n\n=table data:d\n`
    expect(render(src, 'production')).not.toContain(SECRET)
    expect(render(src, 'draft')).toContain(SECRET)
  })
})

describe('a quote left open and a CR outside quotes', () => {
  const failureOf = (text: string) => {
    try {
      parseCsv(text)
      return undefined
    } catch (e) {
      return [e instanceof CsvError, e instanceof Error ? e.message : String(e)]
    }
  }

  it.each([
    ['\ra,b', 0],
    ['a\rb,c\n', 1],
    ['a,b\rc,d', 3],
    ['a,\rb', 2],
    ['a,\r"b"', 2],
    ['a\r"b"', 1],
    ['"a"\r,b', 3],
    ['a,b\r', 3],
    ['\r', 0],
    ['a\r\r\nb', 1],
  ])('CSV %j has a CR outside quotes at offset %i', (text, offset) => {
    expect(failureOf(text)).toEqual([true, `a carriage return outside quotes at offset ${offset}`])
  })

  it('keeps a CR inside quotes and ends a line at CRLF', () => {
    expect(parseCsv('"a\rb",c\n')).toEqual([['a\rb', 'c']])
    expect(parseCsv('"a\r\nb",c\r\n')).toEqual([['a\r\nb', 'c']])
    expect(parseCsv('a\r\nb\r\n')).toEqual([['a'], ['b']])
    expect(parseTsv('a\rb\tc')).toEqual([['a\rb', 'c']])
  })

  it.each([['"'], ['"unclosed'], ['h\n"a,b\n'], ['h\n"a,b\nz,w\n'], ['h,j\na,"tail'], ['"a""']])(
    'CSV %j leaves a quote open',
    text => {
      expect(failureOf(text)).toEqual([true, 'an unclosed quote'])
    },
  )

  it('reads an escaped quote before the closing one', () => {
    expect(parseCsv('"a"""')).toEqual([['a"']])
  })

  it.each([
    ['h\n"aaa\n', 'an unclosed quote'],
    ['h\na\rb\n', 'a carriage return outside quotes at offset 3'],
  ])('every table shows %j as code', (body, cause) => {
    for (const src of Object.values(readers('text/csv; header=present', body))) {
      const tree = parse(src)
      expect(find(tree, 'table')).toEqual([])
      const code = find(tree, 'code')
      expect(code).toHaveLength(1)
      expect(code[0].content).toEqual([{ type: 'verbatim', value: body }])
      const reader = find(parse(src, true), src.includes('=table') ? 'table' : 'data-table')[0]
      expect(spanOf(code[0])).toEqual(spanOf(reader))
      const reports = (tree.diagnostics || []).map(d => [d.severity, d.code, d.message])
      expect(reports).toEqual([['warning', 'table-source-not-csv', expect.stringContaining(cause)]])
    }
  })

  it.each([
    ['h\n"aaa\n', 'an unclosed quote'],
    ['h\na\rb\n', 'a carriage return outside quotes'],
  ])('a selector reading %j fails as a format error', (body, cause) => {
    const doc = `=begin data :key<d> :mime-type('text/csv; header=present')\n${body}=end data\n\n=for Item :v<a>\nX.\n`
    let failure: unknown
    try {
      runSelector('| Item[ :v(in data:d#h) ]', [{ file: 'x.podlite', node: parse(doc) }])
    } catch (e) {
      failure = e
    }
    expect(failure).toBeInstanceOf(SelectorError)
    expect(failure instanceof SelectorError && [failure.kind, failure.message.includes(cause)]).toEqual([
      'format',
      true,
    ])
  })
})
