import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { lintFile, lintSource } from '../src/lint'
import { parseContent } from '../src/lint/loader'
import { includeResolvesRule } from '../src/lint/rules/include-resolves'
import { sourcesFromFiles } from '../src/assemble'
import { INCLUDE_RESOLVES_RULE_ID } from '../src/lint/rules/include-resolves'

const dir = mkdtempSync(join(tmpdir(), 'podlite-includes-'))
writeFileSync(join(dir, 'guide.podlite'), '=pod\n\n=head1 Intro\n\n=for para :id<ok>\nText.\n')
writeFileSync(join(dir, 'twice.podlite'), '=pod\n\n=for para :id<x>\nOne.\n\n=for para :id<x>\nTwo.\n')
writeFileSync(join(dir, 'inner.podlite'), '=pod\n\n=include file:./absent.podlite\n')
mkdirSync(join(dir, 'parts'))
writeFileSync(join(dir, 'parts', 'a.podlite'), '=pod\n\n=for para :id<a>\nA.\n')
mkdirSync(join(dir, 'folder.podlite'))
mkdirSync(join(dir, 'empty'))
writeFileSync(join(dir, 'section.podlite'), '=begin pod\n=begin markdown\n# Title\n\nText.\n=end markdown\n=end pod\n')
writeFileSync(
  join(dir, 'picture.podlite'),
  '=begin pod\n=for picture :id<shot>\nphoto.png\n\n=Image other.png\n=end pod\n',
)
writeFileSync(join(dir, 'section.md'), '# Title\n\nText.\n')
writeFileSync(join(dir, 'contents.podlite'), '=begin pod\n=toc file:other.podlite | head1\n\n=head1 One\n=end pod\n')

const lint = (name: string, src: string) => {
  const file = join(dir, name)
  writeFileSync(file, src)
  return lintFile(file, {}).violations.filter(v => v.rule === INCLUDE_RESOLVES_RULE_ID)
}

