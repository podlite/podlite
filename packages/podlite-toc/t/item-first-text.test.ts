import { getFromTree, podlitePluggable } from '@podlite/schema'
import { getContentForToc } from '../src/index'

const entry = (src: string) => {
  const p = podlitePluggable()
  const [item] = getFromTree(p.toAst(p.parse(src)), 'item')
  return getContentForToc(item)
}

describe('the entry of an item in a table of contents', () => {
  it.each([
    ['after a blank line', '=begin item\n\nText\n=end item\n', 'Text'],
    ['after =config', '=begin item\n=config para :x\nText\n=end item\n', 'Text'],
    ['after =alias', '=begin item\n=alias A x\nText\n=end item\n', 'Text'],
  ])('is the first text %s', (_, src, text) => {
    expect(entry(src).trim()).toBe(text)
  })

  it.each([
    ['implicit code first', '=begin item\n  code\n=end item\n', 'code'],
    ['implicit code before a later paragraph', '=begin item\n  code\n\nlater\n=end item\n', 'code'],
    ['a line on the first line', '=item first\n', 'first'],
    ['implicit code after a blank line', '=begin item\n\n  code\n=end item\n', 'code'],
  ])('keeps %s as before', (_, src, text) => {
    expect(entry(src).trim()).toBe(text)
  })
})

describe('the entry of an item with no text', () => {
  it('is empty when the item holds only blank lines, not its caption', () => {
    expect(entry('=begin item :caption<C>\n\n=end item\n')).toBe('')
  })

  it('is its caption when the item holds nothing at all, as before', () => {
    expect(entry('=begin item :caption<C>\n=end item\n')).toBe('C')
  })
})
