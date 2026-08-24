import { readFileSync } from 'fs'
import { join } from 'path'
import { BLOCK_NAMES, VERBATIM_BLOCKS, isVerbatimBlock, isKnownBlockName, isNamedBlockName } from '../src/block-names'

const grammarSource = readFileSync(join(__dirname, '..', 'src', 'grammar.pegjs'), 'utf8')

const fallbackList = () => {
  const body = grammarSource.slice(grammarSource.indexOf('function knownBlockNames'))
  const list = body.slice(body.indexOf('['), body.indexOf(']'))
  return [...list.matchAll(/'([a-z][a-z-]*)'/g)].map(m => m[1]).sort()
}

describe('the shared list of block names', () => {
  it('the grammar fallback matches it', () => {
    expect(fallbackList()).toEqual([...BLOCK_NAMES].sort())
  })

  it('every verbatim block is a known block', () => {
    expect(VERBATIM_BLOCKS.filter(n => !isKnownBlockName(n))).toEqual([])
  })

  it('tells verbatim blocks from the rest', () => {
    expect(isVerbatimBlock('code')).toBe(true)
    expect(isVerbatimBlock('markdown')).toBe(true)
    expect(isVerbatimBlock('para')).toBe(false)
    expect(isVerbatimBlock('pod')).toBe(false)
  })
})

describe('a name carrying both cases', () => {
  it('is read as a named block', () => {
    expect(isNamedBlockName('Markdown')).toBe(true)
    expect(isNamedBlockName('Xhtml')).toBe(true)
    expect(isNamedBlockName('markdown')).toBe(false)
    expect(isNamedBlockName('DESCRIPTION')).toBe(false)
  })

  it('holds its body as written, like the listed names do', () => {
    expect(isVerbatimBlock('Markdown')).toBe(true)
    expect(isVerbatimBlock('Diagram')).toBe(true)
  })

  it('leaves the listed and the plain names as they were', () => {
    expect(isVerbatimBlock('code')).toBe(true)
    expect(isVerbatimBlock('para')).toBe(false)
    expect(isVerbatimBlock('DESCRIPTION')).toBe(false)
  })
})
