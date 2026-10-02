import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { ConfigScope } from '@podlite/schema'
import { podlite } from '../src/index'
import { assembleIncludes, sourcesFromFiles } from '../src/assemble'
import type { Sources } from '../src/assemble'
import { resolveIncludes, IncludeProblem } from '../src/resolve-includes'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-external-')))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  const file = path.join(tmpDir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  return file
}

const p = podlite({ importPlugins: true })
const read = (source: string, config?: ConfigScope) => p.toAst(p.parse(source, { podMode: 1, config }), { config })

// what an assembly reports as external: the file and line of the directive, and the message
const external = (file: string, root?: string, tree?: any): string[] => {
  const problems: IncludeProblem[] = []
  resolveIncludes(tree ?? read(fs.readFileSync(file, 'utf-8')), {
    baseDir: path.dirname(file),
    root,
    parse: (source, _file, config) => read(source, config),
    file,
    self: file,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  return problems
    .filter(problem => problem.kind === 'external')
    .map(problem => {
      const at = problem.chain[problem.chain.length - 1]
      return `${path.relative(tmpDir, at.file)}:${at.location?.start.line}: ${problem.message}`
    })
}

const outside = (root: string): string => `outside the root ${root}`

describe('content from outside the root', () => {
  it('names the directive that brings a file from outside the root', () => {
    write('shared/legal.podlite', '=pod\n\n=head1 Legal\n')
    const book = write('book/book.podlite', '=pod\n\n=head1 Book\n\n=include file:../shared/legal.podlite\n')
    const root = path.join(tmpDir, 'book')
    expect(external(book, root)).toEqual([
      `book/book.podlite:5: included file comes from ${outside(root)}: ../shared/legal.podlite`,
    ])
  })

  // a mask over one directory of four files, one of them a link to a file under the root
  const parts = (second: string): void => {
    write('in/a.podlite', '=pod\n\n=head1 A\n')
    fs.mkdirSync(path.join(tmpDir, 'parts'))
    fs.symlinkSync(path.join(tmpDir, 'in/a.podlite'), path.join(tmpDir, 'parts/a.podlite'))
    write('parts/b.podlite', '=pod\n\n=head1 B\n')
    write('parts/c.podlite', `=pod\n\n=${second} C\n`)
    write('parts/d.podlite', `=pod\n\n=${second} D\n`)
  }

  it('counts the files of a mask that come from outside, in one line', () => {
    parts('head1')
    const doc = write('in/doc.podlite', '=pod\n\n=include file:../parts/*.podlite\n')
    const root = path.join(tmpDir, 'in')
    expect(external(doc, root)).toEqual([
      `in/doc.podlite:3: 3 included files come from ${outside(root)}: ../parts/*.podlite`,
    ])
  })

  it('counts only the files whose blocks a selection took', () => {
    parts('head2')
    const doc = write('in/doc.podlite', '=pod\n\n=include file:../parts/*.podlite | head1\n')
    const root = path.join(tmpDir, 'in')
    expect(external(doc, root)).toEqual([
      `in/doc.podlite:3: included file comes from ${outside(root)}: ../parts/*.podlite`,
    ])
  })

  it('is not reported for an address an outside file does not hold', () => {
    write('out/x.podlite', '=pod\n\n=head1 X\n')
    const doc = write(
      'root/doc.podlite',
      '=pod\n\n=include file:../out/x.podlite#Missing\n\n=include file:../out/x.podlite#X\n',
    )
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:5: included file comes from ${outside(root)}: ../out/x.podlite`,
    ])
  })

  it('is not reported for a file read only as an operand, nor for what that file includes', () => {
    write('out/leaf.podlite', '=pod\n\n=defn draft\nLeaf.\n')
    write('out/terms.podlite', '=pod\n\n=defn draft\nDraft.\n\n=include file:./leaf.podlite\n')
    write('root/guide.podlite', '=pod\n\n=for para :status<draft>\nDraft\n')
    write('out/shown.podlite', '=pod\n\n=head1 Shown\n')
    const doc = write(
      'root/doc.podlite',
      '=pod\n\n=include file:./guide.podlite | para[ :status(in file:../out/terms.podlite | defn) ]\n\n=include file:../out/shown.podlite\n',
    )
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:5: included file comes from ${outside(root)}: ../out/shown.podlite`,
    ])
  })

  it('is not reported when the selection of an outer include leaves out what an inner one brought', () => {
    write('out/leaf.podlite', '=pod\n\n=head1 Leaf\n')
    write('root/outer.podlite', '=pod\n\n=head2 Outer\n\n=include file:../out/leaf.podlite\n')
    const cut = write('root/cut.podlite', '=pod\n\n=include file:./outer.podlite | head2\n')
    const whole = write('root/whole.podlite', '=pod\n\n=include file:./outer.podlite\n')
    const root = path.join(tmpDir, 'root')
    expect(external(cut, root)).toEqual([])
    expect(external(whole, root)).toEqual([
      `root/outer.podlite:5: included file comes from ${outside(root)}: ../out/leaf.podlite`,
    ])
  })

  it('is reported once for a file read on its own and with the settings at the directive', () => {
    write('out/part.podlite', '=pod\n\n=para Part\n')
    const doc = write('root/doc.podlite', '=pod\n\n=config para :tag<a>\n\n=include file:../out/part.podlite | para\n')
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:5: included file comes from ${outside(root)}: ../out/part.podlite`,
    ])
  })

  it('is reported for a block placed as its file reads on its own', () => {
    write('out/child.podlite', '=begin data-table :mime-type<text/csv>\na,b\n=end data-table\n')
    const doc = write(
      'root/host.podlite',
      '=config data-table :columns<1>\n\n=include file:../out/child.podlite | cell\n',
    )
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/host.podlite:3: included file comes from ${outside(root)}: ../out/child.podlite`,
    ])
  })

  it('takes a file in a sibling directory as outside, and a directory named with two dots as inside', () => {
    write('root2/x.podlite', '=pod\n\n=head1 X\n')
    write('root/..hidden/y.podlite', '=pod\n\n=head1 Y\n')
    const doc = write(
      'root/doc.podlite',
      '=pod\n\n=include file:../root2/x.podlite\n\n=include file:./..hidden/y.podlite\n',
    )
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:3: included file comes from ${outside(root)}: ../root2/x.podlite`,
    ])
  })

  it('names only the include whose blocks stand, when two read the same file', () => {
    write('out/x.podlite', '=pod\n\n=head1 X\n')
    // the second directive starts at an offset that begins with the digits of the first
    const filler = '=para ' + 'f'.repeat(80) + '\n\n'
    const text = `\n=include file:../out/x.podlite | head2\n\n${filler}=include file:../out/x.podlite\n`
    const doc = write('root/doc.podlite', text)
    expect(text.indexOf('=include', 2)).toBeGreaterThanOrEqual(100)
    expect(text.indexOf('=include', 2)).toBeLessThan(200)
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:6: included file comes from ${outside(root)}: ../out/x.podlite`,
    ])
  })

  it('names only the include whose blocks stand, when both stand in one block of the document', () => {
    write('out/x.podlite', '=pod\n\n=head1 X\n')
    const doc = write(
      'root/doc.podlite',
      '=begin pod\n\n=include file:../out/x.podlite | head2\n\n=include file:../out/x.podlite\n\n=end pod\n',
    )
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:5: included file comes from ${outside(root)}: ../out/x.podlite`,
    ])
  })

  it('is not reported for an outside file that brings no block of its own', () => {
    write('out/empty.podlite', '')
    write('root/inside.podlite', '=pod\n\n=head1 Inside\n')
    write('out/relay.podlite', '=include file:../root/inside.podlite\n')
    write('out/broken.podlite', '=include\n')
    write('out/shown.podlite', '=pod\n\n=head1 Shown\n')
    const doc = write(
      'root/doc.podlite',
      '=pod\n\n=include file:../out/empty.podlite\n\n=include file:../out/relay.podlite\n\n=include file:../out/broken.podlite\n\n=include file:../out/shown.podlite\n',
    )
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:9: included file comes from ${outside(root)}: ../out/shown.podlite`,
    ])
  })

  it('counts an outside file that holds an empty =pod', () => {
    write('out/pod.podlite', '=begin pod\n=end pod\n')
    const doc = write('root/doc.podlite', '=pod\n\n=include file:../out/pod.podlite\n')
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:3: included file comes from ${outside(root)}: ../out/pod.podlite`,
    ])
  })

  it('is reported once for an include in a file that is included twice', () => {
    write('out/leaf.podlite', '=pod\n\n=head1 Leaf\n')
    write('root/part.podlite', '=pod\n\n=include file:../out/leaf.podlite\n')
    const doc = write('root/doc.podlite', '=pod\n\n=include file:./part.podlite\n\n=include file:./part.podlite\n')
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/part.podlite:3: included file comes from ${outside(root)}: ../out/leaf.podlite`,
    ])
  })

  it('does not report the text a table of contents takes from an outside file', () => {
    write('out/leaf.podlite', '=pod\n\n=head1 Secret\n')
    write('root/outer.podlite', '=pod\n\n=toc head1\n\n=include file:../out/leaf.podlite\n')
    write('out/shown.podlite', '=pod\n\n=head1 Shown\n')
    const doc = write(
      'root/doc.podlite',
      '=pod\n\n=include file:./outer.podlite | toc\n\n=include file:../out/shown.podlite\n',
    )
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:5: included file comes from ${outside(root)}: ../out/shown.podlite`,
    ])
  })

  it('cannot tell apart two directives of a tree built without places', () => {
    write('out/x.podlite', '=pod\n\n=head1 X\n')
    const doc = write(
      'root/doc.podlite',
      '=pod\n\n=include file:../out/x.podlite | head2\n\n=include file:../out/x.podlite\n',
    )
    const strip = (node: any): any => {
      if (Array.isArray(node)) return node.map(strip)
      if (!node || typeof node !== 'object') return node
      const { location: _location, ...rest } = node
      return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, strip(value)]))
    }
    const tree = strip(read(fs.readFileSync(doc, 'utf-8')))
    const root = path.join(tmpDir, 'root')
    const problems: IncludeProblem[] = []
    resolveIncludes(tree, {
      baseDir: path.dirname(doc),
      root,
      parse: (source, _file, config) => read(source, config),
      file: doc,
      onWarning: problem => problems.push(problem),
    })
    expect(problems.filter(problem => problem.kind === 'external')).toHaveLength(1)
  })
})

describe('the real path decides what is outside the root', () => {
  it('takes a link under the root to an outside file as outside, and a link outside to a file under it as inside', () => {
    write('out/secret.podlite', '=pod\n\n=head1 Secret\n')
    write('root/own.podlite', '=pod\n\n=head1 Own\n')
    fs.symlinkSync(path.join(tmpDir, 'out/secret.podlite'), path.join(tmpDir, 'root/link.podlite'))
    fs.symlinkSync(path.join(tmpDir, 'root/own.podlite'), path.join(tmpDir, 'out/back.podlite'))
    const doc = write('root/doc.podlite', '=pod\n\n=include file:./link.podlite\n\n=include file:../out/back.podlite\n')
    const root = path.join(tmpDir, 'root')
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:3: included file comes from ${outside(root)}: ./link.podlite`,
    ])
  })

  it('follows a root that is itself a link', () => {
    write('real/own.podlite', '=pod\n\n=head1 Own\n')
    write('out/x.podlite', '=pod\n\n=head1 X\n')
    fs.symlinkSync(path.join(tmpDir, 'real'), path.join(tmpDir, 'alias'))
    const doc = write('real/doc.podlite', '=pod\n\n=include file:./own.podlite\n\n=include file:../out/x.podlite\n')
    const root = path.join(tmpDir, 'alias')
    expect(external(doc, root)).toEqual([
      `real/doc.podlite:5: included file comes from ${outside(root)}: ../out/x.podlite`,
    ])
  })

  const caseless = (): boolean => fs.existsSync(tmpDir.toUpperCase())

  it('takes a root written in another case as the same directory where the disk ignores case', () => {
    if (!caseless()) return
    write('root/own.podlite', '=pod\n\n=head1 Own\n')
    write('out/x.podlite', '=pod\n\n=head1 X\n')
    const doc = write('root/doc.podlite', '=pod\n\n=include file:./own.podlite\n\n=include file:../out/x.podlite\n')
    const root = path.join(tmpDir, 'root').toUpperCase()
    expect(external(doc, root)).toEqual([
      `root/doc.podlite:5: included file comes from ${outside(root)}: ../out/x.podlite`,
    ])
  })

  it('marks nothing when the root does not exist, and nothing without a root', () => {
    write('out/x.podlite', '=pod\n\n=head1 X\n')
    const doc = write('root/doc.podlite', '=pod\n\n=include file:../out/x.podlite\n')
    expect(external(doc, path.join(tmpDir, 'nowhere'))).toEqual([])
    expect(external(doc)).toEqual([])
    expect(external(doc, path.join(tmpDir, 'root'))).toHaveLength(1)
  })
})

