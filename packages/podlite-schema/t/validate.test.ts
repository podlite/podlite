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
    expect(validate(table('текст'))).toEqual([])
  })
  it('cell with code markup', () => {
    expect(validate(table('каталог C<cron> пуст'))).toEqual([])
  })
  it('cell with two markup codes', () => {
    expect(validate(table('C<a> и B<b>'))).toEqual([])
  })
  it('cell with a link', () => {
    expect(validate(table('L<текст|http://example.org>'))).toEqual([])
  })
  it('cell written as a block', () => {
    expect(validate('=begin table\n=begin row :header\n=cell Имя\n=end row\n=end table\n')).toEqual([])
  })
})
