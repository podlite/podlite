import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { toHtml, toMarkdown } from '@podlite/schema'
import { podlite } from '../src/index'
import { resolveIncludes } from '../src/resolve-includes'

const SECRET = 'hunter2'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-guard-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const write = (name: string, body: string): string => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, body)
  return file
}

const p = podlite({ importPlugins: true })
const parseToAst = (source: string) => p.toAst(p.parse(source, { podMode: 1 }))

const render = (file: string, mode: 'production' | 'draft'): string => {
  const tree = resolveIncludes(parseToAst(fs.readFileSync(file, 'utf-8')), {
    baseDir: path.dirname(file),
    parse: parseToAst,
  })
  return String(toHtml({ renderMode: mode }).run(tree).toString())
}

const renderSource = (source: string, mode: 'production' | 'draft'): string =>
  String(toHtml({ renderMode: mode }).run(parseToAst(source)).toString())

describe('covered content pulled out by =include', () => {
  const secret = ['=begin pod', '', `=for para :masked :id<s1>`, `${SECRET} lives here`, '', '=end pod', ''].join('\n')

  it('stays covered when a selector lifts the block out', () => {
    write('secret.podlite', secret)
    const main = write('main.podlite', '=pod\n\n=include file:secret.podlite | para[:id<s1>]\n')
    expect(render(main, 'production')).not.toContain(SECRET)
    expect(render(main, 'draft')).toContain(SECRET)
  })

  it('stays covered when the whole file is inlined', () => {
    write('secret.podlite', secret)
    const main = write('main.podlite', '=pod\n\n=include file:secret.podlite\n')
    expect(render(main, 'production')).not.toContain(SECRET)
    expect(render(main, 'draft')).toContain(SECRET)
  })

  it('stays covered when a directory mask lifts it out', () => {
    fs.mkdirSync(path.join(dir, 'inc'))
    fs.writeFileSync(path.join(dir, 'inc', 'a.podlite'), secret)
    const main = write('main.podlite', '=pod\n\n=include file:./inc/*.podlite\n')
    expect(render(main, 'production')).not.toContain(SECRET)
    expect(render(main, 'draft')).toContain(SECRET)
  })

  // the selector lifts the paragraph and leaves the covered wrapper behind, so
  // the lifted node carries no :masked of its own — only the mark put on it
  it('stays covered when a selector lifts content out of a covered wrapper', () => {
    write(
      'wrapper.podlite',
      ['=begin pod :masked', '', `=para ${SECRET} inside the wrapper`, '', '=end pod', ''].join('\n'),
    )
    const main = write('main.podlite', '=pod\n\n=include file:wrapper.podlite | para\n')
    expect(render(main, 'production')).not.toContain(SECRET)
    expect(render(main, 'draft')).toContain(SECRET)
  })

  it('leaves an uncovered neighbour alone', () => {
    write(
      'mixed.podlite',
      ['=begin pod', '', '=for para :masked', SECRET, '', '=para plain sentence', '', '=end pod', ''].join('\n'),
    )
    const main = write('main.podlite', '=pod\n\n=include file:mixed.podlite\n')
    const html = render(main, 'production')
    expect(html).not.toContain(SECRET)
    expect(html).toContain('plain sentence')
  })
})

describe('the cover reaches down the tree', () => {
  it('covers a block nested inside a covered one', () => {
    const source = ['=begin pod :masked', '', '=head1 Title', '', `=para ${SECRET}`, '', '=end pod', ''].join('\n')
    expect(renderSource(source, 'production')).not.toContain(SECRET)
    expect(renderSource(source, 'draft')).toContain(SECRET)
  })

  it('covers a whole document written as covered', () => {
    const source = ['=begin pod :masked', '', `=para ${SECRET}`, '', '=end pod', ''].join('\n')
    expect(renderSource(source, 'production')).not.toContain(SECRET)
  })

  it('covers the inline code as it covers a block', () => {
    expect(renderSource(`=pod\nPassword G<${SECRET}> onwards\n`, 'production')).not.toContain(SECRET)
    expect(renderSource(`=pod\nPassword G<${SECRET}> onwards\n`, 'draft')).toContain(SECRET)
  })
})

// The block that reads a covered =data does not carry the :masked attribute
// itself, so a render-time look at the node cannot know the content is covered.
// These are the cases the mark on the node exists for.
describe('covered data read by another block', () => {
  const csv = [
    '=pod',
    '',
    '=begin data :key<rows> :masked :mime-type<text/csv>',
    'name,secret',
    `alpha,${SECRET}`,
    '=end data',
    '',
    '=table data:rows',
    '',
  ].join('\n')
  const plain = [
    '=pod',
    '',
    '=begin data :key<rows> :masked',
    'name,secret',
    `alpha,${SECRET}`,
    '=end data',
    '',
    '=table data:rows',
    '',
  ].join('\n')

  it('stays covered when a table is built from it', () => {
    expect(renderSource(csv, 'production')).not.toContain(SECRET)
    expect(renderSource(csv, 'production')).toContain('<table>')
  })

  it('shows through the table in draft', () => {
    expect(renderSource(csv, 'draft')).toContain(SECRET)
  })

  it('stays covered when the source is not tabular and falls back to a code block', () => {
    expect(renderSource(plain, 'production')).not.toContain(SECRET)
    expect(renderSource(plain, 'draft')).toContain(SECRET)
  })

  it('leaves an uncovered data block readable', () => {
    const open = plain.replace(' :masked', '')
    expect(renderSource(open, 'production')).toContain(SECRET)
  })
})

describe('the cover holds on the markdown path too', () => {
  it('covers a block lifted by =include', () => {
    write('secret.podlite', ['=begin pod', '', '=for para :masked', SECRET, '', '=end pod', ''].join('\n'))
    const main = write('main.podlite', '=pod\n\n=include file:secret.podlite\n')
    const tree = resolveIncludes(parseToAst(fs.readFileSync(main, 'utf-8')), {
      baseDir: path.dirname(main),
      parse: parseToAst,
    })
    expect(String(toMarkdown({ renderMode: 'production' }).run(tree).toString())).not.toContain(SECRET)
    expect(String(toMarkdown({ renderMode: 'draft' }).run(tree).toString())).toContain(SECRET)
  })
})
