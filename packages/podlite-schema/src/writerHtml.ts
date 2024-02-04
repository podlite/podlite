/**
 * HTML writer
 */

import Writer from './writer'
class WriterHTML extends Writer {
  constructor(output?) {
    super(output)
  }
  escape(string) {
    const HTML_CHARS = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
    }
    return (string + '').replace(/[&<>"'\/`]/g, match => HTML_CHARS[match])
  }

  _add_nesting(n) {
    this.writeRaw('<blockquote>'.repeat(n))
  }
  _remove_nesting(n) {
    this.writeRaw('</blockquote>'.repeat(n))
  }
}
export default WriterHTML
