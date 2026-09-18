import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { parse, toMarkdown, toHtml } from '@podlite/schema'
import { podlite } from '../src/index'
import {
  resolveIncludes,
  IncludeOrigin,
  IncludeProblem,
  ResolveIncludesOptions,
  SourceProvider,
} from '../src/resolve-includes'

// A file permission does not stop a read by root or on Windows, so a failed read
// is made here instead.
const mockUnreadable = new Set<string>()
jest.mock('fs', () => {
  const actual = jest.requireActual('fs')
  return {
    ...actual,
    readFileSync: (file: string, ...rest: unknown[]) => {
      if (mockUnreadable.has(String(file))) throw new Error('EACCES')
      return actual.readFileSync(file, ...rest)
    },
  }
})

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

describe('include address and problems', () => {
  const resolve = (file: string, opts: Partial<ResolveIncludesOptions> = {}) =>
    resolveIncludes(parseToAst(fs.readFileSync(file, 'utf-8')), {
      baseDir: path.dirname(file),
      parse: parseToAst,
      file,
      self: file,
      ...opts,
    })
  const guide = '=pod\n\n=head1 Intro\n\nIntro text.\n\n=head1 Overview\n\nOverview text.\n'

  it('throws when the include address is missing', () => {
    write('guide.podlite', guide)
    const wrapper = write('notes.podlite', '=pod\n\n=include file:guide.podlite#Absent\n')
    expect(() => convert(wrapper, 'md')).toThrow(/address not found: #Absent/)
  })

  it('finds a heading by the form an output gives its name', () => {
    write('guide.podlite', guide)
    const wrapper = write('notes.podlite', '=pod\n\n=include file:guide.podlite#overview | head1\n')
    expect(convert(wrapper, 'md')).toContain('# Overview')
  })

  it('takes the first of two blocks with one address and warns', () => {
    write('twice.podlite', '=pod\n\n=for para :id<x>\nFirst.\n\n=for para :id<x>\nLast.\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:twice.podlite#x\n')
    const warnings: IncludeProblem[] = []
    const md = toMarkdown({})
      .run(resolve(wrapper, { onWarning: p => warnings.push(p) }))
      .toString()
    expect(md).toContain('First.')
    expect(md).not.toContain('Last.')
    expect(warnings.map(w => w.kind)).toEqual(['ambiguous'])
  })

  it('treats a directory named as a source as missing', () => {
    fs.mkdirSync(path.join(tmpDir, 'dir.podlite'))
    const wrapper = write('notes.podlite', '=pod\n\n=include file:dir.podlite\n')
    expect(() => convert(wrapper, 'md')).toThrow(/target not found/)
  })

  it('reports a file of a mask that cannot be read', () => {
    fs.mkdirSync(path.join(tmpDir, 'inc'))
    write('inc/a.podlite', '=pod\n\n=head1 A\n')
    const locked = write('inc/b.podlite', '=pod\n\n=head1 B\n')
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    mockUnreadable.add(locked)
    try {
      expect(() => convert(wrapper, 'md')).toThrow(/cannot be read: \.\/inc\/b\.podlite/)
    } finally {
      mockUnreadable.delete(locked)
    }
  })

  it('finds an address past a cycle back to the document itself', () => {
    write('B.podlite', '=include file:A.podlite#x\n\n=for para :id<x>\nYes.\n')
    const a = write('A.podlite', '=include file:B.podlite#x\n')
    expect(toMarkdown({}).run(resolve(a)).toString()).toContain('Yes.')
  })

  it('reports an address when a mask names no file', () => {
    fs.mkdirSync(path.join(tmpDir, 'empty'))
    const wrapper = write('notes.podlite', '=pod\n\n=include file:./empty/*.podlite#x\n')
    expect(() => convert(wrapper, 'md')).toThrow(/address not found: #x/)
  })

  it('resolves includes in a document given as a list of nodes', () => {
    write('guide.podlite', guide)
    const main = write('notes.podlite', '=include file:guide.podlite | head1\n')
    const list = parse(fs.readFileSync(main, 'utf-8'))
    const out = resolveIncludes(list, { baseDir: tmpDir, parse: src => parse(src) })
    expect(JSON.stringify(out)).toContain('Overview')
    expect(JSON.stringify(out)).not.toContain('"name":"include"')
  })

  it('reports a lost include and goes on with the rest', () => {
    write('guide.podlite', guide)
    const main = write(
      'notes.podlite',
      '=pod\n\nBefore.\n\n=include file:guide.podlite#Absent\n\n=include file:guide.podlite#Intro\n',
    )
    const errors: IncludeProblem[] = []
    const md = toMarkdown({})
      .run(resolve(main, { onError: p => errors.push(p) }))
      .toString()
    expect(md).toContain('Before.')
    expect(md).toContain('# Intro')
    expect(errors.map(e => e.kind)).toEqual(['address'])
    expect(errors[0].chain.map(step => step.file)).toEqual([main])
    expect(errors[0].chain[0].location?.start.line).toBe(5)
  })

  it('names every directive on the way to a problem in an included file', () => {
    write('inner.podlite', '=pod\n\n=include file:absent.podlite\n')
    const main = write('notes.podlite', '=pod\n\n=include file:inner.podlite\n')
    const errors: IncludeProblem[] = []
    resolve(main, { onError: p => errors.push(p) })
    expect(errors.map(e => e.kind)).toEqual(['source'])
    expect(errors[0].chain.map(step => path.basename(step.file))).toEqual(['notes.podlite', 'inner.podlite'])
  })

  it('warns about an include whose selector cannot be read and keeps the directive', () => {
    write('guide.podlite', guide)
    const main = write('notes.podlite', '=pod\n\n=include file:./guide.podlite | head1[\n')
    const warnings: IncludeProblem[] = []
    const tree = resolve(main, { onError: () => undefined, onWarning: p => warnings.push(p) })
    expect(warnings.map(w => [w.kind, w.chain[0].location?.start.line])).toEqual([['unparsed-selector', 3]])
    expect(tree.content.some((n: any) => n.name === 'include')).toBe(true)
  })

  it('warns about an include of a scheme it does not read', () => {
    const main = write('notes.podlite', '=pod\n\n=include nosuch:./guide.podlite | head1\n')
    const warnings: IncludeProblem[] = []
    resolve(main, { onWarning: p => warnings.push(p) })
    expect(warnings.map(w => w.kind)).toEqual(['unsupported-scheme'])
    expect(warnings[0].message).toMatch(/nosuch:/)
  })

  it('names the included file an unreadable selector sits in', () => {
    write('inner.podlite', '=pod\n\n=include file:./guide.podlite | head1[\n')
    const main = write('notes.podlite', '=pod\n\n=include file:inner.podlite\n')
    const warnings: IncludeProblem[] = []
    resolve(main, { onWarning: p => warnings.push(p) })
    expect(warnings.map(w => w.kind)).toEqual(['unparsed-selector'])
    expect(warnings[0].chain.map(step => path.basename(step.file))).toEqual(['notes.podlite', 'inner.podlite'])
  })

  it('records the file every included node was written in', () => {
    write('inner.podlite', '=begin pod\n\n=head1 Child\n\n=end pod\n')
    const main = write('notes.podlite', '=pod\n\n=include file:inner.podlite\n')
    const origin = new WeakMap<object, IncludeOrigin>()
    const text = fs.readFileSync(main, 'utf-8')
    const tree = resolveIncludes(parseToAst(text), { baseDir: tmpDir, parse: parseToAst, file: main, text, origin })
    const heads: any[] = []
    const visit = (n: any) => {
      if (!n || typeof n !== 'object') return
      if (n.name === 'head') heads.push(n)
      if (Array.isArray(n.content)) n.content.forEach(visit)
    }
    visit(tree)
    expect(heads).toHaveLength(1)
    const where = origin.get(heads[0])
    expect(where && path.basename(where.file)).toBe('inner.podlite')
    expect(where && where.text.slice(heads[0].location.start.offset, heads[0].location.end.offset)).toContain(
      '=head1 Child',
    )
    expect(path.basename(origin.get(tree)?.file ?? '')).toBe('notes.podlite')
  })
})

describe('the file an included block was written in', () => {
  it('is recorded for a block a Markdown section of the included file holds', () => {
    write('md.podlite', '=pod\n\n=begin markdown\n```js\nlet a\n```\n=end markdown\n')
    const main = write('notes.podlite', '=pod\n\n=include file:./md.podlite\n')
    const origin = new WeakMap<object, IncludeOrigin>()
    const text = fs.readFileSync(main, 'utf-8')
    const tree = resolveIncludes(parseToAst(text), { baseDir: tmpDir, parse: parseToAst, file: main, text, origin })
    const code: any[] = []
    const visit = (n: any): void => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(visit)
      if (n.type === 'block' && n.name === 'code') code.push(n)
      visit(n.content)
    }
    visit(tree)
    expect(code.map(n => path.basename(origin.get(n)?.file ?? ''))).toEqual(['md.podlite'])
  })
})

describe('include through a source provider', () => {
  const files: Record<string, string> = {
    'guide.podlite': '=pod\n\n=head1 From memory\n',
    'parts/a.podlite': '=pod\n\n=head1 Part A\n',
    'parts/b.podlite': '=pod\n\n=head1 Part B\n',
  }
  const provider = (root: string): SourceProvider => ({
    read: file => files[path.relative(root, file)] ?? null,
    list: (dir, deep) =>
      Object.keys(files)
        .map(name => path.relative(dir, path.join(root, name)))
        .filter(name => !name.startsWith('..') && (deep || !name.includes('/'))),
  })

  it('reads a file and a mask from the provider, not from the disk', () => {
    write('guide.podlite', '=pod\n\n=head1 From disk\n')
    const tree = resolveIncludes(
      parseToAst('=pod\n\n=include file:./guide.podlite\n\n=include file:./parts/*.podlite\n'),
      {
        baseDir: tmpDir,
        parse: parseToAst,
        provider: provider(tmpDir),
      },
    )
    const md = toMarkdown({}).run(tree).toString()
    expect(md).toContain('From memory')
    expect(md).not.toContain('From disk')
    expect(md.indexOf('Part A')).toBeLessThan(md.indexOf('Part B'))
  })
})
