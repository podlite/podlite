import * as path from 'path'
import { runLint } from '../src/lint'
import {
  scanSourceRules,
  ATTR_CONTINUATION_DROPPED_RULE_ID,
  attrContinuationDroppedRule,
} from '../src/lint/grammar/scan'

const FIXTURES = path.join(__dirname, 'lint-fixtures')

describe('attr-continuation-dropped rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(ATTR_CONTINUATION_DROPPED_RULE_ID).toBe('attr-continuation-dropped')
    expect(attrContinuationDroppedRule.id).toBe('attr-continuation-dropped')
    expect(attrContinuationDroppedRule.severity).toBe('warning')
  })

  it('flags indented attribute after =begin', () => {
    const v = scanSourceRules('=begin pod :id<x>\n  :tag<y>\n=end pod\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged).toHaveLength(1)
    expect(flagged[0].message).toMatch(/attribute :tag<…>/)
    expect(flagged[0].severity).toBe('warning')
  })

  it('flags indented attribute after =for', () => {
    const v = scanSourceRules('=for defn :id<x>\n  :super<y>\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged).toHaveLength(1)
    expect(flagged[0].message).toMatch(/attribute :super<…>/)
  })

  it('flags every continuation attribute in a chain', () => {
    const v = scanSourceRules('=begin pod :id<x>\n  :a<1>\n  :b<2>\n  :c<3>\n=end pod\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged).toHaveLength(3)
  })

  it('does not flag indented attribute after blank line', () => {
    const v = scanSourceRules('=begin pod :id<x>\n\n  :tag<y>\n=end pod\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged).toEqual([])
  })

  it('does not flag indented attribute after content line', () => {
    const v = scanSourceRules('=begin pod :id<x>\nsome text\n  :tag<y>\n=end pod\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged).toEqual([])
  })

  it('does not flag attribute on the directive line itself', () => {
    const v = scanSourceRules('=begin pod :id<x> :tag<y>\n=end pod\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged).toEqual([])
  })

  it('does not flag indented attribute after =end', () => {
    const v = scanSourceRules('=begin pod :id<x>\n=end pod\n  :tag<y>\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged).toEqual([])
  })

  it('does not flag in pure markdown content', () => {
    const v = scanSourceRules('# Heading\n\n  :tag<looks like attr but no directive>\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged).toEqual([])
  })

  it('reports line and column of the indented attribute', () => {
    const v = scanSourceRules('=begin pod :id<x>\n  :tag<y>\n=end pod\n')
    const flagged = v.filter(d => d.rule === 'attr-continuation-dropped')
    expect(flagged[0].location?.start.line).toBe(2)
    expect(flagged[0].location?.start.column).toBe(1)
  })
})

describe('runLint attr-continuation-dropped integration', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  it('non-strict + continuation attrs → exit 0 with warnings emitted', () => {
    const code = runLint([path.join(FIXTURES, 'attr-continuation-broken.podlite')], {
      strict: false,
      format: 'text',
    })
    expect(code).toBe(0)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/warning: attribute :superseded-by.*\(attr-continuation-dropped\)/)
    expect(out).toMatch(/warning: attribute :rejection-reason/)
  })

  it('strict + continuation attrs → exit 1', () => {
    const code = runLint([path.join(FIXTURES, 'attr-continuation-broken.podlite')], {
      strict: true,
      format: 'text',
    })
    expect(code).toBe(1)
  })

  it('=for + indented attr fixture → warning emitted', () => {
    const code = runLint([path.join(FIXTURES, 'attr-continuation-for-broken.podlite')], {
      strict: false,
      format: 'text',
    })
    expect(code).toBe(0)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/warning: attribute :synonym/)
  })

  it('blank line clears state → no warning', () => {
    const code = runLint([path.join(FIXTURES, 'attr-continuation-blank-clears.podlite')], {
      strict: true,
      format: 'text',
    })
    expect(code).toBe(0)
  })

  it('content line clears state → no warning', () => {
    const code = runLint([path.join(FIXTURES, 'attr-continuation-content-clears.podlite')], {
      strict: true,
      format: 'text',
    })
    expect(code).toBe(0)
  })

  it('flat attributes on directive line → no warning', () => {
    const code = runLint([path.join(FIXTURES, 'attr-continuation-clean.podlite')], {
      strict: true,
      format: 'text',
    })
    expect(code).toBe(0)
  })
})
