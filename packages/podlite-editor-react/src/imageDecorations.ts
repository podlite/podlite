import { RangeSetBuilder, StateEffect } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view'

export type ImageResolver = (src: string, baseDir?: string) => string | Promise<string>

// A directive that names a picture; the rest of its line is the address.
const IMAGE_LINE = /^\s*=(?:for\s+)?(Image|picture)\s+(\S+)/

// Showing the picture and showing the text that names it are separate choices:
// the author asked to switch them apart, and one switch would tie them together.
export type ImageDisplay = {
  show: boolean
  resolve?: ImageResolver
  baseDir?: string
}

// the same relative address stands for a different file under another base
// directory, so the directory belongs in the key
const resolved = new Map<string, string>()
const cacheKey = (src: string, baseDir?: string) => `${baseDir ?? ''}\u0000${src}`

export const imageResolvedEffect = StateEffect.define<{ src: string; url: string }>()

class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly url: string | undefined) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.url === this.url
  }

  toDOM(): HTMLElement {
    const box = document.createElement('div')
    box.className = 'cm-pod-image'
    if (!this.url) {
      box.textContent = this.src
      box.classList.add('cm-pod-image-waiting')
      return box
    }
    const img = document.createElement('img')
    img.src = this.url
    img.alt = this.src
    // a picture that cannot be fetched leaves a quiet line rather than a broken
    // icon: the address is still readable above it, so nothing is lost
    img.addEventListener('error', () => {
      box.textContent = this.src
      box.classList.add('cm-pod-image-missing')
    })
    box.appendChild(img)
    return box
  }

  ignoreEvent(): boolean {
    return false
  }
}

const build = (view: EditorView, display: ImageDisplay): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>()
  if (!display.show) return builder.finish()
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos)
      const found = line.text.match(IMAGE_LINE)
      if (found) {
        const src = found[2]
        const key = cacheKey(src, display.baseDir)
        const url = resolved.get(key)
        if (url === undefined && display.resolve) {
          Promise.resolve(display.resolve(src, display.baseDir))
            .then(value => {
              if (typeof value !== 'string' || resolved.get(key) === value) return
              resolved.set(key, value)
              view.dispatch({ effects: imageResolvedEffect.of({ src, url: value }) })
            })
            .catch(() => undefined)
        }
        builder.add(
          line.to,
          line.to,
          Decoration.widget({ widget: new ImageWidget(src, url ?? (display.resolve ? undefined : src)), side: 1 }),
        )
      }
      if (line.to + 1 > to) break
      pos = line.to + 1
    }
  }
  return builder.finish()
}

export const podliteImages = (display: ImageDisplay) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = build(view, display)
      }
      update(update: ViewUpdate) {
        const resolvedNow = update.transactions.some(tr => tr.effects.some(e => e.is(imageResolvedEffect)))
        if (update.docChanged || update.viewportChanged || resolvedNow) this.decorations = build(update.view, display)
      }
    },
    { decorations: v => v.decorations },
  )

// exported for the checks: the state the module keeps between builds
export const forgetResolvedImages = () => resolved.clear()
export const imageLineOf = (text: string): string | null => text.match(IMAGE_LINE)?.[2] ?? null
