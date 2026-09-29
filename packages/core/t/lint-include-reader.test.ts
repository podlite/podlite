import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const seen: Array<{ file: string; config: unknown }> = []

jest.mock('../src/reader', () => {
  const actual = jest.requireActual('../src/reader')
  return {
    ...actual,
    readerFor: (parser, options) => {
      const read = actual.readerFor(parser, options)
      return (text, file, config, extras) => {
        seen.push({ file, config })
        if (file.endsWith('broken.podlite')) throw new Error('plugin failed')
        return read(text, file, config, extras)
      }
    },
  }
})

import { lintFile } from '../src/lint'
import { INCLUDE_RESOLVES_RULE_ID } from '../src/lint/rules/include-resolves'

const dir = mkdtempSync(join(tmpdir(), 'podlite-include-reader-'))
writeFileSync(join(dir, 'part.podlite'), '=begin pod\n=begin code\nB<x>\n=end code\n=end pod\n')
writeFileSync(join(dir, 'broken.podlite'), '=pod\n\nText.\n')

const lint = (name: string, src: string) => {
  const file = join(dir, name)
  writeFileSync(file, src)
  return lintFile(file, {}).violations.filter(v => v.rule === INCLUDE_RESOLVES_RULE_ID)
}

describe('how the include check reads an included file', () => {
  it('with the settings in effect at the directive', () => {
    seen.length = 0
    lint('book.podlite', '=begin pod\n=config code :allow<B>\n\n=include file:./part.podlite\n=end pod\n')
    const placed = seen.filter(s => s.file.endsWith('part.podlite') && s.config)
    expect(placed.length).toBe(1)
    expect(placed[0].config).toEqual({ code: expect.anything() })
  })

  it('a file whose reading throws costs one finding, and the others stay', () => {
    const found = lint('two.podlite', '=pod\n\n=include file:./broken.podlite\n\n=include file:./absent.podlite\n')
    expect(found.map(v => v.location?.start.line)).toEqual([3, 5])
    expect(found.map(v => v.message).join('\n')).not.toMatch(/could not be checked/)
  })
})
