import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse, toHtml, toMarkdown } = require('../lib/index.js')

const prose = level =>
  [
    `=head${level} Section ${level}`,
    '',
    'A paragraph with B<bold>, I<italic>, C<code> and L<a link|https://podlite.org>.',
    '',
    '=item1 first point',
    '=item2 nested point',
    '',
  ].join('\n')

const table = rows =>
  [
    '=begin table :caption(<Numbers>)',
    ' Name  | Count | Note',
    ' ======|=======|=====',
    ...Array.from({ length: rows }, (_, i) => ` row${i} | ${i} | C<code> and text`),
    '=end table',
    '',
  ].join('\n')

const document = ['=pod', '', ...Array.from({ length: 40 }, (_, i) => prose((i % 6) + 1)), table(30)].join('\n')

const long = ['=pod', '', ...Array.from({ length: 400 }, (_, i) => prose((i % 6) + 1))].join('\n')

const tree = parse(document, { podMode: 1 })
const root = { type: 'block', name: 'pod', margin: '', content: tree }

export default [
  { name: 'schema: parse a mixed document', run: () => parse(document, { podMode: 1 }) },
  { name: 'schema: parse a long document', rounds: 10, run: () => parse(long, { podMode: 1 }) },
  { name: 'schema: parse a table of 30 rows', run: () => parse(table(30), { podMode: 1 }) },
  { name: 'schema: render to html', run: () => toHtml({}).run(root).toString() },
  { name: 'schema: render to markdown', run: () => toMarkdown({}).run(root).toString() },
]
