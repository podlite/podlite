import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'

// content the author keeps out of what is published; shown as a covered strip
// until the caret steps inside it
const covered = Decoration.mark({ class: 'cm-pod-covered' })
// a markdown fence carries the language first and block settings after it
const fenceAttrName = Decoration.mark({ class: 'cm-pod-fence-attr-name' })
const fenceAttrValue = Decoration.mark({ class: 'cm-pod-fence-attr-value' })

const attrRe = /:!?[\w-]+|<[^>]*>|\([^)]*\)|\{[^}]*\}|'[^']*'|"[^"]*"|｢[^｣]*｣/g

const caretIsIn = (view: EditorView, from: number, to: number): boolean =>
  view.state.selection.ranges.some(r => r.from <= to && r.to >= from)

const build = (view: EditorView): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: node => {
        if (node.name === 'PodCodeG') {
          // the letter and the brackets stay visible, and they are not always
          // one character wide: `G<<…>>` and `G«…»` are the same code
          const open = node.node.firstChild
          const close = node.node.lastChild
          if (!open || !close || close.from <= open.to) return
          if (!caretIsIn(view, node.from, node.to)) builder.add(open.to, close.from, covered)
          return
        }
        if (node.name !== 'CodeInfo') return
        const text = view.state.doc.sliceString(node.from, node.to)
        const language = /^\s*[\w+#-]*/.exec(text)?.[0].length || 0
        for (const a of text.slice(language).matchAll(attrRe)) {
          const at = node.from + language + (a.index as number)
          builder.add(at, at + a[0].length, a[0][0] === ':' ? fenceAttrName : fenceAttrValue)
        }
      },
    })
  }
  return builder.finish()
}

// what the tree knows but a colour cannot show: covered content and the
// settings of a fenced block
export const podliteDecorations = () =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = build(view)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) this.decorations = build(update.view)
      }
    },
    { decorations: v => v.decorations },
  )
