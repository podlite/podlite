import * as fs from 'fs'
import * as path from 'path'
import { parseText, processFile } from '../src/node-utils'
import { catalogueOf, idOfFile } from '../src/catalogue'
import { withSource } from '../src/source'
import { readFrontMatter } from '../src/front-matter'
import matter from 'gray-matter'

// front matter whose code, if it ran, would set a mark on the global object
const running = (language: string, before = '', after = '') =>
  `${before}---${language}${after}\n(globalThis.__frontMatterRan = 1, { title: 'Run' })\n---\n# Body\n`
const mark = () => Reflect.get(globalThis, '__frontMatterRan')

// the three ways the publisher reads front matter: a Markdown tree, the attributes
// of a file, the text of a record the catalogue gives an include
const readers: { [name: string]: (file: string, text: string) => unknown } = {
  parseText: (file, text) => parseText(file, text),
  processFile: (file, text) => processFile(file, text),
  catalogue: (file, text) =>
    catalogueOf([withSource(processFile(file, '# Body\n'), file, text)]).textOf(idOfFile(file)),
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, '__frontMatterRan')
})

describe('front matter in a language other than YAML or JSON', () => {
  const cases: Array<[string, string, string?, string?]> = [
    ['javascript', 'javascript'],
    ['js', 'js'],
    ['JS', 'JS'],
    ['JavaScript', 'JavaScript'],
    ['js after a byte order mark', 'js', '﻿'],
    ['js with spaces and a tab after it', 'js', '', ' \t'],
    ['js with a carriage return', 'js', '', '\r'],
  ]
  for (const [name, reader] of Object.entries(readers))
    for (const [label, language, before, after] of cases)
      it(`does not run through ${name}: ${label}`, () => {
        expect(() => reader('notes/a.md', running(language, before, after))).toThrow(
          /front matter in notes\/a\.md is written in (?:js|javascript); only YAML and JSON are read/i,
        )
        expect(mark()).toBeUndefined()
      })

  it('refuses a language named after a property of every object', () => {
    expect(() => processFile('a.md', '---constructor\nabc\n---\nBody\n')).toThrow(/written in constructor/)
  })

  it('refuses an empty front matter in such a language as well', () => {
    expect(() => processFile('a.md', '---toml\n\n---\nBody\n')).toThrow(/written in toml/)
    expect(() => processFile('a.md', '---coffee\n# a comment\n---\nBody\n')).toThrow(/written in coffee/)
  })

  it('is read by one module only', () => {
    const dir = path.join(__dirname, '../src')
    const modules = fs
      .readdirSync(dir)
      .filter(file => /\.tsx?$/.test(file))
      .filter(file => /gray-matter/.test(fs.readFileSync(path.join(dir, file), 'utf8')))
    expect(modules).toEqual(['front-matter.ts'])
  })
})

describe('front matter in YAML or JSON reads as before', () => {
  const yamlHead = 'title: Hello\npubdate: 2026-11-04\npuburl: /hello\n'
  for (const head of ['---', '---yaml', '---yml', '---YAML'])
    it(`reads ${head}`, () => {
      const record = processFile('a.md', `${head}\n${yamlHead}---\n# Hello\n`)
      expect(record.title).toBe('Hello')
      expect(record.publishUrl).toBe('/hello')
    })

  it('keeps a date of YAML a date', () => {
    expect(readFrontMatter(`---\n${yamlHead}---\nBody`).data.pubdate).toBeInstanceOf(Date)
  })

  it('keeps the body after front matter in YAML and in JSON', () => {
    expect(readFrontMatter(`---\n${yamlHead}---\n# Hello\n`).content).toBe('# Hello\n')
    expect(readFrontMatter('---json\n{ "title": "Hello" }\n---\n# Hello\n').content).toBe('# Hello\n')
  })

  it('keeps the date of JSON front matter as written', () => {
    const record = processFile('a.md', '---json\n{ "title": "Hello", "pubdate": "2026-11-04" }\n---\n# Hello\n')
    expect(record.pubdate).toBe('2026-11-04')
  })

  it('gives no fields for front matter that holds no mapping', () => {
    expect(readFrontMatter('---\n42\n---\nBody').data).toEqual({})
    expect(readFrontMatter('---\n- a\n---\nBody').data).toEqual({})
  })

  for (const head of ['---json', '---JSON'])
    it(`reads ${head}`, () => {
      const record = processFile('a.md', `${head}\n{ "title": "Hello", "puburl": "/hello" }\n---\n# Hello\n`)
      expect(record.title).toBe('Hello')
      expect(record.publishUrl).toBe('/hello')
    })

  it('leaves a text without front matter whole', () => {
    for (const text of ['', '# Title\nBody\n', '----\nBody\n', '﻿﻿---yaml\ntitle: t\n---\nBody'])
      expect(readFrontMatter(text)).toEqual(pick(matter(text, {})))
  })

  it('reads front matter after one byte order mark', () => {
    expect(readFrontMatter('﻿---yaml\ntitle: t\n---\nBody')).toEqual({ data: { title: 't' }, content: 'Body' })
  })

  it('leaves a Podlite file with dashes alone', () => {
    const tree = parseText('a.podlite', '=begin pod\n---js\n(globalThis.__frontMatterRan = 1)\n---\n=end pod\n')
    expect(tree).toBeTruthy()
    expect(mark()).toBeUndefined()
  })
})

const pick = (file: { data: object; content: string }) => ({ data: file.data, content: file.content })
