import { processFile } from '../src/node-utils'
import { processPlugin } from '../src'
import pubdatePlugin from '../src/pubdate-plugin'
import prevNextPlugin from '../src/prev-next-plugin'

const notes = `=begin pod
=TITLE Notes

=for para :pubdate<2024-01-03>
A note about G<Numbat> and nothing else.

=for para :pubdate<2024-01-04>
A second note.

=end pod
`
const navigation = () => {
  const [entries] = processPlugin(
    { plugin: pubdatePlugin(), includePatterns: '.*' },
    [processFile('notes.podlite', notes)],
    {},
  )
  const [linked] = processPlugin({ plugin: prevNextPlugin(), includePatterns: '.*' }, entries, {})
  return Object.fromEntries(linked.map((r: any) => [r.publishUrl, r.pluginsData?.navigate]))
}

it('prevNextPlugin: a neighbour without a title carries its text as a label, a hidden word masked', () => {
  const nav = navigation()
  const second = Object.values(nav).find((n: any) => n?.prev)
  const first = Object.values(nav).find((n: any) => n?.next)
  expect((second as any).prev.title).toBeNull()
  expect((second as any).prev.label).toBe('A note about ██████ and nothing else.')
  expect((second as any).prev.node).toBeUndefined()
  expect((first as any).next.label).toBe('A second note.')
})
