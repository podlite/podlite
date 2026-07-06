import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { toMarkdown, toHtml } from '@podlite/schema'
import { podlite } from '../src/index'
import { resolveIncludes } from '../src/resolve-includes'

const p = podlite({ importPlugins: true })
const parseToAst = (source: string) => p.toAst(p.parse(source, { podMode: 1 }))

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-include-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  const f = path.join(tmpDir, name)
  fs.writeFileSync(f, body)
  return f
}

const convert = (file: string, to: 'md' | 'html'): string => {
  const tree = resolveIncludes(parseToAst(fs.readFileSync(file, 'utf-8')), {
    baseDir: path.dirname(file),
    parse: parseToAst,
  })
  const out = to === 'md' ? toMarkdown({}).run(tree) : toHtml({}).run(tree)
  return out.toString()
}

const changelog = [
  '=pod',
  '',
  '=begin pod :released-in<0.2.0>',
  '',
  '=item shipped feature',
  '',
  '=end pod',
  '',
  '=begin pod :released-in<0.1.0>',
  '',
  '=item earlier feature',
  '',
  '=end pod',
  '',
].join('\n')

describe('resolveIncludes', () => {
  it('keeps only blocks matching the selector', () => {
    write('CHANGELOG.podlite', changelog)
    const wrapper = write('notes.podlite', '=pod\n\n=include file:CHANGELOG.podlite | pod[:released-in<0.2.0>]\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('shipped feature')
    expect(md).not.toContain('earlier feature')
    expect(md).not.toContain('file:CHANGELOG.podlite')
  })

  it('inlines the whole file when there is no selector', () => {
    write('CHANGELOG.podlite', changelog)
    const wrapper = write('notes.podlite', '=pod\n\n=include file:CHANGELOG.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('shipped feature')
    expect(md).toContain('earlier feature')
  })

  it('throws when the include target is missing', () => {
    const wrapper = write('notes.podlite', '=pod\n\n=include file:absent.podlite\n')
    expect(() => convert(wrapper, 'md')).toThrow(/not found/)
  })

  it('resolves the selector on the html path', () => {
    write('CHANGELOG.podlite', changelog)
    const wrapper = write('notes.podlite', '=pod\n\n=include file:CHANGELOG.podlite | pod[:released-in<0.2.0>]\n')
    const html = convert(wrapper, 'html')
    expect(html).toContain('shipped feature')
    expect(html).not.toContain('earlier feature')
  })

  it('stops a self-referencing include instead of looping', () => {
    const loop = write('loop.podlite', '=pod\n\n=include file:loop.podlite\n')
    expect(() => convert(loop, 'md')).not.toThrow()
  })
})
