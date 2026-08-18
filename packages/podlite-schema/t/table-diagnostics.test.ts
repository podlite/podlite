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
