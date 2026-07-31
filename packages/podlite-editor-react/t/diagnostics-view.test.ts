/**
 * @jest-environment jsdom
 */
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { forceLinting, forEachDiagnostic } from '@codemirror/lint'
import { podliteDiagnostics } from '../src/diagnostics'

const doc = '=begin pod\n\n=for para :tags[a,b]\ntext\n\n=end pod\n'

const settle = () => new Promise(resolve => setTimeout(resolve, 200))

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
    await settle()
    expect(parent.querySelector('.cm-lintRange-warning')).not.toBeNull()
    const messages: string[] = []
    forEachDiagnostic(view.state, d => messages.push(d.message))
    expect(messages).toEqual([
      'Square brackets are not an attribute value form; write a list with angle brackets or parentheses',
    ])
    view.destroy()
  })

  it('stays quiet while the caret is on that line', async () => {
    const { parent, view } = mount(3)
    await settle()
    expect(parent.querySelector('.cm-lintRange-warning')).toBeNull()
    view.destroy()
  })
})
