import { marked, type Token } from 'marked'
import { decodeHTMLStrict } from 'entities'

// The text a reader of Markdown shows for a heading, which its address is built from.
// The line is read by marked, held at one version, so its address changes only when
// the version does; a kind of piece this reading does not know fails out loud.
const textOf = (tokens: Token[] | undefined): string =>
  (tokens || [])
    .map((token: any) => {
      switch (token.type) {
        case 'image':
        case 'html':
        case 'br':
          return ''
        case 'codespan':
          // marked holds the text of code as it stands
          return token.text
        case 'escape':
          return token.text
        case 'text':
          return token.tokens ? textOf(token.tokens) : decodeHTMLStrict(token.text)
        case 'link':
        case 'strong':
        case 'em':
        case 'del':
          return textOf(token.tokens)
        default:
          throw new Error(`[podlite] the text of a markdown heading has a piece it cannot read: ${token.type}`)
      }
    })
    .join('')

export const headingTextOf = (line: string): string => {
  const heading = marked.lexer(`# ${line}`).find(token => token.type === 'heading') as any
  return heading ? textOf(heading.tokens) : ''
}

// for a test of the pieces that are not known
export const textOfTokens = textOf
