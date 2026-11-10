import { assembleIncludes } from '../src/assemble'
import type { IncludeProblem, Sources } from '../src/assemble'
import { parseContent } from '../src/lint/loader'

// a mask that finds many files none of which can be read; inside the file a selector
// reads, its reports take the place the include waiting for that file holds in the queue
const run = (n: number, slot: boolean): string[] => {
  const many = Array.from({ length: n }, (_, i) => ({
    id: `missing-${i}.podlite`,
    name: `missing-${i}.podlite`,
    context: '',
  }))
  const sources: Sources = {
    locate: file =>
      file === '*.podlite'
        ? { masked: true, sources: many }
        : { masked: false, sources: [{ id: file, name: file, context: '' }] },
    read: source =>
      source.id === 'voc.podlite'
        ? '=defn invoice\nDescription.\n\n=include file:*.podlite\n\n=include file:second.podlite\n'
        : null,
  }
  const text = slot
    ? '=include file:before.podlite\n\n' +
      '=include Invoice[:type(in file:voc.podlite | defn)]\n\n' +
      '=for Invoice :type<invoice>\nx\n\n' +
      '=include file:after.podlite\n'
    : '=pod\n\n=include file:*.podlite\n'
  const problems: IncludeProblem[] = []
  assembleIncludes(parseContent(text, 'podlite'), {
    sources,
    context: '',
    file: 'main.podlite',
    parse: source => parseContent(source, 'podlite'),
    tolerant: true,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  return problems.map(problem => problem.message)
}

const unread = (n: number) => Array.from({ length: n }, (_, i) => `include target cannot be read: missing-${i}.podlite`)

describe('includes that report more than fits in arguments', () => {
  it.each([10, 200_000])('keeps all %i reports of a mask in order', n => {
    expect(run(n, false)).toEqual(unread(n))
  })

  it.each([10, 200_000])('puts all %i reports of a selected file in the place of its include', n => {
    expect(run(n, true)).toEqual([
      'include target not found: before.podlite',
      ...unread(n),
      'include target not found: second.podlite',
      'include target not found: after.podlite',
    ])
  })
})
