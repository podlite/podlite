const makePlug = require('./makeQuery').makePlug

const fixtures = [
  'name:block',
  {
    name: 'name',
    type: 'block',
  },
  'C<>',
  {
    name: 'C',
    type: 'fcode',
  },
  ':blankline',
  {
    type: 'blankline',
  },
  '*:block',
  {
    type: 'block',
  },
  '*:*',
  {},
  '*',
  {},
  '<>',
  {
    type: 'fcode',
  },
  'name',
  {
    name: 'name',
    type: 'block',
  },
  'Special<>',
  {
    name: 'Special',
    type: 'fcode',
  },
]

const pairs = fixtures.reduce(function (result, value, index, array) {
  if (index % 2 === 0) result.push(array.slice(index, index + 2))
  return result
}, [])

const log = a => console.log(JSON.stringify(a, null, 2))

describe('run make query helpers tests', () => {
  pairs.map(([k, v], idx) => {
    test(`test ${idx}`, () => expect(makePlug(k)).toEqual(v))
  })
})
