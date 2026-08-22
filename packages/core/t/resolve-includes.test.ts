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

describe('include with a directory mask', () => {
  const mkdir = (name: string) => {
    const d = path.join(tmpDir, name)
    fs.mkdirSync(d, { recursive: true })
    return d
  }
  const writeIn = (dir: string, name: string, body: string) => fs.writeFileSync(path.join(dir, name), body)

  it('takes every matching file of the directory', () => {
    const inc = mkdir('inc')
    writeIn(inc, 'a.podlite', '=pod\n\n=item alpha\n\n=end pod\n')
    writeIn(inc, 'b.podlite', '=pod\n\n=item beta\n\n=end pod\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('alpha')
    expect(md).toContain('beta')
  })

  it('keeps files out that the mask does not name', () => {
    const inc = mkdir('inc')
    writeIn(inc, 'a.podlite', '=pod\n\n=item alpha\n\n=end pod\n')
    writeIn(inc, 'notes.md', 'plain markdown line\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('alpha')
    expect(md).not.toContain('plain markdown line')
  })

  it('does not walk into subdirectories', () => {
    const inc = mkdir('inc')
    const deep = mkdir(path.join('inc', 'deep'))
    writeIn(inc, 'a.podlite', '=pod\n\n=item alpha\n\n=end pod\n')
    writeIn(deep, 'c.podlite', '=pod\n\n=item gamma\n\n=end pod\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('alpha')
    expect(md).not.toContain('gamma')
  })

  it('applies the selector to every file the mask names', () => {
    const inc = mkdir('inc')
    writeIn(inc, 'a.podlite', '=head1 first\n\n=item alpha\n')
    writeIn(inc, 'b.podlite', '=head1 second\n\n=item beta\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite | head1\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('first')
    expect(md).toContain('second')
    expect(md).not.toContain('alpha')
  })

  it('reads files in name order', () => {
    const inc = mkdir('inc')
    writeIn(inc, 'b.podlite', '=pod\n\n=item beta\n\n=end pod\n')
    writeIn(inc, 'a.podlite', '=pod\n\n=item alpha\n\n=end pod\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md.indexOf('alpha')).toBeLessThan(md.indexOf('beta'))
  })

  it('leaves nothing behind when the mask names no file', () => {
    mkdir('inc')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    expect(() => convert(wrapper, 'md')).not.toThrow()
    expect(convert(wrapper, 'md')).not.toContain('include')
  })

  it('does not read a file the mask leaves out', () => {
    const inc = mkdir('inc')
    writeIn(inc, 'a.podlite', '=pod\n\n=item alpha\n\n=end pod\n')
    writeIn(inc, 'photo.png', 'not text at all')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    const seen: string[] = []
    const counting = (source: string) => {
      seen.push(source)
      return parseToAst(source)
    }
    resolveIncludes(parseToAst(fs.readFileSync(wrapper, 'utf-8')), {
      baseDir: path.dirname(wrapper),
      parse: counting,
    })
    expect(seen.join('\n')).toContain('alpha')
    expect(seen.join('\n')).not.toContain('not text at all')
  })

  it('skips a dotfile', () => {
    const inc = mkdir('inc')
    writeIn(inc, 'a.podlite', '=pod\n\n=item alpha\n\n=end pod\n')
    writeIn(inc, '.hidden.podlite', '=pod\n\n=item hidden\n\n=end pod\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('alpha')
    expect(md).not.toContain('hidden')
  })
})

describe('include with a recursive mask', () => {
  const mkdir = (name: string) => {
    const d = path.join(tmpDir, name)
    fs.mkdirSync(d, { recursive: true })
    return d
  }
  const writeIn = (dir: string, name: string, body: string) => fs.writeFileSync(path.join(dir, name), body)

  const tree = () => {
    const inc = mkdir('inc')
    const deep = mkdir(path.join('inc', 'deep'))
    const deeper = mkdir(path.join('inc', 'deep', 'deeper'))
    writeIn(inc, 'a.podlite', '=pod\n\n=item alpha\n\n=end pod\n')
    writeIn(deep, 'b.podlite', '=pod\n\n=item beta\n\n=end pod\n')
    writeIn(deeper, 'c.podlite', '=pod\n\n=item gamma\n\n=end pod\n')
  }

  it('reaches files of nested directories', () => {
    tree()
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/**/*.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('alpha')
    expect(md).toContain('beta')
    expect(md).toContain('gamma')
  })

  it('applies the selector across the whole tree', () => {
    const inc = mkdir('inc')
    const deep = mkdir(path.join('inc', 'deep'))
    writeIn(inc, 'a.podlite', '=head1 first\n\n=item alpha\n')
    writeIn(deep, 'b.podlite', '=head1 second\n\n=item beta\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/**/*.podlite | head1\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('first')
    expect(md).toContain('second')
    expect(md).not.toContain('alpha')
  })

  it('keeps a single-level mask out of the subdirectories', () => {
    tree()
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('alpha')
    expect(md).not.toContain('beta')
  })

  it('skips a hidden directory', () => {
    const inc = mkdir('inc')
    const hidden = mkdir(path.join('inc', '.git'))
    writeIn(inc, 'a.podlite', '=pod\n\n=item alpha\n\n=end pod\n')
    writeIn(hidden, 'b.podlite', '=pod\n\n=item beta\n\n=end pod\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/**/*.podlite\n')
    const md = convert(wrapper, 'md')
    expect(md).toContain('alpha')
    expect(md).not.toContain('beta')
  })

  it('leaves nothing behind when the tree holds no match', () => {
    mkdir(path.join('inc', 'deep'))
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/**/*.podlite\n')
    expect(() => convert(wrapper, 'md')).not.toThrow()
  })
})
