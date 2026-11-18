/**
 * @jest-environment jsdom
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// shiki and the grammar package are both stand-ins here: the test watches what the
// adapter asks of them, the real grammar is tested in @podlite/textmate
const mockShiki = {
  loads: [] as unknown[],
  html: [] as Array<{ code: string; lang: string }>,
  rejectNext: 0,
  hold: null as null | Promise<void>,
}
const mockTextmate = { evaluations: 0, fail: false }

jest.mock('shiki', () => ({
  bundledLanguages: { javascript: {}, js: {}, raku: {} },
  createHighlighter: async () => ({
    loadLanguage: async (lang: unknown) => {
      mockShiki.loads.push(lang)
      if (mockShiki.hold) await mockShiki.hold
      if (mockShiki.rejectNext > 0) {
        mockShiki.rejectNext--
        throw new Error('grammar refused')
      }
    },
    codeToHtml: (code: string, options: { lang: string }) => {
      mockShiki.html.push({ code, lang: options.lang })
      return `<pre class="shiki"><code>${code}</code></pre>`
    },
  }),
}))

jest.mock('@podlite/textmate', () => {
  mockTextmate.evaluations++
  if (mockTextmate.fail) throw new Error('grammar module failed to load')
  return { podliteGrammar: { name: 'podlite', scopeName: 'text.podlite', patterns: [], repository: {} } }
})

type Adapter = typeof import('../src/shiki')

// every test starts with a fresh registry: the adapter keeps one highlighter per process,
// and the grammar module is required later, asynchronously, so it has to come from the
// same fresh registry (jest.isolateModules covers only what is required inside it)
const fresh = (): Adapter => require('../src/shiki')

const grammarLoads = () => mockShiki.loads.filter(l => typeof l === 'object')

beforeEach(() => {
  jest.resetModules()
  mockShiki.loads = []
  mockShiki.html = []
  mockShiki.rejectNext = 0
  mockShiki.hold = null
  mockTextmate.evaluations = 0
  mockTextmate.fail = false
})

describe('Podlite names', () => {
  it.each(['podlite', 'POD6', 'rakudoc'])('%s is the Podlite grammar', async name => {
    expect(await fresh().normalizeLanguage(name)).toBe('podlite')
  })

  it('highlights with the grammar object of @podlite/textmate under the name podlite', async () => {
    await fresh().codeToThemedHtml({ code: '=head1 Title', language: 'pod6', theme: 'dark' })
    expect(grammarLoads()).toEqual([expect.objectContaining({ scopeName: 'text.podlite' })])
    expect(mockShiki.html).toEqual([{ code: '=head1 Title', lang: 'podlite' }])
  })

  it('loads the grammar once for two requests at the same time', async () => {
    const adapter = fresh()
    let release = () => {}
    mockShiki.hold = new Promise<void>(resolve => (release = resolve))
    const both = Promise.all([adapter.getHighlighter('pod6'), adapter.getHighlighter('rakudoc')])
    await new Promise(resolve => setTimeout(resolve, 0))
    release()
    await both
    expect(grammarLoads()).toHaveLength(1)
  })

  it('keeps the grammar once it has loaded', async () => {
    const adapter = fresh()
    await adapter.getHighlighter('podlite')
    await adapter.getHighlighter('pod6')
    await adapter.getHighlighter('rakudoc')
    expect(grammarLoads()).toHaveLength(1)
  })
})

describe('other languages are left as they were', () => {
  it('js and javascript are languages of shiki', async () => {
    const adapter = fresh()
    expect(await adapter.normalizeLanguage('js')).toBe('js')
    expect(await adapter.normalizeLanguage('javascript')).toBe('javascript')
  })

  it('raku stays the language of shiki', async () => {
    expect(await fresh().normalizeLanguage('raku')).toBe('raku')
  })

  it('an unknown name falls back to plain text with one warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const adapter = fresh()
    expect(await adapter.normalizeLanguage('klingon')).toBe('txt')
    expect(await adapter.normalizeLanguage('klingon')).toBe('txt')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('a JavaScript block never loads the Podlite grammar module', async () => {
    await fresh().codeToThemedHtml({ code: 'const x = 1', language: 'javascript', theme: 'dark' })
    expect(mockTextmate.evaluations).toBe(0)
    expect(grammarLoads()).toEqual([])
  })
})

describe('when the grammar cannot be had', () => {
  const block = {
    type: 'block',
    name: 'code',
    content: [{ type: 'verbatim', value: '=head1 Title' }],
    config: [{ name: 'lang', value: 'podlite' }],
  }

  it('the block stays plain code and the next request tries again', async () => {
    mockTextmate.fail = true
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    // React, the component and the adapter from the same fresh registry, so the hooks see one React
    const React = require('react')
    const { createRoot } = require('react-dom/client')
    const { act } = require('react-dom/test-utils')
    const adapter: Adapter = require('../src/shiki')
    const HighlightedCode = require('../src/HighlightedCode').default
    ;(global as any).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(React.createElement(HighlightedCode, { node: block, ctx: {}, keyProp: 'k' }, '=head1 Title'))
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(mockTextmate.evaluations).toBe(1)
    expect(errors).toHaveBeenCalled()
    expect(host.querySelector('pre > code')?.textContent).toBe('=head1 Title')
    expect(host.querySelector('.shiki')).toBeNull()
    act(() => root.unmount())
    host.remove()
    errors.mockRestore()

    mockTextmate.fail = false
    const html = await adapter.codeToThemedHtml({
      code: '=head1 Title',
      language: 'podlite',
      theme: 'dark',
    })
    expect(html).toContain('class="shiki"')
    expect(grammarLoads()).toHaveLength(1)
  })

  it('a grammar shiki refuses is not remembered as loaded', async () => {
    const adapter = fresh()
    mockShiki.rejectNext = 1
    await expect(adapter.getHighlighter('podlite')).rejects.toThrow('grammar refused')
    await adapter.getHighlighter('podlite')
    expect(grammarLoads()).toHaveLength(2)
  })
})

// shiki is an optional peer: the published types must not name it
it('the built declarations do not import shiki', () => {
  const declarations = join(__dirname, '..', 'lib', 'shiki.d.ts')
  if (!existsSync(declarations)) throw new Error(`${declarations} is missing: build the package before this test`)
  expect(readFileSync(declarations, 'utf8')).not.toMatch(/from ['"]shiki['"]|import\(['"]shiki['"]\)/)
})
