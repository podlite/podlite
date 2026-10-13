// A heading's key is how a generated link, such as a table of contents entry, finds
// it again after the tree has been copied, assembled or sent through JSON. It is not
// taken from the heading's text: the text may hide words, and two headings may say
// the same thing. The key is the heading's place in the tree a parse made, with a
// fingerprint of the text that parse read, so trees parsed apart keep apart keys.
// Two parses of the same text give the same keys.

// cyrb53 (bryc), seed 0, over the UTF-16 code units of the string
export const fingerprint = (text: string): string => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

// Every heading of the tree without a key gets one, in document order. A heading
// that already has a key keeps it, so a second call changes nothing.
export const assignHeadingKeys = <T>(tree: T, text: string): T => {
  const print = fingerprint(text)
  let n = 0
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== 'object') return
    const block = node as { type?: unknown; name?: unknown; headingKey?: unknown; content?: unknown }
    if (block.type === 'block' && block.name === 'head') {
      n++
      if (typeof block.headingKey !== 'string') block.headingKey = `h${n}.${print}`
    }
    walk(block.content)
  }
  walk(tree)
  return tree
}
