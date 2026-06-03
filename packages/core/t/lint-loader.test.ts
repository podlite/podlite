import * as path from 'path'
import { detectFileType, readFile, parseContent } from '../src/lint/loader'

const FIXTURES = path.join(__dirname, 'lint-fixtures')

describe('detectFileType', () => {
  it('.md → md', () => {
    expect(detectFileType('readme.md')).toBe('md')
    expect(detectFileType('/abs/path/notes.md')).toBe('md')
  })

  it('.MD case-insensitive', () => {
    expect(detectFileType('README.MD')).toBe('md')
  })

  it('.podlite → podlite', () => {
    expect(detectFileType('spec.podlite')).toBe('podlite')
  })

  it('.pod6 → podlite', () => {
    expect(detectFileType('legacy.pod6')).toBe('podlite')
  })

  it('unknown extension → podlite (default)', () => {
    expect(detectFileType('file.txt')).toBe('podlite')
    expect(detectFileType('no-extension')).toBe('podlite')
  })
})

describe('readFile', () => {
  it('reads existing file as utf-8', () => {
    const text = readFile(path.join(FIXTURES, 'valid.podlite'))
    expect(text).toContain('=head1 Title')
  })

  it('throws on missing file', () => {
    expect(() => readFile(path.join(FIXTURES, 'nonexistent.podlite'))).toThrow()
  })
})

describe('parseContent', () => {
  it('parses podlite content', () => {
    const text = readFile(path.join(FIXTURES, 'valid.podlite'))
    const ast = parseContent(text, 'podlite')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('block')
  })

  it('parses markdown content via plugin chain', () => {
    const text = readFile(path.join(FIXTURES, 'valid.md'))
    const ast = parseContent(text, 'md')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('block')
    expect(JSON.stringify(ast)).toContain('Heading')
  })

  it('empty content produces a valid AST', () => {
    const ast = parseContent('', 'podlite')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('block')
  })
})
