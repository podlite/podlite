import { makeAttrs } from '../src/helpers/config'

const mkNode = (config: Array<{ name: string; value: any; type?: string }>) => ({
  name: 'block',
  config,
})

it('getFirstValue returns value for string attr', () => {
  const attrs = makeAttrs(mkNode([{ name: 'caption', type: 'string', value: 'Hello' }]))
  expect(attrs.exists('caption')).toBe(true)
  expect(attrs.getFirstValue('caption')).toBe('Hello')
})

it('getAllValues spreads array values', () => {
  const attrs = makeAttrs(mkNode([{ name: 'levels', type: 'array', value: [2, 3] }]))
  expect(attrs.getAllValues('levels')).toEqual([2, 3])
})

it('getMapValue returns the map object for type="map"', () => {
  const attrs = makeAttrs(mkNode([{ name: 'folded-levels', type: 'map', value: { 2: 1, 3: 0 } }]))
  expect(attrs.getMapValue('folded-levels')).toEqual({ 2: 1, 3: 0 })
})

it('getMapValue returns undefined for absent attr', () => {
  const attrs = makeAttrs(mkNode([]))
  expect(attrs.getMapValue('missing')).toBeUndefined()
})

it('getMapValue returns undefined when value is array', () => {
  const attrs = makeAttrs(mkNode([{ name: 'levels', type: 'array', value: [2, 3] }]))
  expect(attrs.getMapValue('levels')).toBeUndefined()
})

it('getMapValue returns undefined when value is primitive', () => {
  const attrs = makeAttrs(mkNode([{ name: 'folded', type: 'boolean', value: true }]))
  expect(attrs.getMapValue('folded')).toBeUndefined()
})