describe('include-resolves rule', () => {
  it('finds a heading written in a Markdown section of an included file', () => {
    expect(lint('doc10.podlite', '=pod\n\n=include file:./section.podlite#Title\n')).toEqual([])
  })

  it('reads an included Markdown file as Markdown', () => {
    expect(lint('doc11.podlite', '=pod\n\n=include file:./section.md#Title\n')).toEqual([])
  })

  it('finds a picture of an included file by its address and by its name, with no image plugin', () => {
    expect(lint('doc13.podlite', '=pod\n\n=include file:./picture.podlite#shot\n')).toEqual([])
    expect(lint('doc14.podlite', '=pod\n\n=include file:./picture.podlite | picture\n')).toEqual([])
    expect(lint('doc15.podlite', '=pod\n\n=include file:./picture.podlite#absent\n')).toHaveLength(1)
  })

  it('keeps the warnings of a plugin reading an included file off the console', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      lint('doc12.podlite', '=begin pod\n=config para :lang<en>\n\n=include file:./contents.podlite\n=end pod\n')
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('reports a missing source at its directive', () => {
    const v = lint('doc1.podlite', '=pod\n\n=include file:./absent.podlite\n')
    expect(v.map(x => [x.severity, x.location?.start.line])).toEqual([['error', 3]])
    expect(v[0].message).toMatch(/absent\.podlite/)
  })

  it('reports an address the file does not hold', () => {
    const v = lint('doc2.podlite', '=pod\n\n=include file:./guide.podlite#missing\n')
    expect(v.map(x => x.severity)).toEqual(['error'])
    expect(v[0].message).toMatch(/#missing/)
  })

  it('reports a problem in an included file at the directive that brought it in', () => {
    const v = lint('doc3.podlite', '=pod\n\nText.\n\n=include file:./inner.podlite\n')
    expect(v.map(x => x.location?.start.line)).toEqual([5])
    expect(v[0].message).toMatch(/inner\.podlite:3/)
  })

  it('reports a directory named as a source', () => {
    expect(lint('doc4.podlite', '=pod\n\n=include file:./folder.podlite\n')).toHaveLength(1)
  })

  it('reports an address no file of a mask holds', () => {
    expect(lint('doc5.podlite', '=pod\n\n=include file:./parts/*.podlite#b\n')).toHaveLength(1)
  })

  it('reports an operand of in that does not resolve', () => {
    const v = lint(
      'doc9.podlite',
      '=pod\n\n=include file:./guide.podlite | para[ :id(in file:./absent.podlite | defn) ]\n',
    )
    expect(v.map(x => [x.severity, x.location?.start.line])).toEqual([['error', 3]])
  })

  it('warns when an address names two blocks', () => {
    expect(lint('doc6.podlite', '=pod\n\n=include file:./twice.podlite#x\n').map(x => x.severity)).toEqual(['warning'])
  })

  it('warns when an include selector cannot be read', () => {
    const v = lint('doc9.podlite', '=pod\n\n=include file:./guide.podlite | head1[\n')
    expect(v.map(x => [x.severity, x.location?.start.line])).toEqual([['warning', 3]])
  })

  it('reports only the include that loses content', () => {
    const src = [
      '=pod',
      '',
      '=include file:./guide.podlite#ok',
      '',
      '=include file:./guide.podlite | test',
      '',
      '=include file:./empty/*.podlite',
      '',
      '=begin code',
      '=include file:./absent.podlite',
      '=end code',
      '',
      '=include file:./guide.podlite#nothing',
      '',
    ].join('\n')
    expect(lint('doc7.podlite', src).map(x => x.location?.start.line)).toEqual([13])
  })

  it('checks a document read from disk and not text handed in by name', () => {
    const src = '=pod\n\n=include file:./absent.podlite\n'
    const file = join(dir, 'doc8.podlite')
    writeFileSync(file, src)
    const fromDisk = lintFile(file, {}).violations.filter(v => v.rule === INCLUDE_RESOLVES_RULE_ID)
    const byName = lintSource(readFileSync(file, 'utf-8'), file, {}).violations.filter(
      v => v.rule === INCLUDE_RESOLVES_RULE_ID,
    )
    const markdown = lint('doc8.md', src)
    expect([fromDisk.length, byName.length, markdown.length]).toEqual([1, 0, 0])
  })

  it('checks text handed in by name against the sources a host gives', () => {
    const src = '=pod\n\n=include file:part.podlite\n\n=include file:absent.podlite\n'
    const check = (files: Record<string, string>) =>
      includeResolvesRule.check(parseContent(src, 'podlite'), {
        filePath: 'input.podlite',
        fileType: 'podlite',
        config: {},
        sources: sourcesFromFiles(files),
        context: '',
        self: '/input.podlite',
      })
    expect(check({ 'part.podlite': '=pod\n\nPart.\n' }).map(v => [v.severity, v.location?.start.line])).toEqual([
      ['error', 5],
    ])
  })

  it('names a file of the given set as the host named it', () => {
    const src = '=pod\n\n=include file:part.podlite\n'
    const [violation] = includeResolvesRule.check(parseContent(src, 'podlite'), {
      filePath: 'input.podlite',
      fileType: 'podlite',
      config: {},
      sources: sourcesFromFiles({ 'part.podlite': '=pod\n\n=include file:absent.podlite\n' }),
      context: '',
      self: '/input.podlite',
    })
    expect(violation.message).toContain('(in part.podlite:3)')
  })

  it('names a nested file of the given set from the context it is resolved from', () => {
    const src = '=pod\n\n=include file:part.podlite\n'
    const [violation] = includeResolvesRule.check(parseContent(src, 'podlite'), {
      filePath: 'input.podlite',
      fileType: 'podlite',
      config: {},
      sources: sourcesFromFiles({
        'lib/part.podlite': '=pod\n\n=include file:sub/leaf.podlite\n',
        'lib/sub/leaf.podlite': '=pod\n\n=include file:missing.podlite\n',
      }),
      context: 'lib',
    })
    expect(violation.message).toContain('(in sub/leaf.podlite:3)')
  })
})

