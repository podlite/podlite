import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getTextContentFromNode, runSelector } from '@podlite/schema'
import { collectTests } from '../src/test/collect'
import type { Collection } from '../src/test/collect'
import { coreProfile } from '../src/test/documents'
import { inputsFor, prepareSupplied } from '../src/test/sources'
import type { InputEnvironment } from '../src/test/sources'
import type { CollectedTest, RunContext } from '../src/test/types'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-resources-')))
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
const resource = (name: string, body: string): string => block('resource', body, ` :name<${name}>`)
const aTest = (id: string, parts: string[]): string => `=begin test :id<${id}>\n${parts.join('\n')}\n=end test\n`

const collect = (file: string): Collection => collectTests([{ kind: 'file', path: file }])

const envOf = (collection: Collection, supplied: string[] = []): InputEnvironment => ({
  profile: coreProfile,
  supplied: supplied.map(file => prepareSupplied(file, coreProfile)),
  containing: index => collection.sources.find(s => s.index === index),
})

const headings = (test: CollectedTest, index: number, env: InputEnvironment, context?: RunContext): string[] => {
  const input = inputsFor(test, context ?? { kind: 'fixture-or-named' }, env)(test.asserts[index])
  if (input.ok === false) return [`failed: ${input.error.kind}`]
  return runSelector('head1', [{ file: 'doc', node: input.value.target }]).map((n: any) =>
    String(getTextContentFromNode(n.content)).trim(),
  )
}

describe('the resources of a test', () => {
  it('are read by the fixture, a nested one from the directory of the resource that names it', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('nested', [
        block('fixture', '=include file:./includes/guide.podlite'),
        resource('includes/guide.podlite', '=head1 Guide\n\n=include file:./parts/detail.podlite'),
        resource('includes/parts/detail.podlite', '=head1 Detail'),
        block('assert', 'head1'),
      ])}`,
    )
    const collection = collect(main)
    expect(headings(collection.tests[0], 0, envOf(collection))).toEqual(['Guide', 'Detail'])
  })

  it('are all a fixture reads: a file next to the test, an absolute path and a way out are not there', () => {
    write('real.podlite', '=pod\n\n=head1 On disk\n')
    const fixtures = [
      '=include file:./real.podlite',
      `=include file:${path.join(dir, 'real.podlite')}`,
      '=include file:../real.podlite',
    ]
    const main = write(
      'rules.podlite',
      `=pod\n\n${fixtures.map((f, i) => aTest(`t${i}`, [block('fixture', f), block('assert', 'head1')])).join('\n')}`,
    )
    const collection = collect(main)
    const env = envOf(collection)
    expect(collection.tests.map(test => headings(test, 0, env))).toEqual([
      ['failed: input-error'],
      ['failed: input-error'],
      ['failed: input-error'],
    ])
  })

  it('belong to one test: two tests with a resource of one name each read their own', () => {
    const parts = (heading: string): string[] => [
      block('fixture', '=include file:./shared.podlite'),
      resource('shared.podlite', `=head1 ${heading}`),
      block('assert', 'head1'),
    ]
    const main = write('rules.podlite', `=pod\n\n${aTest('a', parts('First'))}\n${aTest('b', parts('Second'))}`)
    const collection = collect(main)
    const env = envOf(collection)
    expect(collection.tests.map(test => headings(test, 0, env))).toEqual([['First'], ['Second']])
  })

  it('are not read by a source the assertion names or by a supplied document', () => {
    write('named.podlite', '=pod\n\n=include file:./shared.podlite\n')
    const doc = write('doc.podlite', '=pod\n\n=include file:./shared.podlite\n')
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('c', [
        resource('shared.podlite', '=head1 From resource'),
        block('assert', 'file:./named.podlite | head1'),
        block('assert', 'head1'),
      ])}`,
    )
    const collection = collect(main)
    const env = envOf(collection, [doc])
    const [test] = collection.tests
    expect([headings(test, 0, env), headings(test, 1, env, { kind: 'supplied', document: 0 })]).toEqual([
      ['failed: input-error'],
      ['failed: input-error'],
    ])
  })
})
