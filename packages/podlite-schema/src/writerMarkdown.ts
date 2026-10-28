/**
 * Markdown writer
 */

import Writer from './writer'

const htmlText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

class WriterMarkdown extends Writer {
  // inside code a reader takes < and & as written
  codeDepth = 0
  // inside a block of HTML a reader takes text as HTML, code fences included
  htmlDepth = 0
  // open levels of a quote, and a table cell folded onto one line: a fence holds in neither
  quoteDepth = 0
  cellDepth = 0
  constructor(output?) {
    super(output)
  }
  escape(string) {
    const text = string + ''
    if (this.htmlDepth > 0) return htmlText(text.replace(/([\\`*_\[\]#|])/g, '\\$1'))
    if (this.codeDepth > 0) return text.replace(/([\\`*_\[\]#|])/g, '\\$1')
    // an ampersand opens a character reference only before a name or a number and a semicolon; one at the
    // end of a piece is escaped, since the piece after it is not seen here. Left alone elsewhere, it keeps
    // the query of an address a reader links by itself
    return text.replace(/([\\`*_\[\]#|<])/g, '\\$1').replace(/&(?=#?[A-Za-z0-9]+;|$)/g, '\\&')
  }
  // text of the document written as it stands, such as the body of a code block
  writeSource(text: string) {
    this.writeRaw(this.htmlDepth > 0 ? htmlText(text) : text)
  }

  _add_nesting(n) {
    this.quoteDepth += Number(n)
    this.writeRaw('> '.repeat(n))
  }
  _remove_nesting(n) {
    // no closing tag needed for Markdown blockquotes
    this.quoteDepth -= Number(n)
  }
}
export default WriterMarkdown
