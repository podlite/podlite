import { toHtml, toMarkdown, expandAlias, ALIAS_EXPANSION_DEPTH, MARKUP_CODE_DEPTH_LIMIT } from '../src'
import { readCodes } from '../src/codes/read'
import { podlitePluggable } from '../src'

const html = (src: string) => toHtml({}).run(src).toString()
const markdown = (src: string) => toMarkdown({}).run(src).toString()
const count = (text: string, part: string) => text.split(part).length - 1
const nested = (n: number) => 'B<'.repeat(n) + 'x' + '>'.repeat(n)

let warn: jest.SpyInstance
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => warn.mockRestore())
const warnings = () => warn.mock.calls.map(c => String(c[0]))

describe('an alias that expands into itself', () => {
  it('is written as it stands and named once', () => {
    expect(html('=alias X A<X>\n\nA<X> and text\n')).toContain('A&lt;X&gt; and text')
    expect(warnings()).toEqual(['[podlite] alias X expands into itself: X → X'])
  })

  it('names the whole cycle, in markdown too', () => {
    expect(markdown('=alias X A<Y>\n=alias Y A<X>\n\nA<X>\n')).toContain('A<X>')
    expect(warnings()).toEqual(['[podlite] alias X expands into itself: X → Y → X'])
  })
})

describe('the depth of an alias expansion', () => {
  // a chain of n aliases, the last one plain text
  const chain = (n: number) =>
    Array.from({ length: n }, (_, i) => `=alias X${i + 1} ${i + 1 === n ? 'end' : `A<X${i + 2}>`}`).join('\n') +
    '\n\nA<X1>\n'

  it('expands a short chain as before', () => {
    expect(html(chain(3))).toContain('end')
    expect(warnings()).toEqual([])
  })

  it(`expands a chain of ${ALIAS_EXPANSION_DEPTH}`, () => {
    expect(html(chain(ALIAS_EXPANSION_DEPTH))).toContain('end')
    expect(warnings()).toEqual([])
  })

  it(`stops at the ${ALIAS_EXPANSION_DEPTH + 1}th and says so`, () => {
    const out = html(chain(ALIAS_EXPANSION_DEPTH + 1))
    expect(out).not.toContain('end')
    expect(out).toContain('A&lt;X9&gt;')
    expect(warnings()).toEqual([
      '[podlite] alias X9 expands deeper than 8 levels: X1 → X2 → X3 → X4 → X5 → X6 → X7 → X8 → X9',
    ])
  })

  it('stops a doubling chain at the depth, quickly and with one warning', () => {
    const src =
      Array.from({ length: 21 }, (_, i) => `=alias X${i} ${i === 20 ? 'x' : `A<X${i + 1}>A<X${i + 1}>`}`).join('\n') +
      '\n\nA<X0>\n'
    const out = markdown(src)
    expect(count(out, 'A<X8>')).toBe(256)
    expect(warnings()).toHaveLength(1)
  })
})

describe('the budget of one alias expansion', () => {
  const many = (use: string) => `=alias Y x\n=alias X ${Array(10001).fill(use).join(' ')}\n\nA<X> tail\n`

  it('keeps the refused uses as written and the text after them', () => {
    const out = markdown(many('A<Y>'))
    expect(count(out, 'x')).toBe(9999)
    expect(out).toMatch(/x A<Y> A<Y> tail/)
    expect(warnings()).toEqual(['[podlite] alias expansion X makes more than 10000 replacements'])
  })

  it('is shared through the copies of the context', () => {
    const out = markdown(many('S<A<Y>>'))
    expect(count(out, 'x')).toBe(9999)
    expect(warnings()).toHaveLength(1)
  })

  it('is not shared by independent uses', () => {
    const src = `=alias Y x\n=alias X ${Array(6000).fill('A<Y>').join(' ')}\n\nA<X>\n\nA<X>\n`
    expect(count(markdown(src), 'x')).toBe(12000)
    expect(warnings()).toEqual([])
  })

  it('leaves nothing behind for the next run', () => {
    const src = '=alias X A<X>\n\nA<X>\n'
    expect(html(src)).toBe(html(src))
    expect(warnings()).toHaveLength(2)
  })
})

