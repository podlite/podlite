import { content } from '..'
import { quoteAttribute } from './html-attr'

export const core = {
  ':image': {
    toHtml: writer => node => {
      if (typeof node !== 'string' && 'type' in node && node.type === 'image') {
        writer.writeRaw(`<img`)
        writer.writeRaw(` src="${quoteAttribute(String(node.src ?? ''))}"`)
        // an alternative text the author never wrote is left out: html reads a
        // missing alt as "this image is part of the content", and an empty one
        // as "decorative", which is a different statement
        if (node.alt !== undefined) {
          writer.writeRaw(` alt="${quoteAttribute(String(node.alt))}"`)
        }
        writer.writeRaw(`/>`)
      }
    },
  },
  image: {
    toHtml: content,
  },
  root: {
    toHtml: content,
  },
}
export default core
