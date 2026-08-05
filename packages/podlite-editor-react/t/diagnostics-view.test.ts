/**
 * @jest-environment jsdom
 */
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { forceLinting, forEachDiagnostic } from '@codemirror/lint'
import { podliteDiagnostics } from '../src/diagnostics'

const doc = '=begin pod\n\n=for para :tags[a,b]\ntext\n\n=end pod\n'

const marker = (parent: HTMLElement) => parent.querySelector('.cm-lintRange-warning')

// waiting on the mark itself, not on a stretch of time: under load the delay
// before the mark appears grows, and a fixed pause turns the check flaky
const waitForMark = async (parent: HTMLElement, limitMs = 5000) => {
  const until = Date.now() + limitMs
  while (!marker(parent) && Date.now() < until) await new Promise(r => setTimeout(r, 20))
  return marker(parent)
}

const mount = (caretLine: number) => {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const line =
    doc
      .split('\n')
      .slice(0, caretLine - 1)
      .join('\n').length + 1
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [podliteDiagnostics()], selection: EditorSelection.cursor(line) }),
    parent,
  })
  forceLinting(view)
  return { parent, view }
}

describe('diagnostics in a live editor', () => {
  it('marks the value and carries the message', async () => {
    const { parent, view } = mount(1)
    expect(await waitForMark(parent)).not.toBeNull()
    const messages: string[] = []
    forEachDiagnostic(view.state, d => messages.push(d.message))
    expect(messages).toEqual([
      'Square brackets are not an attribute value form; write a list with angle brackets or parentheses',
    ])
    view.destroy()
  })

  it('stays quiet while the caret is on that line', async () => {
    // the second editor is the clock: once its mark is up, the first has had
    // at least as long, so an empty first one means silence and not slowness
    const quiet = mount(3)
    const loud = mount(1)
    expect(await waitForMark(loud.parent)).not.toBeNull()
    expect(marker(quiet.parent)).toBeNull()
    quiet.view.destroy()
    loud.view.destroy()
  })
})
