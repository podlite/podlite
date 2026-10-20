import { canOwnTest, mayHoldTests } from '@podlite/schema'

// A test belongs to the block it stands under. On the page the two are drawn as
// one group, so that a site can set the test beside its rule; the order of the
// nodes stays as the source has it.

const isTest = (node: any): boolean => !!node && node.type === 'block' && node.name === 'test'

const isBlank = (node: any): boolean => !!node && node.type === 'blankline'

// told of each node made in place of another, so a table kept on nodes follows
type Carry = (from: object, to: object) => void

const descend = (node: any, carry?: Carry): any => {
  if (!node || typeof node !== 'object' || !Array.isArray(node.content)) return node
  if (node.name === '_test_group' || !mayHoldTests(node)) return node
  if (node.type !== 'block' && node.type !== 'list') return node
  const copy = { ...node, content: groupTests(node.content, carry) }
  carry?.(node, copy)
  return copy
}

export const groupTests = (content: any, carry?: Carry): any => {
  if (!Array.isArray(content)) return descend(content, carry)
  const out: any[] = []
  let i = 0
  while (i < content.length) {
    const node = content[i]
    if (canOwnTest(node)) {
      const members: any[] = []
      let pending: any[] = []
      let j = i + 1
      for (; j < content.length; j++) {
        const next = content[j]
        if (isBlank(next)) pending.push(next)
        else if (isTest(next)) {
          members.push(...pending, next)
          pending = []
        } else break
      }
      if (members.length) {
        // a group is made here, not taken from a file: it keeps no table entry
        out.push({ type: 'block', name: '_test_group', content: [descend(node, carry), ...members] }, ...pending)
        i = j
        continue
      }
    }
    out.push(descend(node, carry))
    i++
  }
  return out
}
