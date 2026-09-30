import { runSelector, SelectorError } from '../src/selectors'
import { podlitePluggable } from '../src/pluggableParser'

const read = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}
const guide = {
  file: 'guide.podlite',
  node: read('=NAME Guide\n\n=defn draft\nA draft.\n\n=for Invoice :type<draft>\nA\n'),
}
const vocabulary = { file: 'vocabulary.podlite', node: read('=NAME Vocabulary\n\n=defn draft\nNot final.\n') }
const selector = (operand: string): string => `Invoice[ :type(in ${operand} | defn) ]`

describe('an operand source read by the host', () => {
  it('is asked of readSource with its scheme', () => {
    const asked: string[] = []
    const readSource = (scheme: string, document: string) => {
      asked.push(`${scheme}:${document}`)
      return [vocabulary]
    }
    expect(runSelector(selector('doc:Vocabulary'), [guide], { readSource }).length).toBe(1)
    expect(runSelector(selector('file:vocabulary.podlite'), [guide], { readSource }).length).toBe(1)
    expect(asked).toEqual(['doc:Vocabulary', 'file:vocabulary.podlite'])
  })

  it('falls back to the documents given when readSource does not know a name', () => {
    const readSource = () => undefined
    expect(runSelector(selector('doc:Guide'), [guide], { readSource }).length).toBe(1)
    expect(() => runSelector(selector('doc:Absent'), [guide], { readSource })).toThrow(SelectorError)
    expect(() => runSelector(selector('file:absent.podlite'), [guide], { readSource })).toThrow(SelectorError)
  })

  it('lets the reason readSource throws reach the caller', () => {
    const readSource = () => {
      throw new SelectorError('resolution', 'the source does not resolve: doc:Same: two documents')
    }
    expect(() => runSelector(selector('doc:Same'), [guide], { readSource })).toThrow('doc:Same: two documents')
  })

  it('reads as before without readSource', () => {
    expect(runSelector(selector('doc:Guide'), [guide]).length).toBe(1)
    expect(() => runSelector(selector('doc:Vocabulary'), [guide])).toThrow(SelectorError)
  })
})
