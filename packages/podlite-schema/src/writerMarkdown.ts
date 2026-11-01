/**
 * Markdown writer
 */

import Writer from './writer'

// An ampersand opens a character reference only before a name or a number and a semicolon; one at the
// end of a piece is escaped, since the piece after it is not seen here. Left alone elsewhere, it keeps
// the query of an address a reader links by itself, as a tilde inside such an address is kept.
// a reader links a scheme in any case and www. only in small letters
const bareAddress = /(?:[hH][tT][tT][pP][sS]?:\/\/|www\.)[^\s<]*/g
const escapeText = (text: string): string => {
  let out = ''
  let from = 0
  for (const match of text.matchAll(bareAddress)) {
    const at = match.index ?? 0
    out += escapeSigns(text.slice(from, at), true) + escapeSigns(match[0], false)
    from = at + match[0].length
  }
  return (out + escapeSigns(text.slice(from), true)).replace(/&(?=#?[A-Za-z0-9]+;|$)/g, '\\&')
}
const escapeSigns = (text: string, tilde: boolean): string =>
  text.replace(tilde ? /([\\`*_\[\]#|<~])/g : /([\\`*_\[\]#|<])/g, '\\$1')

// the prefixes of a quote and of an item come before the content of a line
const linePrefixes = /^(?:[ \t]*(?:>[ \t]?|(?:[-+*]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?))*[ \t]*/

// Places in the text where a line starts with a sign a reader would take for a block: an item, a quote,
// the line under a heading or a rule, the line that aligns a table, a number that starts a list.
const lineStartMarks = (text: string, lineText: string): number[] => {
  const marks: number[] = []
  const before = lineText.replace(linePrefixes, '')
  let start = 0
  text.split('\n').forEach((line, index) => {
    const atStart = index > 0 || before === ''
    const lead = line.length - line.replace(/^[ \t]+/, '').length
    const content = line.slice(lead)
    const at = start + lead
    if (atStart) {
      if (/^[-+](?:[ \t]|$)/.test(content) || /^>/.test(content)) marks.push(at)
      else if (/^[-=][-= \t]*$/.test(content) || /^:?-+:?[ \t]*$/.test(content) || /^:-*[ \t]*$/.test(content))
        marks.push(at)
      else {
        const number = content.match(/^\d{1,9}(?=[.)](?:[ \t]|$))/)
        if (number) marks.push(at + number[0].length)
      }
    } else if (index === 0 && /^\d{1,9}$/.test(before) && /^[.)](?:[ \t]|$)/.test(line)) {
      marks.push(start)
    }
    start += line.length + 1
  })
  return marks
}

class WriterMarkdown extends Writer {
  // inside code a reader takes < and & as written
  codeDepth = 0
  // inside a frame of HTML around Markdown: raw text there could close the frame
  htmlDepth = 0
  // a table cell folded onto one line: a fence does not hold there
  cellDepth = 0
  // a paragraph has begun and shown nothing yet: an indent here would make it code
  paraStart = false
  // what was written after the last line break
  lineText = ''
  constructor(output?) {
    super(output)
  }
  escape(string) {
    const text = string + ''
    // a bar divides a row only in a cell of a pipe table, so only there a bar in code needs a backslash
    if (this.codeDepth > 0) return text.replace(this.cellDepth > 0 ? /([\\`*_\[\]#|])/g : /([\\`*_\[\]#])/g, '\\$1')
    // a sign a reader takes for a block only at the start of a line gets a backslash there
    const marks = lineStartMarks(text, this.lineText)
    let out = ''
    let from = 0
    for (const at of marks) {
      out += escapeText(text.slice(from, at)) + '\\'
      from = at
    }
    return out + escapeText(text.slice(from))
  }
  writeRaw(str) {
    super.writeRaw(str)
    if (typeof str === 'string' && str !== '') {
      const end = str.lastIndexOf('\n')
      this.lineText = end === -1 ? this.lineText + str : str.slice(end + 1)
    }
    if (this.paraStart && /[^ \t\n]/.test(str)) this.paraStart = false
  }
  // text of the document written as it stands, such as the body of a code block
  writeSource(text: string) {
    this.writeRaw(text)
  }

  // the signs of a quote for a writer that writes as it goes; with a function for its
  // output, the export writes a quote aside and puts the signs on every line of it
  _add_nesting(n) {
    this.writeRaw('> '.repeat(n))
  }
  _remove_nesting(n) {
    // no closing tag needed for Markdown blockquotes
  }
}
export default WriterMarkdown