describe('sources a host gives', () => {
  const assemble = (text: string, sources: Sources): string[] => {
    const problems: IncludeProblem[] = []
    assembleIncludes(read(text), {
      sources,
      context: '',
      parse: (source, _file, config) => read(source, config),
      onError: problem => problems.push(problem),
      onWarning: problem => problems.push(problem),
    })
    return problems.filter(problem => problem.kind === 'external').map(problem => problem.message)
  }

  it('are not external unless the provider says so', () => {
    const files = { 'a.podlite': '=pod\n\n=head1 A\n' }
    expect(assemble('=pod\n\n=include file:a.podlite\n', sourcesFromFiles(files))).toEqual([])
  })

  it('give one line with a count for each reason when the reasons differ', () => {
    const files = {
      'parts/a.podlite': '=pod\n\n=head1 A\n',
      'parts/b.podlite': '=pod\n\n=head1 B\n',
      'parts/c.podlite': '=pod\n\n=head1 C\n',
      'parts/d.podlite': '=pod\n\n=head1 D\n',
    }
    const known = sourcesFromFiles(files)
    const reasons: Record<string, string> = {
      'a.podlite': 'outside the root /a',
      'b.podlite': 'outside the root /a',
      'c.podlite': 'outside the root /a',
      'd.podlite': 'a remote source',
    }
    const sources: Sources = {
      ...known,
      locate: (...args) => {
        const located = known.locate(...args)
        if (!located) return located
        return {
          ...located,
          sources: located.sources.map(source => ({ ...source, external: reasons[path.basename(source.id)] })),
        }
      },
    }
    expect(assemble('=pod\n\n=include file:parts/*.podlite\n', sources)).toEqual([
      '4 included files: 3 come from outside the root /a, 1 comes from a remote source: parts/*.podlite',
    ])
  })
})