describe('an expansion walked later', () => {
  it('starts an expansion of its own', () => {
    const ctx: { [key: string]: any } = {}
    let later: (() => unknown) | undefined
    const told: string[] = []
    const first = expandAlias(
      ctx,
      'X',
      () =>
        (later = () =>
          expandAlias(
            ctx,
            'X',
            () => 'again',
            m => told.push(m),
          )),
      m => told.push(m),
    )
    expect(first.expanded).toBe(true)
    expect(later!()).toEqual({ expanded: true, result: 'again' })
    expect(told).toEqual([])
  })

  it('a footnote that names its own alias ends', () => {
    expect(html('=alias X N<A<X>>\n\nA<X>\n')).toContain('class="footnote"')
  })
})

describe('markup codes nested past the limit', () => {
  it(`reads ${MARKUP_CODE_DEPTH_LIMIT} levels and says nothing`, () => {
    const issues: any[] = []
    readCodes(nested(MARKUP_CODE_DEPTH_LIMIT), { issues })
    expect(issues).toEqual([])
  })

  it('writes the deeper ones out as text, with one warning', () => {
    const issues: any[] = []
    const out = readCodes(nested(MARKUP_CODE_DEPTH_LIMIT + 1), { issues })
    let node: any = out[0]
    let depth = 0
    while (node && typeof node === 'object') {
      depth++
      node = node.content[0]
    }
    expect(depth).toBe(MARKUP_CODE_DEPTH_LIMIT)
    expect(node).toBe('B<x>')
    expect(issues.map(i => i.code)).toEqual(['markup-code-too-deep'])
  })

  it('says nothing about a code past the limit that stands where text is kept as written', () => {
    const issues: any[] = []
    readCodes('B<'.repeat(31) + 'A<I<x>> L<y|I<B<z>>>' + '>'.repeat(31), { issues })
    expect(issues).toEqual([])
  })

  it('says nothing about the text it no longer reads as codes, and keeps what it says above the limit', () => {
    const issues: any[] = []
    readCodes('I<open ' + 'B«'.repeat(40) + 'I<x B«>y»' + '»'.repeat(40), { issues })
    expect(issues.map(i => i.code).sort()).toEqual(['markup-code-too-deep', 'markup-code-unclosed'])
    expect(issues.find(i => i.code === 'markup-code-unclosed').start).toBe(0)
  })

  it('shows nothing past the limit that the codes would hide', () => {
    const out = html(`=para\n${'B<'.repeat(32)}Z<secret>and G<hidden> I<B<x>>${'>'.repeat(32)}\n`)
    expect(out).not.toContain('secret')
    expect(out).not.toContain('hidden')
    expect(out).toContain('I&lt;B&lt;x&gt;&gt;')
  })

  it('a thousand levels parse and render, and the parser tells it', () => {
    const src = `=para\n${nested(1000)}\n`
    const diagnostics: any[] = []
    const p = podlitePluggable()
    p.parse(src, { podMode: 1, diagnostics } as any)
    expect(diagnostics.map(d => d.code)).toEqual(['markup-code-too-deep'])
    const out = html(src)
    expect(count(out, '<strong>')).toBe(MARKUP_CODE_DEPTH_LIMIT)
    expect(out).toContain('B&lt;B&lt;')
    expect(markdown(src)).toContain('B<B<')
  })

  it(`holds ${ALIAS_EXPANSION_DEPTH} expansions of ${MARKUP_CODE_DEPTH_LIMIT - 1} levels each`, () => {
    const w = (x: string) => 'B<'.repeat(MARKUP_CODE_DEPTH_LIMIT - 1) + x + '>'.repeat(MARKUP_CODE_DEPTH_LIMIT - 1)
    const src =
      Array.from({ length: 8 }, (_, i) => `=alias X${i} ${w(i === 7 ? 'x' : `A<X${i + 1}>`)}`).join('\n') +
      `\n\n${w('A<X0>')}\n`
    expect(count(html(src), '<strong>')).toBe(9 * (MARKUP_CODE_DEPTH_LIMIT - 1))
    expect(count(markdown(src), '**')).toBe(2 * 9 * (MARKUP_CODE_DEPTH_LIMIT - 1))
  })
})
