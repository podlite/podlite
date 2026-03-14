/**
 * Markdown writer
 */

import Writer from './writer'

class WriterMarkdown extends Writer {
  constructor(output?) {
    super(output)
  }
  escape(string) {
    return (string + '').replace(/([\\`*_\[\]#|])/g, '\\$1')
  }

  _add_nesting(n) {
    this.writeRaw('> '.repeat(n))
  }
  _remove_nesting(n) {
    // no closing tag needed for Markdown blockquotes
  }
}
export default WriterMarkdown
