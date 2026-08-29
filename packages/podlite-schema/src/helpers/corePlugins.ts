import { content } from '..'
import { writtenValue } from '../ast-helpers'
import { quoteAttribute } from './html-attr'

export const core = {
  ':image': {
    toHtml: writer => node => {
      if (typeof node !== 'string' && 'type' in node && node.type === 'image') {
        writer.writeRaw(`<img`)
        writer.writeRaw(` src="${quoteAttribute(String(node.src ?? ''))}"`)
        // html reads a missing alt as "this image is part of the content" and an
        // empty one as "decorative", so an alternative text the author never wrote
        // is left out
        const alt = writtenValue(node.alt)
        if (alt !== undefined) {
          writer.writeRaw(` alt="${quoteAttribute(alt)}"`)
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
