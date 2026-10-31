import { podlitePluggable, validateAst, validatePodliteAst } from '../src'
// const describe = ( _ , f)=> f()
// const it = (_,  f) => f()
// const expect = (any):any=>{
//     const c=(any):any=>{}
//     c.toEqual = ()=>{}
//     return c
// }

describe('Check validateAst', () => {
  it('should ok for Test', () => {
    const r = validateAst({ ters: '1' }, 'Test')
    expect(r).toEqual([])
  })
  it('should ok for simple PodNode', () => {
    const test = [
      {
        type: 'block',
        content: [
          {
            type: 'blankline',
          },
        ],
        name: 'pod',
        margin: '',
        config: [],
        location: {
          start: {
            offset: 0,
            line: 1,
            column: 1,
          },
          end: {
            offset: 82,
            line: 10,
            column: 1,
          },
        },
      },
    ]
    const r = validateAst(test)
    expect(r).toEqual([])
  })
})

describe('table cell content', () => {
  const validate = (src: string) => validatePodliteAst(podlitePluggable().parse(src, { podMode: 1 }))
  const table = (cell: string) => `=begin table\n A | B\n ==|==\n 1 | ${cell}\n=end table\n`

  it('plain text cell', () => {
    expect(validate(table('text'))).toEqual([])
  })
  it('cell with code markup', () => {
    expect(validate(table('the C<cron> folder is empty'))).toEqual([])
  })
  it('cell with two markup codes', () => {
    expect(validate(table('C<a> and B<b>'))).toEqual([])
  })
  it('cell with a link', () => {
    expect(validate(table('L<text|http://example.org>'))).toEqual([])
  })
  it('cell written as a block', () => {
    expect(validate('=begin table\n=begin row :header\n=cell Name\n=end row\n=end table\n')).toEqual([])
  })
})

// The schema is generated from the types, so every case below is a shape the
// parser produces and the types had to be taught. Each one made the check
// unusable on a whole class of documents while it was missing.
describe('shapes the parser produces', () => {
  const validate = (src: string) => validatePodliteAst(podlitePluggable().parse(src, { podMode: 1 }))

  describe('a list', () => {
    it('accepts an item carrying a checkbox', () => {
      expect(validate('=item [ ] a task\n')).toEqual([])
      expect(validate('=item [x] a task that is done\n')).toEqual([])
    })

    it('accepts a plain item as it always did', () => {
      expect(validate('=item a plain item\n')).toEqual([])
    })

    it('accepts the terms of a definition', () => {
      expect(validate('=defn Term\nthe meaning\n')).toEqual([])
    })

    it('accepts a term holding markup', () => {
      expect(validate('=defn C<Term>\nthe meaning\n')).toEqual([])
    })

    it('accepts items at several levels', () => {
      expect(validate('=item1 one\n=item2 nested\n=item1 two\n')).toEqual([])
    })
  })

  describe('a markup code', () => {
    const codes = 'A B C D E F H I J K L N O R S T U V W X Z'.split(' ')

    it.each(codes)('accepts %s written around text', code => {
      expect(validate(`=pod\n\ntext ${code}<inner> tail\n`)).toEqual([])
    })

    it('accepts one code nested in another', () => {
      expect(validate('=pod\n\ntext C<B<inner>> tail\n')).toEqual([])
    })

    it('accepts a code written empty', () => {
      expect(validate('=pod\n\ntext C<> tail\n')).toEqual([])
    })
  })

  describe('a semantic block', () => {
    it('accepts one holding more than a single paragraph', () => {
      const src = '=begin pod\n\n=begin DESCRIPTION\ntext\n\n=item one\n=item two\n\n=end DESCRIPTION\n\n=end pod\n'
      expect(validate(src)).toEqual([])
    })

    it('accepts one holding a block of code', () => {
      const src = '=begin pod\n\n=begin DESCRIPTION\n=begin code\nx\n=end code\n=end DESCRIPTION\n\n=end pod\n'
      expect(validate(src)).toEqual([])
    })
  })

  describe('a table of contents', () => {
    it('accepts the entries the parser builds for it', () => {
      expect(validate('=toc head1\n\n=head1 One\n\ntext\n')).toEqual([])
    })
  })
})

describe('the mark of markdown in the schema of the tree', () => {
  // the generated schema holds every type under its definitions
  const { definitions } = require('../schema/AstTree.json')
  const Ajv = require('ajv')
  const ajv = new Ajv({ strict: false, allowUnionTypes: true, strictTuples: false })
  const check = (name: string, node: object) => ajv.validate({ $ref: `#/definitions/${name}`, definitions }, node)
  const shapes: Record<string, object> = {
    BlockNamed: {
      type: 'block',
      name: 'Html',
      location: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 4, line: 1, column: 5 } },
      content: [],
      margin: '',
    },
    RootBlock: { type: 'block', name: 'root', content: [], margin: '' },
    TableRow: { type: 'block', name: 'row', content: [] },
    TableHead: { type: 'block', name: 'row', content: [] },
    TableCell: { type: 'block', name: 'cell', content: [] },
  }

  it.each(Object.keys(shapes))('lets %s go without the mark or with markdown, and refuses another value', name => {
    const node = shapes[name]
    expect(definitions[name].properties.sourceFormat).toEqual({ const: 'markdown', type: 'string' })
    expect(definitions[name].required || []).not.toContain('sourceFormat')
    expect(check(name, node)).toBe(true)
    expect(check(name, { ...node, sourceFormat: 'markdown' })).toBe(true)
    expect(check(name, { ...node, sourceFormat: 'podlite' })).toBe(false)
    expect(check(name, { ...node, sourceFormat: 7 })).toBe(false)
  })
})
