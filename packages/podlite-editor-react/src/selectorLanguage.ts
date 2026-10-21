import { StreamLanguage } from '@codemirror/language'
import type { StringStream } from '@codemirror/language'
import { nodeForName } from './blockNameClass'

// the tags a block name gets in the document, by the kind of name
const NAME_TAG: Record<string, string> = {
  PodBlockName: 'operator',
  PodSemanticBlock: 'macroName',
  PodCustomBlock: 'tagName',
  PodUnknownBlock: 'variableName',
}

type SelectorState = {
  // the character that closes the value being read: > or a quotation mark
  closing: string | null
  // the path after a source scheme comes next
  path: boolean
  // depth of the parentheses of an operation
  depth: number
}

// a value in angle brackets or in quotation marks ends with its line
const readValue = (stream: StringStream, state: SelectorState): string => {
  while (!stream.eol()) {
    if (stream.next() === state.closing) {
      state.closing = null
      return 'string'
    }
  }
  state.closing = null
  return 'string'
}

/*
=begin pod :kind<export>

=head2 selectorLanguage

A language that splits a selector expression, the body of C<=assert>, into
parts for highlighting: block names as the document colours them, C<*> and
C<~>, conditions, values, the source scheme and its path, the word C<in> of an
operation, and separators. It reads no further than that: what a selector
selects is not decided here.

=end pod
*/
export const selectorLanguage = StreamLanguage.define<SelectorState>({
  name: 'podlite-selector',
  startState: () => ({ closing: null, path: false, depth: 0 }),
  copyState: state => ({ ...state }),
  token: (stream, state) => {
    if (state.closing) return readValue(stream, state)
    if (stream.eatSpace()) return null
    if (state.path) {
      state.path = false
      if (stream.match(/^[^\s|,()\]]+/)) return 'url'
    }
    if (stream.match(/^(?:file|doc):/)) {
      state.path = true
      return 'keyword'
    }
    // with the scheme left out, the bar after it tells a source from a block name
    if (stream.match(/^[^\s|,()[\]<>'"]+(?=\s*\|)/)) return 'url'
    const ch = stream.peek()
    if (ch === '<' || ch === "'" || ch === '"') {
      stream.next()
      state.closing = ch === '<' ? '>' : ch
      return readValue(stream, state)
    }
    if (ch === '*' || ch === '~') {
      stream.next()
      return 'operator'
    }
    if (ch === '(') {
      stream.next()
      state.depth++
      return 'processingInstruction'
    }
    if (ch === ')') {
      stream.next()
      state.depth = Math.max(0, state.depth - 1)
      return 'processingInstruction'
    }
    if (ch === '|' || ch === ',' || ch === '[' || ch === ']') {
      stream.next()
      return 'processingInstruction'
    }
    if (stream.match(/^:(?:!\?|!|\?)?[A-Za-z][\w'-]*/)) return 'attributeName'
    if (stream.match(/^[-+]?\d+(?:\.\d+)?/)) return 'string'
    const word = stream.match(/^[A-Za-z][\w'-]*/)
    if (word && typeof word !== 'boolean') {
      if (word[0] === 'in' && state.depth > 0) return 'keyword'
      if ((word[0] === 'True' || word[0] === 'False') && state.depth > 0) return 'string'
      return NAME_TAG[nodeForName(word[0])]
    }
    stream.next()
    return null
  },
})
