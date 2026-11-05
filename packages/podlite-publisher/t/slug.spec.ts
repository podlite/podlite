import { dayInBase60, latinOf } from '../src/slug'
import { addUrl } from '../src/shared'
import * as fs from 'fs'
import * as path from 'path'

// taken from the libraries the addresses were published with, before they were replaced
const { latin, dates }: { latin: string[][]; dates: [number | string, string][] } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/slug-expected.json'), 'utf8'),
)

describe('the date of a short address', () => {
  for (const [ms, sxg] of dates)
    it(`writes ${ms} as ${JSON.stringify(sxg)}`, () => {
      expect(dayInBase60(new Date(ms))).toBe(sxg)
    })
})

describe('the Latin letters of a title', () => {
  for (const [text, out] of latin)
    it(`writes ${JSON.stringify(text)} as ${JSON.stringify(out)}`, () => {
      expect(latinOf(String(text))).toBe(out)
    })
})

describe('the addresses of a record', () => {
  it('keeps the addresses records were published under', () => {
    const records = [
      {
        title: '\u0417\u0430\u043c\u0435\u0442\u043a\u0430 \u043e Podlite',
        pubdate: '2026-11-04T12:00:00Z',
        type: 'note',
      },
      { title: 'i\u0411\u0412 \u0430\u1c80\u0431', pubdate: '2026-11-04T12:00:00Z', type: 'note' },
      { title: 'Plain title', pubdate: '1970-01-01T12:00:00Z', type: 'page' },
    ]
    const made = addUrl(records as never).map(r => [r.shortUrl, r.publishUrl])
    expect(made).toEqual([
      ['/n5m11', '/2026/11/4/1/zametka-o-podlite'],
      ['/n5m12', '/2026/11/4/2/ibv-aundefinedb'],
      ['/a01', '/1970/1/1/1/plain-title'],
    ])
  })
})
