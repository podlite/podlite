import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getTextContentFromNode, runSelector } from '@podlite/schema'
import { collectTests } from '../src/test/collect'
import type { Collection } from '../src/test/collect'
import { coreProfile, prepareDocument, schemaProfile } from '../src/test/documents'
import type { Profile } from '../src/test/documents'
import { inputsFor, prepareSupplied } from '../src/test/sources'
import type { AssertionInput, InputEnvironment } from '../src/test/sources'
import type { CollectedTest, Result, RunContext } from '../src/test/types'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-inputs-')))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  const file = path.join(dir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  return file
}

const block = (name: string, body: string, attrs = ''): string => `=begin ${name}${attrs}\n${body}\n=end ${name}\n`

const aTest = (parts: string[], id = 'x'): string => `=begin test :id<${id}>\n${parts.join('\n')}\n=end test\n`

const collect = (...files: string[]): Collection =>
  collectTests(files.map(file => ({ kind: 'file' as const, path: file })))

const envOf = (collection: Collection, supplied: string[] = [], profile: Profile = coreProfile): InputEnvironment => ({
  profile,
  supplied: supplied.map(file => prepareSupplied(file, profile)),
  containing: index => collection.sources.find(s => s.index === index),
})

const inputOf = (
  test: CollectedTest,
  index: number,
  context: RunContext,
  env: InputEnvironment,
): Result<AssertionInput, { kind: string }> => inputsFor(test, context, env)(test.asserts[index])

const headings = (input: Result<AssertionInput, { kind: string }>): string[] => {
  if (input.ok === false) return [`failed: ${input.error.kind}`]
  return runSelector('head1, head2', [{ file: 'doc', node: input.value.target }]).map((n: any) =>
    String(getTextContentFromNode(n.content)).trim(),
  )
}

const fixture = '=head1 From fixture'
const fixtureContext: RunContext = { kind: 'fixture-or-named' }

describe('the document an assertion is resolved against', () => {
  it('is the supplied document, and a fixture that would not read is left unread', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest([block('fixture', '=include file:./absent.podlite'), block('assert', 'head1')])}`,
    )
    const doc = write('doc.podlite', '=pod\n\n=head1 From supplied\n')
    const collection = collect(main)
    const [test] = collection.tests
    expect(headings(inputOf(test, 0, { kind: 'supplied', document: 0 }, envOf(collection, [doc])))).toEqual([
      'From supplied',
    ])
    expect(headings(inputOf(test, 0, fixtureContext, envOf(collection)))).toEqual(['failed: input-error'])
  })

  it('is a named source before a supplied one, and the file of the tests does not stand for a supplied document', () => {
    write('named.podlite', '=pod\n\n=head1 From named\n')
    const main = write(
      'rules.podlite',
      `=pod\n\n=head1 From rules\n\n${aTest([
        block('fixture', fixture),
        block('assert', 'file:./named.podlite | head1'),
        block('assert', 'head1'),
      ])}`,
    )
    const doc = write('doc.podlite', '=pod\n\n=head1 From supplied\n')
    const collection = collect(main)
    const [test] = collection.tests
    const supplied = envOf(collection, [doc])
    expect(headings(inputOf(test, 0, { kind: 'supplied', document: 0 }, supplied))).toEqual(['From named'])
    expect(headings(inputOf(test, 1, fixtureContext, envOf(collection)))).toEqual(['From fixture'])
  })

  it('is the fixture nearest before the assertion, across a resource and a comment', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest([
        block('fixture', '=head1 First'),
        block('assert', 'head1'),
        block('fixture', '=head1 Second'),
        block('resource', '=head1 R', ' :name<r.podlite>'),
        '=comment between',
        '',
        block('assert', 'head1'),
      ])}`,
    )
    const collection = collect(main)
    const [test] = collection.tests
    const env = envOf(collection)
    expect([headings(inputOf(test, 0, fixtureContext, env)), headings(inputOf(test, 1, fixtureContext, env))]).toEqual([
      ['First'],
      ['Second'],
    ])
  })

  it('reads a relative source from the file the test is written in, not from the file that included it', () => {
    write('t/near.podlite', '=pod\n\n=head1 Next to the test\n')
    write('near.podlite', '=pod\n\n=head1 Next to the main file\n')
    write('t/one.podlite', `=pod\n\n${aTest([block('assert', 'file:./near.podlite | head1')], 'one')}`)
    const main = write('main.podlite', '=pod\n\n=include file:./t/one.podlite#one\n')
    const collection = collect(main)
    expect(headings(inputOf(collection.tests[0], 0, fixtureContext, envOf(collection)))).toEqual(['Next to the test'])
  })

  it('does not stand in for a source that cannot be read', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest([block('assert', 'file:./absent.podlite | head1', ' :absent')])}`,
    )
    const collection = collect(main)
    const input = inputOf(collection.tests[0], 0, fixtureContext, envOf(collection))
    expect(input.ok === false && input.error.kind).toBe('source-unavailable')
  })

  it('tells a fixture that cannot be read from one with nothing in it, and reads only the fixture in use', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest([
        block('fixture', '=include file:./absent.podlite'),
        block('assert', 'head1'),
        block('fixture', '=para nothing'),
        block('assert', 'head1'),
      ])}`,
    )
    const collection = collect(main)
    const [test] = collection.tests
    const env = envOf(collection)
    expect(headings(inputOf(test, 1, fixtureContext, env))).toEqual([])
    expect(headings(inputOf(test, 0, fixtureContext, env))).toEqual(['failed: input-error'])
  })
})

describe('preparing a document', () => {
  const prepare = (file: string, profile: Profile = coreProfile) => {
    const prepared = prepareDocument(
      { name: file, text: fs.readFileSync(file, 'utf-8'), baseDir: path.dirname(file), self: file },
      { profile },
    )
    if (prepared.ok === false) throw new Error(prepared.error)
    return prepared.value
  }

  it('gives an included block the configuration of the including file', () => {
    write('part.podlite', '=pod\n\n=para Included.\n')
    const main = write('main.podlite', '=pod\n\n=config para :x<1>\n\n=para Own.\n\n=include file:./part.podlite\n')
    const doc = prepare(main)
    const paras = runSelector('para', [{ file: 'doc', node: doc.tree }]).map((n: any) => [
      path.basename(doc.origin.get(n)?.file ?? ''),
      (n.config ?? []).some((c: any) => c.name === 'x'),
    ])
    expect(paras).toEqual([
      ['main.podlite', true],
      ['part.podlite', true],
    ])
  })

  it('keeps the file a Markdown block was written in after it is read', () => {
    write('t/md.podlite', '=pod\n\n=begin markdown\n# Title\n\n```js\nlet a\n```\n=end markdown\n')
    const main = write('main.podlite', '=pod\n\n=include file:./t/md.podlite\n')
    const doc = prepare(main)
    const code = runSelector('code', [{ file: 'doc', node: doc.tree }])
    expect(code.map((n: any) => path.relative(dir, doc.origin.get(n)?.file ?? ''))).toEqual(['t/md.podlite'])
  })

  it('names the profile it was read with, and reads a Markdown fence only with the plugins', () => {
    const file = write('fence.podlite', '=pod\n\n=begin markdown\n```js\nlet a\n```\n=end markdown\n')
    const found = [coreProfile, schemaProfile].map(profile => {
      const doc = prepare(file, profile)
      return [doc.profile, runSelector('code', [{ file: 'doc', node: doc.tree }]).length]
    })
    expect(found).toEqual([
      ['core', 1],
      ['schema', 0],
    ])
  })
})
