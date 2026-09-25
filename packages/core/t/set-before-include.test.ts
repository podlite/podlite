import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getTextContentFromNode, toHtml } from '@podlite/schema'
import { podlite } from '../src/index'
import { resolveIncludes, IncludeOrigin, IncludeProblem, ResolveIncludesOptions } from '../src/resolve-includes'
import { refreshTocs } from '../src/refresh-tocs'
import { runQuery } from '../src/query'
import { lintFile } from '../src/lint'
import { INCLUDE_RESOLVES_RULE_ID } from '../src/lint/rules/include-resolves'
import { coreProfile, prepareDocument } from '../src/test/documents'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-set-include-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const write = (name: string, body: string): string => {
  const file = path.join(dir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  return file
}

const p = podlite({ importPlugins: true })
const parseToAst = (source: string) => p.toAst(p.parse(source, { podMode: 1 }))

type Run = { tree: any; errors: IncludeProblem[]; warnings: IncludeProblem[] }

const resolve = (file: string, opts: Partial<ResolveIncludesOptions> = {}): Run => {
  const errors: IncludeProblem[] = []
  const warnings: IncludeProblem[] = []
  const tree = resolveIncludes(parseToAst(fs.readFileSync(file, 'utf-8')), {
    baseDir: path.dirname(file),
    parse: parseToAst,
    file,
    self: file,
    onError: e => errors.push(e),
    onWarning: w => warnings.push(w),
    ...opts,
  })
  return { tree, errors, warnings }
}

const html = (tree: any): string => String(toHtml({}).run(tree).toString())

// the blocks of the tree with the given name, in document order
const blocks = (node: any, name: string, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => blocks(n, name, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.type === 'block' && node.name === name) out.push(node)
  if (node.content) blocks(node.content, name, out)
  return out
}

const idOf = (block: any) => (block?.config || []).find((c: any) => c.name === 'id')?.value
const attrOf = (block: any, name: string) => (block?.config || []).find((c: any) => c.name === name)

const headIds = (tree: any): Array<[string, any]> =>
  blocks(tree, 'head').map(h => [String(getTextContentFromNode(h.content)).replace(/\s+/g, ''), idOf(h)])

const part = '=pod\n\n=head1 Included\n\nText.\n'

describe('=set before =include in core', () => {
  it('gives the first included block the assignment, not the block after the include', () => {
    write('p.podlite', part)
    const main = write('main.podlite', '=pod\n\n=set :id<chosen>\n=include file:./p.podlite | head1\n\n=head1 After\n')
    const out = html(resolve(main).tree)
    expect(out).toContain('<h1 id="chosen">Included')
    expect(out).not.toMatch(/id="chosen">After/)
  })

  it('reaches the block after an include whose selection is empty', () => {
    write('p.podlite', part)
    const main = write('main.podlite', '=pod\n\n=set :id<chosen>\n=include file:./p.podlite | hed1\n\n=head1 After\n')
    const run = resolve(main)
    expect(headIds(run.tree)).toEqual([['After', 'chosen']])
    expect(run.warnings).toEqual([])
  })

  it('reaches the block after an include of a file holding only comments', () => {
    write('c.podlite', '=comment one\n\n=comment two\n')
    const main = write('main.podlite', '=pod\n\n=set :id<chosen>\n=include file:./c.podlite\n\n=head1 After\n')
    expect(headIds(resolve(main).tree)).toEqual([['After', 'chosen']])
  })

  it('warns once when no block follows an empty include to the end of the list', () => {
    write('p.podlite', part)
    const main = write('main.podlite', '=pod\n\n=head1 Before\n\n=set :id<lost>\n=include file:./p.podlite | hed1\n')
    const run = resolve(main)
    expect(headIds(run.tree)).toEqual([['Before', undefined]])
    expect(run.warnings.map(w => [w.kind, w.message])).toEqual([
      ['set-target', '=set before =include has no target block in scope: id'],
    ])
  })

  it('names the last include of a chain in the warning, with the later assignment', () => {
    write('p.podlite', part)
    const src = [
      '=pod',
      '',
      '=set :id<A>',
      '=include file:./p.podlite | hed1',
      '',
      '=set :id<B>',
      '=include file:./p.podlite | hed2',
      '',
    ].join('\n')
    const run = resolve(write('main.podlite', src))
    expect(run.warnings).toHaveLength(1)
    expect(run.warnings[0].kind).toBe('set-target')
    expect(run.warnings[0].target).toBe('file:./p.podlite | hed2')
    expect(run.warnings[0].chain[0].location?.start.line).toBe(7)
  })

  it('keeps the last =set when an empty include stands between two', () => {
    write('p.podlite', part)
    const one = ['=pod', '', '=set :id<A>', '=include file:./p.podlite | hed1', '', '=set :id<B>', '=head1 C', ''].join('\n')
    expect(headIds(resolve(write('one.podlite', one)).tree)).toEqual([['C', 'B']])
    const two = [
      '=pod',
      '',
      '=set :id<A>',
      '=include file:./p.podlite | hed1',
      '',
      '=set :id<B>',
      '=include file:./p.podlite | hed2',
      '',
      '=head1 C',
      '',
    ].join('\n')
    expect(headIds(resolve(write('two.podlite', two)).tree)).toEqual([['C', 'B']])
  })

  it('does not carry the assignment out of the block the include stands in', () => {
    write('p.podlite', part)
    const src = [
      '=begin pod',
      '',
      '=set :id<inner>',
      '=include file:./p.podlite | hed1',
      '',
      '=end pod',
      '',
      '=head1 Outside',
      '',
    ].join('\n')
    const run = resolve(write('main.podlite', src))
    expect(headIds(run.tree)).toEqual([['Outside', undefined]])
    expect(run.warnings.map(w => w.kind)).toEqual(['set-target'])
  })

  describe('an include that fails', () => {
    const after = (src: string) => {
      const run = resolve(write('main.podlite', src))
      return { ...run, heads: headIds(run.tree), problems: [...run.errors, ...run.warnings] }
    }

    it('does not pass the assignment on when the file is missing, and says so with the failure', () => {
      const r = after('=pod\n\n=set :id<x>\n=include file:./absent.podlite\n\n=head1 After\n')
      expect(r.heads).toEqual([['After', undefined]])
      expect(r.problems.map(e => [e.kind, e.message])).toEqual([
        ['source', 'include target not found: ./absent.podlite; =set assignments not applied: id'],
      ])
    })

    it('does the same for a selector that cannot be read', () => {
      write('p.podlite', part)
      const r = after('=pod\n\n=set :id<x>\n=include file:./p.podlite | head1[\n\n=head1 After\n')
      expect(r.heads).toEqual([['After', undefined]])
      expect(r.problems).toHaveLength(1)
      expect(r.problems[0].kind).toBe('unparsed-selector')
      expect(r.problems[0].message).toMatch(/=set assignments not applied: id$/)
      // the directive left in the tree holds nothing for a later pass
      expect(blocks(r.tree, 'include')[0].set).toBeUndefined()
    })

    it('does the same for a scheme include does not read', () => {
      const r = after('=pod\n\n=set :id<x>\n=include doc:other | head1\n\n=head1 After\n')
      expect(r.heads).toEqual([['After', undefined]])
      expect(r.problems.map(e => e.kind)).toEqual(['unsupported-scheme'])
      expect(r.problems[0].message).toMatch(/not applied: id$/)
    })

    it('does the same for an address the file does not hold', () => {
      write('p.podlite', part)
      const r = after('=pod\n\n=set :id<x>\n=include file:./p.podlite#Absent\n\n=head1 After\n')
      expect(r.heads).toEqual([['After', undefined]])
      expect(r.problems.map(e => e.kind)).toEqual(['address'])
      expect(r.problems[0].message).toMatch(/not applied: id$/)
    })

    it('reports a cycle that loses the assignment, and does not stop', () => {
      const r = after('=pod\n\n=set :id<x>\n=include file:./main.podlite\n\n=head1 After\n')
      expect(r.heads).toEqual([['After', undefined]])
      expect(r.errors).toEqual([])
      expect(r.warnings.map(w => w.kind)).toEqual(['cycle'])
      expect(r.warnings[0].message).toMatch(/already being included; =set assignments not applied: id$/)
    })

    it('does not pass it on when an include inside the included file fails and nothing comes in', () => {
      write('a.podlite', '=include file:./absent.podlite\n')
      const r = after('=pod\n\n=set :id<x>\n=include file:./a.podlite\n\n=head1 After\n')
      expect(r.heads).toEqual([['After', undefined]])
      expect(r.problems.map(e => [e.kind, e.message])).toEqual([
        ['source', 'include target not found: ./absent.podlite; =set assignments not applied: id'],
      ])
    })

    it('reports a cycle inside the included file that loses the assignment', () => {
      write('a.podlite', '=include file:./a.podlite\n')
      const r = after('=pod\n\n=set :id<x>\n=include file:./a.podlite\n\n=head1 After\n')
      expect(r.heads).toEqual([['After', undefined]])
      expect(r.errors).toEqual([])
      expect(r.warnings.map(w => w.kind)).toEqual(['cycle'])
      expect(r.warnings[0].message).toMatch(/not applied: id$/)
    })

    it('stops at a failed include ahead of the selected block, since it could have brought one', () => {
      write('p.podlite', '=include file:./absent.podlite\n\n=head1 X\n')
      const r = after('=pod\n\n=set :id<a>\n=include file:./p.podlite | head1\n\n=head1 After\n')
      expect(r.heads).toEqual([
        ['X', undefined],
        ['After', undefined],
      ])
      expect(r.problems.map(e => e.message)).toEqual([
        'include target not found: ./absent.podlite; =set assignments not applied: id',
      ])
    })

    it('stops at an include left in place ahead of the selected block', () => {
      write('p.podlite', '=include doc:other | head1\n\n=head1 X\n')
      const r = after('=pod\n\n=set :id<a>\n=include file:./p.podlite | head1\n')
      expect(r.heads).toEqual([['X', undefined]])
      expect(r.problems.map(e => e.message)).toEqual([
        'include scheme is not supported: doc:; =set assignments not applied: id',
      ])
    })

    it('gives the selected block the assignment when the failed include comes after it', () => {
      write('p.podlite', '=head1 X\n\n=include file:./absent.podlite\n')
      const r = after('=pod\n\n=set :id<a>\n=include file:./p.podlite | head1\n')
      expect(r.heads).toEqual([['X', 'a']])
      expect(r.problems.map(e => e.message)).toEqual(['include target not found: ./absent.podlite'])
    })

    it('names the assignments of both files in one tail', () => {
      write('p.podlite', '=set :lang<y>\n=include file:./absent.podlite\n\n=head1 X\n')
      const r = after('=pod\n\n=set :id<a>\n=include file:./p.podlite\n')
      expect(r.problems.map(e => e.message)).toEqual([
        'include target not found: ./absent.podlite; =set assignments not applied: lang, id',
      ])
    })

    it('passes it on when an inner include after the first block fails', () => {
      write('a.podlite', '=head1 Kept\n\n=include file:./absent.podlite\n')
      const r = after('=pod\n\n=set :id<x>\n=include file:./a.podlite\n\n=head1 After\n')
      expect(r.heads).toEqual([
        ['Kept', 'x'],
        ['After', undefined],
      ])
      expect(r.problems.map(e => e.message)).toEqual(['include target not found: ./absent.podlite'])
    })

    it('leaves a cycle that loses nothing as it was', () => {
      const r = after('=pod\n\n=include file:./main.podlite\n\n=head1 After\n')
      expect(r.problems).toEqual([])
    })

    it('stays silent on a back edge when the address is found past it', () => {
      write('B.podlite', '=include file:A.podlite#x\n\n=for para :id<x>\nYes.\n')
      const a = write('A.podlite', '=include file:B.podlite#x\n')
      const run = resolve(a)
      expect(html(run.tree)).toContain('Yes.')
      expect([...run.errors, ...run.warnings]).toEqual([])
    })

    it('names an assignment a back edge loses, and still finds the address', () => {
      write('B.podlite', '=set :id<y>\n=include file:A.podlite#x\n\n=for para :id<x>\nYes.\n')
      const a = write('A.podlite', '=include file:B.podlite#x\n')
      const run = resolve(a)
      expect(html(run.tree)).toContain('Yes.')
      expect(run.errors).toEqual([])
      expect(run.warnings.map(w => w.kind)).toEqual(['cycle'])
      expect(run.warnings[0].message).toMatch(/not applied: id$/)
    })

    it('stops at an include inside the included file that is left in place, and names what it lost', () => {
      write('p.podlite', '=include doc:other | head1\n\n=head1 X\n')
      const r = after('=pod\n\n=set :id<a>\n=include file:./p.podlite\n\n=head1 After\n')
      expect(r.heads).toEqual([
        ['X', undefined],
        ['After', undefined],
      ])
      expect(r.problems.map(e => [e.kind, e.message])).toEqual([
        ['unsupported-scheme', 'include scheme is not supported: doc:; =set assignments not applied: id'],
      ])
      expect(blocks(r.tree, 'include').map(b => b.set)).toEqual([undefined])
    })

    it('stops at an include inside the included file that left nothing, and names what it lost', () => {
      write('p.podlite', '=include file:./absent.podlite\n\n=head1 X\n')
      const r = after('=pod\n\n=set :id<a>\n=include file:./p.podlite\n\n=head1 After\n')
      expect(r.heads).toEqual([
        ['X', undefined],
        ['After', undefined],
      ])
      expect(r.problems.map(e => e.message)).toEqual([
        'include target not found: ./absent.podlite; =set assignments not applied: id',
      ])
      expect(JSON.stringify(r.tree)).not.toContain('include-failed')
    })
  })

  describe('which assignment wins on the first included block', () => {
    it('prefers the including file to a =set of the included one', () => {
      write('p.podlite', '=pod\n\n=set :caption<Inner>\n=head1 Included\n')
      const run = resolve(write('main.podlite', '=pod\n\n=set :caption<Outer>\n=include file:./p.podlite | head1\n'))
      expect(attrOf(blocks(run.tree, 'head')[0], 'caption').value).toBe('Outer')
    })

    it('keeps an attribute written on the included block', () => {
      write('p.podlite', "=pod\n\n=for head1 :caption<Own>\nIncluded\n")
      const run = resolve(write('main.podlite', '=pod\n\n=set :caption<Outer>\n=include file:./p.podlite | head1\n'))
      expect(attrOf(blocks(run.tree, 'head')[0], 'caption').value).toBe('Own')
    })

    it('prefers it to a =config default of the included file', () => {
      write('p.podlite', '=pod\n\n=config head1 :id<default>\n\n=head1 Included\n')
      const run = resolve(write('main.podlite', '=pod\n\n=set :id<outer>\n=include file:./p.podlite | head1\n'))
      expect(idOf(blocks(run.tree, 'head')[0])).toBe('outer')
    })

    it('keeps the language a fence gives a code block of an included Markdown section', () => {
      write('m.podlite', '=begin markdown\n```js\nlet a = 1\n```\n=end markdown\n')
      const run = resolve(write('main.podlite', '=pod\n\n=set :lang<py>\n=include file:./m.podlite\n'))
      const code = blocks(run.tree, 'code')[0]
      expect(attrOf(code, 'lang').value).toBe('js')
    })
  })

  describe('what reads the assignment later', () => {
    it('lets a link in the including file find the included block by the assigned address', () => {
      write('p.podlite', part)
      const main = write(
        'main.podlite',
        '=pod\n\n=para See L<the part|#outer>.\n\n=set :id<outer>\n=include file:./p.podlite | head1\n',
      )
      const out = html(resolve(main).tree)
      expect(out).toContain('id="outer"')
      expect(out).toContain('href="#outer"')
    })

    it('shows an assigned caption in the table of contents made again after the includes', () => {
      write('p.podlite', part)
      const text = '=pod\n\n=toc head1\n\n=set :caption<Assigned>\n=include file:./p.podlite | head1\n'
      const main = write('main.podlite', text)
      const origin = new WeakMap<object, IncludeOrigin>()
      const resolved = resolveIncludes(parseToAst(text), {
        baseDir: dir,
        parse: parseToAst,
        file: main,
        text,
        self: main,
        origin,
      })
      const tree = refreshTocs(resolved, p.parse(text, { podMode: 1 }), main, origin)
      expect(html(tree)).toContain('Assigned')
    })

    it('covers an included block the including file masks', () => {
      write('p.podlite', '=pod\n\n=para hunter2 inside\n')
      const run = resolve(write('main.podlite', '=pod\n\n=set :masked\n=include file:./p.podlite | para\n'))
      const out = String(toHtml({ renderMode: 'production' }).run(run.tree).toString())
      expect(out).not.toContain('hunter2')
    })
  })

  describe('where the assignment lands in the included content', () => {
    it('gives it to the first block after blank lines, =config and =comment', () => {
      write('p.podlite', '\n\n=config head1 :numbered\n\n=comment note\n\n=head1 First\n\n=head1 Second\n')
      const run = resolve(write('main.podlite', '=pod\n\n=set :id<first>\n=include file:./p.podlite\n'))
      expect(headIds(run.tree)).toEqual([
        ['First', 'first'],
        ['Second', undefined],
      ])
    })

    it('gives it to a =pod the file is wrapped in', () => {
      write('p.podlite', '=begin pod\n\n=head1 Inside\n\n=end pod\n')
      const run = resolve(write('main.podlite', '=pod\n\n=set :id<whole>\n=include file:./p.podlite\n'))
      const pods = blocks(run.tree, 'pod').filter(b => idOf(b) === 'whole')
      expect(pods).toHaveLength(1)
      expect(headIds(run.tree)).toEqual([['Inside', undefined]])
    })

    it('gives it to the block an address finds', () => {
      write('p.podlite', '=pod\n\n=head1 Intro\n\n=head1 Section\n')
      const run = resolve(write('main.podlite', '=pod\n\n=set :caption<Found>\n=include file:./p.podlite#Section\n'))
      expect(attrOf(blocks(run.tree, 'head')[0], 'caption').value).toBe('Found')
    })

    it('gives it to the first block of a file the included file includes first', () => {
      write('b.podlite', '=head1 From B\n')
      write('a.podlite', '=include file:./b.podlite\n\n=head1 From A\n')
      const run = resolve(write('main.podlite', '=pod\n\n=set :id<deep>\n=include file:./a.podlite\n'))
      expect(headIds(run.tree)).toEqual([
        ['FromB', 'deep'],
        ['FromA', undefined],
      ])
    })

    it('gives each of two includes of one file its own address and leaves the file unchanged', () => {
      write('p.podlite', part)
      const trees: any[] = []
      const keep = (source: string) => {
        const tree = parseToAst(source)
        trees.push(tree)
        return tree
      }
      const src = '=pod\n\n=set :id<one>\n=include file:./p.podlite | head1\n\n=set :id<two>\n=include file:./p.podlite | head1\n'
      const run = resolve(write('main.podlite', src), { parse: keep })
      expect(headIds(run.tree)).toEqual([
        ['Included', 'one'],
        ['Included', 'two'],
      ])
      const parsedHeads = trees.flatMap(t => blocks(t, 'head'))
      expect(parsedHeads.map(idOf)).toEqual([undefined, undefined])
      expect(parsedHeads.map(h => h.guarded)).toEqual([undefined, undefined])
    })
  })

  describe('the tools that read an include', () => {
    it('lets a query find the assigned block and print its text', () => {
      write('p.podlite', part)
      const main = write('main.podlite', '=pod\n\n=set :id<chosen>\n=include file:./p.podlite | head1\n')
      const r = runQuery({ selector: 'head1[:id<chosen>]', files: [main], format: 'podlite', failOnEmpty: false, quiet: true })
      expect(r.matchCount).toBe(1)
      expect(r.output).toContain('Included')
    })

    it('marks where a configuration item came from in the json of a query', () => {
      const main = write('main.podlite', '=pod\n\n=config head1 :lang<en>\n\n=set :id<s>\n=head1 Title\n')
      const r = runQuery({ selector: 'head1', files: [main], format: 'json', failOnEmpty: false, quiet: true })
      const config = JSON.stringify(JSON.parse(r.output))
      expect(config).toMatch(/"name":"id"[^}]*"from":"set"/)
      expect(config).toMatch(/"name":"lang"[^}]*"from":"config"/)
    })

    it('counts a =set with no target as a warning of the test runner', () => {
      write('p.podlite', part)
      const main = write('main.podlite', '=pod\n\n=set :id<lost>\n=include file:./p.podlite | hed1\n')
      const prepared = prepareDocument(
        { name: main, text: fs.readFileSync(main, 'utf-8'), baseDir: dir, self: main },
        { profile: coreProfile },
      )
      if (prepared.ok === false) throw new Error(prepared.error)
      expect(prepared.value.errors).toEqual([])
      expect(prepared.value.warnings.map(w => w.kind)).toEqual(['set-target'])
    })

    it('shows it in lint as a warning of include-resolves', () => {
      write('p.podlite', part)
      const main = write('main.podlite', '=pod\n\n=set :id<lost>\n=include file:./p.podlite | hed1\n')
      const v = lintFile(main, {}).violations.filter(x => x.rule === INCLUDE_RESOLVES_RULE_ID)
      expect(v.map(x => [x.severity, x.location?.start.line])).toEqual([['warning', 4]])
    })
  })
})

