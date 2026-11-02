import { execFileSync } from 'child_process'
import * as path from 'path'
import { podlitePluggable } from '../src/pluggableParser'

// the parser of this package
const p = podlitePluggable()
const markdown = (doc: string) => String(p.toMarkdown(p.toAst(p.parse(doc, { podMode: 1 }))))
// the readers are modules of their own, so they are run in a process of their own
const cellsByBoth = (texts: string[]) =>
  JSON.parse(
    execFileSync('node', [path.join(__dirname, 'reference-readers.mjs')], {
      input: JSON.stringify({ texts, cells: true }),
      cwd: path.join(__dirname, '../../..'),
      encoding: 'utf8',
    }),
  )
const table = (cell: string, config = '') =>
  `${config}=begin table\n=begin row\n=cell ${cell}\n=cell x\n=end row\n=end table\n`

describe('code with a bar in a cell of a pipe table, read by two readers', () => {
  it('keeps the row whole, and the code as written after an even run of backslashes', () => {
    const docs = [table('C<a|b>'), table('C<a\\\\|b>')]
    for (const [at, read] of cellsByBoth(docs.map(markdown)).entries()) {
      const want = [
        [['a|b'], []],
        [['a\\\\|b'], []],
      ][at]
      for (const rows of [read.marked, read.remark]) expect(rows).toEqual([want])
    }
  })

  it('keeps the row whole after an odd run, showing one backslash more', () => {
    const docs = [table('C<a\\|b>'), table('C<a\\\\\\|b>')]
    for (const [at, read] of cellsByBoth(docs.map(markdown)).entries()) {
      const want = [
        [['a\\\\|b'], []],
        [['a\\\\\\\\|b'], []],
      ][at]
      for (const rows of [read.marked, read.remark]) expect(rows).toEqual([want])
    }
  })

  it('counts a backslash that comes from a character of its own', () => {
    const doc = table('C<aE<0x5C>|b>', '=config C<> :allow<E>\n\n')
    const [read] = cellsByBoth([markdown(doc)])
    for (const rows of [read.marked, read.remark]) expect(rows).toEqual([[['a\\\\|b'], []]])
  })
})
