import * as path from 'path'

const config = require(path.join(__dirname, '..', '..', '..', 'jest.config.js'))

// Coverage is read as a statement about the tests. Counting build output and
// generated parsers makes it a statement about the build instead, and the
// figure moves when nobody has written a line.
describe('what coverage counts', () => {
  const ignored: string[] = config.coveragePathIgnorePatterns || []
  const matches = (file: string) => ignored.some(p => new RegExp(p).test(file))

  it('declares what is not written by hand', () => {
    expect(ignored.length).toBeGreaterThan(0)
  })

  it('leaves out the build output that repeats the sources', () => {
    expect(matches('/repo/packages/core/lib/cli.js')).toBe(true)
    expect(matches('/repo/packages/podlite-schema/esm/index.js')).toBe(true)
  })

  it('leaves out the parsers a generator writes', () => {
    expect(matches('/repo/packages/podlite-schema/src/grammar.js')).toBe(true)
    expect(matches('/repo/packages/podlite-schema/src/grammarfc.js')).toBe(true)
    expect(matches('/repo/packages/core/src/lint/grammar/lint.js')).toBe(true)
  })

  it('leaves out the tests themselves', () => {
    expect(matches('/repo/packages/core/t/lint.test.ts')).toBe(true)
    expect(matches('/repo/packages/podlite-publisher/t/plugins.spec.ts')).toBe(true)
  })

  it('keeps the code a person edits', () => {
    expect(matches('/repo/packages/core/src/cli.ts')).toBe(false)
    expect(matches('/repo/packages/podlite-schema/src/selectors.ts')).toBe(false)
    expect(matches('/repo/packages/core/src/lint/grammar/scan.ts')).toBe(false)
  })
})
