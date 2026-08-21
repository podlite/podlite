import { processFile } from '../src/node-utils'
import { buildPagesIndex } from '../src/dump-pages-plugin'

const source = `
=begin pod :puburl</doc>

=TITLE Documentation

=end pod
`
const base = processFile('t/dump-pages/doc.podlite', source)
const record = Object.assign({}, base, { indexing: { robots: true, search: false } })
const places = [{ offset: 0, length: 128 }]

it('buildPagesIndex: carries the named fields and the place of the record', () => {
  const [entry] = buildPagesIndex([base], places)
  expect(entry).toMatchObject({
    publishUrl: '/doc',
    title: 'Documentation\n',
    file: 't/dump-pages/doc.podlite',
    offset: 0,
    length: 128,
  })
})

it('buildPagesIndex: leaves the parsed tree out', () => {
  const [entry] = buildPagesIndex([base], places)
  expect(entry).not.toHaveProperty('node')
})

it('buildPagesIndex: carries a field the site asks for', () => {
  const [entry] = buildPagesIndex([record], places, ['indexing'])
  expect(entry).toHaveProperty('indexing', { robots: true, search: false })
})

it('buildPagesIndex: a field the record does not have comes out undefined', () => {
  const [entry] = buildPagesIndex([record], places, ['nowhere'])
  expect(entry).toHaveProperty('nowhere', undefined)
})

it('buildPagesIndex: the place of the record wins over a field of the same name', () => {
  const collides = Object.assign({}, base, { offset: 42 })
  const [entry] = buildPagesIndex([collides], places, ['offset'])
  expect(entry).toHaveProperty('offset', 0)
})
