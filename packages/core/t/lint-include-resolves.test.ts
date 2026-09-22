import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { lintFile, lintSource } from '../src/lint'
import { INCLUDE_RESOLVES_RULE_ID } from '../src/lint/rules/include-resolves'

const dir = mkdtempSync(join(tmpdir(), 'podlite-includes-'))
writeFileSync(join(dir, 'guide.podlite'), '=pod\n\n=head1 Intro\n\n=for para :id<ok>\nText.\n')
writeFileSync(join(dir, 'twice.podlite'), '=pod\n\n=for para :id<x>\nOne.\n\n=for para :id<x>\nTwo.\n')
writeFileSync(join(dir, 'inner.podlite'), '=pod\n\n=include file:./absent.podlite\n')
mkdirSync(join(dir, 'parts'))
writeFileSync(join(dir, 'parts', 'a.podlite'), '=pod\n\n=for para :id<a>\nA.\n')
mkdirSync(join(dir, 'folder.podlite'))
mkdirSync(join(dir, 'empty'))

const lint = (name: string, src: string) => {
  const file = join(dir, name)
  writeFileSync(file, src)
  return lintFile(file, {}).violations.filter(v => v.rule === INCLUDE_RESOLVES_RULE_ID)
}

describe('include-resolves rule', () => {
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
})
