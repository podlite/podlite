import { toMarkdown } from '@podlite/schema'
import { md2ast } from '../src/tools'

const markdown = (text: string) => String(toMarkdown({}).run(md2ast(text)))

describe('markdown read by the reader of CommonMark 0.31 and GFM', () => {
  it('starts no list inside a paragraph with a number other than 1', () => {
    expect(markdown('para\n2. item\n3. item')).toBe('para\n2\\. item\n3\\. item\n')
  })

  it('leaves a full stop after a bare link out of the address', () => {
    expect(markdown('<span>https://example.com.</span>')).toBe(
      '<span>[https://example.com](https://example.com).</span>\n',
    )
  })
})