describe('problems met before a later include throws', () => {
  const texts: Record<string, string> = { 'broken.podlite': '=head1 Broken\n' }
  const provider = {
    read: (file: string) => texts[path.basename(file)] ?? null,
    list: () => [],
  }
  const parse = (source: string, file?: string) => {
    if (file && file.endsWith('broken.podlite')) throw new Error('parser rejected broken')
    return parseToAst(source)
  }
  const doc = '=pod\n\n=include doc:bad\n\n=include file:absent.podlite\n\n=include file:broken.podlite\n'

  it('are delivered to the handlers before the exception', () => {
    const got: string[] = []
    expect(() =>
      resolveIncludes(parseToAst(doc), {
        baseDir: '/virtual',
        parse,
        provider,
        onError: e => got.push(`error ${e.kind}`),
        onWarning: w => got.push(`warning ${w.kind}`),
      }),
    ).toThrow('parser rejected broken')
    expect(got).toEqual(['warning unsupported-scheme', 'error source'])
  })

  it('without an error handler, does not name an assignment a block before the failure could have taken', () => {
    const files: Record<string, string> = { 'a.podlite': '=para first\n\n=include file:absent.podlite\n' }
    const run = () =>
      resolveIncludes(parseToAst('=pod\n\n=set :id<outer>\n=include file:a.podlite\n'), {
        baseDir: '/virtual',
        parse: parseToAst,
        provider: { read: file => files[path.basename(file)] ?? null, list: () => [] },
      })
    let thrown: any
    try {
      run()
    } catch (e) {
      thrown = e
    }
    expect(thrown.message).toBe('include target not found: absent.podlite')
    expect(Object.keys(thrown)).toEqual([])
  })

  it('without an error handler, keeps the stack in step with the named assignments', () => {
    const files: Record<string, string> = { 'a.podlite': '=include file:absent.podlite\n' }
    let thrown: any
    try {
      resolveIncludes(parseToAst('=pod\n\n=set :id<outer>\n=include file:a.podlite\n'), {
        baseDir: '/virtual',
        parse: parseToAst,
        provider: { read: file => files[path.basename(file)] ?? null, list: () => [] },
      })
    } catch (e) {
      thrown = e
    }
    expect(thrown.message).toBe('include target not found: absent.podlite; =set assignments not applied: id')
    expect(thrown.stack.split('\n')[0]).toBe(`Error: ${thrown.message}`)
  })

  it('without an error handler, keeps a file name holding a replacement pattern in the stack as written', () => {
    const files: Record<string, string> = { 'a.podlite': '=include file:x$&y.podlite\n' }
    let thrown: any
    try {
      resolveIncludes(parseToAst('=pod\n\n=set :id<outer>\n=include file:a.podlite\n'), {
        baseDir: '/virtual',
        parse: parseToAst,
        provider: { read: file => files[path.basename(file)] ?? null, list: () => [] },
      })
    } catch (e) {
      thrown = e
      void thrown.stack
    }
    expect(thrown.message).toBe('include target not found: x$&y.podlite; =set assignments not applied: id')
    expect(thrown.stack.split('\n')[0]).toBe(`Error: ${thrown.message}`)
  })

  it('passes on unchanged whatever the parser throws', () => {
    const files: Record<string, string> = { 'a.podlite': '=head1 A\n' }
    const run = () =>
      resolveIncludes(parseToAst('=pod\n\n=set :id<outer>\n=include file:a.podlite\n'), {
        baseDir: '/virtual',
        parse: () => {
          throw null
        },
        provider: { read: file => files[path.basename(file)] ?? null, list: () => [] },
      })
    let thrown: unknown = 'nothing'
    try {
      run()
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeNull()
  })

  it('without an error handler, names in the thrown error what the including files lost', () => {
    const files: Record<string, string> = { 'a.podlite': '=set :lang<inner>\n=include file:absent.podlite\n' }
    expect(() =>
      resolveIncludes(parseToAst('=pod\n\n=set :id<outer>\n=include file:a.podlite\n'), {
        baseDir: '/virtual',
        parse: parseToAst,
        provider: { read: file => files[path.basename(file)] ?? null, list: () => [] },
      }),
    ).toThrow('include target not found: absent.podlite; =set assignments not applied: lang, id')
  })

  it('without an error handler, the first error is thrown and the walk stops there', () => {
    const got: string[] = []
    expect(() =>
      resolveIncludes(parseToAst(doc), {
        baseDir: '/virtual',
        parse,
        provider,
        onWarning: w => got.push(`warning ${w.kind}`),
      }),
    ).toThrow('include target not found: absent.podlite')
    expect(got).toEqual(['warning unsupported-scheme'])
  })
})
