// A test belongs to the block it stands under. On the page the two are drawn as
// one group, so that a site can set the test beside its rule; the order of the
// nodes stays as the source has it.

const isTest = (node: any): boolean => !!node && node.type === 'block' && node.name === 'test'

const isBlank = (node: any): boolean => !!node && node.type === 'blankline'

// A heading, a directive, a comment or data says nothing a test could check, and a
// directive wrapped into a group would lose the reach it has over what follows.
const NOT_AN_OWNER = new Set([
  'head',
  'comment',
  'data',
  'test',
  'fixture',
  'assert',
  'resource',
  'include',
  'toc',
  'pod',
])

const canOwn = (node: any): boolean => {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'para' || node.type === 'list' || node.type === 'code') return true
  if (node.type !== 'block' || typeof node.name !== 'string') return false
  return !node.name.startsWith('_') && !NOT_AN_OWNER.has(node.name)
}

// Source, data and the parts of a test hold no tests of their own to group.
const NOT_DESCENDED = new Set([
  'test',
  'fixture',
  'assert',
  'resource',
  'code',
  'comment',
  'data',
  'markdown',
  'input',
  'output',
  'formula',
])

// told of each node made in place of another, so a table kept on nodes follows
type Carry = (from: object, to: object) => void

const descend = (node: any, carry?: Carry): any => {
  if (!node || typeof node !== 'object' || !Array.isArray(node.content)) return node
  if (node.name === '_test_group' || NOT_DESCENDED.has(node.name)) return node
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
    if (canOwn(node)) {
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
        const group = { type: 'block', name: '_test_group', content: [descend(node, carry), ...members] }
        carry?.(node, group)
        out.push(group, ...pending)
        i = j
        continue
      }
    }
    out.push(descend(node, carry))
    i++
  }
  return out
}
