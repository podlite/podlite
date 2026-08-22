import { toHtml } from '@podlite/schema'
import { podlite } from '../src/index'

const p = podlite({ importPlugins: true })
const treeOf = (source: string, mode: 'md' | 'pod') =>
  p.toAst(p.parse(source, mode === 'md' ? { mode: 'md' } : { podMode: 1 }))
const htmlOf = (source: string, mode: 'md' | 'pod') => String(toHtml({}).run(treeOf(source, mode)).toString())

const tableNode = (tree: any): any => {
  if (!tree || typeof tree !== 'object') return null
  if (tree.name === 'table') return tree
  for (const child of tree.content || []) {
    const found = tableNode(child)
    if (found) return found
  }
  return null
}

const aligned = ['| Left | Middle | Right |', '|:-----|:------:|------:|', '| a    | b      | c     |', ''].join('\n')

describe('column alignment', () => {
  it('is read from the separator line into the table', () => {
    expect(tableNode(treeOf(aligned, 'md')).align).toEqual(['left', 'center', 'right'])
  })

  it('reaches the heading cells', () => {
    const html = htmlOf(aligned, 'md')
    expect(html).toContain('<th style="text-align:left">Left</th>')
    expect(html).toContain('<th style="text-align:center">Middle</th>')
    expect(html).toContain('<th style="text-align:right">Right</th>')
  })

  it('reaches the body cells', () => {
    const html = htmlOf(aligned, 'md')
    expect(html).toContain('<td style="text-align:left">a</td>')
    expect(html).toContain('<td style="text-align:center">b</td>')
    expect(html).toContain('<td style="text-align:right">c</td>')
  })

  it('leaves a column alone when the separator says nothing', () => {
    const plain = ['| Left | Right |', '|------|------:|', '| a    | b     |', ''].join('\n')
    const html = htmlOf(plain, 'md')
    expect(html).toContain('<th>Left</th>')
    expect(html).toContain('<th style="text-align:right">Right</th>')
  })

  it('is absent from a table written in Podlite', () => {
    const pod = ['=begin table', ' Left | Right', ' =====|======', ' a    | b', '=end table', ''].join('\n')
    expect(tableNode(treeOf(pod, 'pod')).align).toBeUndefined()
    expect(htmlOf(pod, 'pod')).not.toContain('text-align')
  })
})
