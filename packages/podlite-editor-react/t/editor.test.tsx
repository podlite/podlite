import { PodliteDocument, frozenIds, podlitePluggable } from '@podlite/schema'
import dictionary from '../src/dict'
import { addVMargin, dictionaryFor, getSuggestionContextForLine, templateGetSelectionPos } from '../src/helpers'

export const parse = (str: string): PodliteDocument => {
  let podlite = podlitePluggable()
  let tree = podlite.parse(str)
  const asAst = podlite.toAstResult(tree)
  return frozenIds()(asAst.interator)
}

const pod = `
  =para test
  =Markdown
  header1
=para text
=begin Markdown
new text
=end Markdown

  `
it('Check suggestion context: pod6', () => {
  expect(getSuggestionContextForLine(pod, 1)).toEqual('pod6')
})
it('Check suggestion context: md', () => {
  expect(getSuggestionContextForLine(pod, 4)).toEqual('md')
})
it('Check suggestion context: md second block', () => {
  expect(getSuggestionContextForLine(pod, 7)).toEqual('md')
})

it('Suggestions are picked by the context', () => {
  const pod6 = dictionaryFor(dictionary, 'pod6')
  const md = dictionaryFor(dictionary, 'md')
  expect(pod6.length).toBeGreaterThan(0)
  expect(md.length).toBeGreaterThan(0)
  // an entry with no language of its own belongs to Podlite
  expect(pod6.every(({ lang }) => lang === undefined || lang === 'pod6')).toBe(true)
  expect(md.every(({ lang }) => lang === 'md')).toBe(true)
  expect(md.map(({ text }) => text)).toContain('# ')
  expect(pod6.map(({ text }) => text)).not.toContain('# ')
})

it('Selection position', () => {
  const pod = `=begin pod
{test}
=end pod
`
  const { text, ...pos } = templateGetSelectionPos(pod) || {}
  expect(pos).toEqual({
    start: { line: 1, offset: 0 },
    end: { line: 1, offset: 6 },
  })
})

it('Selection empty position 1', () => {
  const pod = `=begin pod
{test
=end pod
`
  const pos = templateGetSelectionPos(pod)
  expect(pos).toBeNull
})

it('Selection empty position 2', () => {
  const pod = `=begin pod
{}test
=end pod
`
  const { start, end } = templateGetSelectionPos(pod) || {}
  expect({ start, end }).toEqual({
    start: { line: 1, offset: 0 },
    end: { line: 1, offset: 0 },
  })
})

it('Test addVMargin 4', () => {
  const pod = `=begin pod
test
=end pod`
  const pod2 = `=begin pod
    test
    =end pod`
  const vpod = addVMargin(4, pod)
  expect(vpod).toEqual(pod2)
})

it('Test addVMargin 0', () => {
  const pod = `=begin pod
test
=end pod`
  const vpod = addVMargin(0, pod)
  expect(vpod).toEqual(pod)
})
