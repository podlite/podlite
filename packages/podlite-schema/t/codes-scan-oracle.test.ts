import { scanCodes, ScanScope, CodeSpan } from '../src/codes/scan'

// A second reader of the same definition, written apart from scanCodes: it recurses,
// keeps nothing between codes, re-reads every code where it meets it, and passes free
// brackets up as plain strings. It is slow and that is the point: it shares no
// machinery with the working reader, so a mistake in that machinery shows up as a
// difference here. The definition itself is checked by the table in codes-scan.test.ts.

type Node = { name: string; start: number; body: number; bodyEnd: number; end: number; own: boolean; kids: Node[] }
type Read = { node: Node; closed: boolean; free: Array<[number, string]> } // free: [offset, run of one bracket]

const oracle = (text: string, scope: ScanScope): Node[] => {
  const n = text.length
  const gate = (outer: string | null, name: string, bracket: string, depth: number): boolean => {
    if (scope.allowed?.length && !scope.allowed.includes(name)) return false
    if (outer !== 'C' && outer !== 'V') return true
    // the transition release: E<…> with angles, outside the literal pairs of C<>
    if (outer === 'C' && name === 'E' && scope.entityInCode && bracket === '<' && depth === 0) return true
    return (scope.allowedIn?.[outer] || []).includes(name)
  }
  const opens = (i: number, outer: string | null, depth = 0): boolean =>
    /[A-Z]/.test(text[i] || '') && /[<«]/.test(text[i + 1] || '') && gate(outer, text[i], text[i + 1], depth)
  const run = (i: number): string => (text.slice(i).match(/^(<+|>+|«|»)/) || [''])[0]

  // the code at p on its own: where it ends, what it holds, what it leaves free
  const alone = (p: number): Read => {
    const name = text[p]
    const open = text[p + 1] === '«' ? '«' : run(p + 1)
    const close = open === '«' ? '»' : '>'.repeat(open.length)
    const node: Node = { name, start: p, body: p + 1 + open.length, bodyEnd: n, end: n, own: false, kids: [] }
    const free: Array<[number, string]> = []
    let depth = 0
    // angles inside guillemets, open and not closed: asked only by the transition release
    let angles = 0
    // one bracket token met by this code, in its text or freed by a child; true when it closed the code
    const meet = (at: number, token: string, holder: Node | null): boolean => {
      if (token === open || (open === '«' && token === '«')) {
        depth++
        return false
      }
      if (token[0] === close[0]) {
        let rest = token
        let where = at
        while (depth > 0 && rest.length >= close.length) {
          depth--
          rest = rest.slice(close.length)
          where += close.length
        }
        if (depth === 0 && rest.length >= close.length) {
          if (holder) node.kids.push({ ...cutAt(holder, where) })
          node.bodyEnd = where
          node.end = where + close.length
          node.own = true
          return true
        }
        if (rest) free.push([where, rest])
        return false
      }
      free.push([at, token])
      return false
    }
    let i = node.body
    while (i < n) {
      if (opens(i, name, open === '«' ? angles : depth)) {
        const child = alone(i)
        if (child.closed) {
          node.kids.push(child.node)
          i = child.node.end
          continue
        }
        for (const [at, token] of child.free) {
          // guillemets are one bracket each; a run of angles is one token
          if (meet(at, token, child.node)) return { node, closed: true, free }
        }
        node.kids.push(child.node)
        return { node, closed: false, free }
      }
      const token = run(i)
      if (token && open === '«' && token[0] === '<') angles += token.length
      if (token && open === '«' && token[0] === '>') angles = Math.max(0, angles - token.length)
      if (token) {
        if (open !== '«' && token[0] === '<' && token !== open) free.push([i, token])
        else if (meet(i, token, null)) return { node, closed: true, free }
        i += token.length
        continue
      }
      i++
    }
    return { node, closed: false, free }
  }
  const cutAt = (node: Node, at: number): Node => ({
    ...node,
    bodyEnd: Math.min(node.bodyEnd, at),
    end: node.own && node.end <= at ? node.end : at,
    own: node.own && node.end <= at,
    kids: node.kids.filter(k => k.start < at).map(k => cutAt(k, at)),
  })

  const top: Node[] = []
  let i = 0
  while (i < n) {
    if (opens(i, null)) {
      const read = alone(i)
      top.push(read.node)
      if (!read.closed) break
      i = read.node.end
      continue
    }
    i++
  }
  return top
}

const fromScan = (codes: CodeSpan[]): Node[] =>
  codes.map(c => ({
    name: c.name,
    start: c.start,
    body: c.bodyStart,
    bodyEnd: c.bodyEnd,
    end: c.end,
    own: c.ending === 'own',
    kids: fromScan(c.children),
  }))

const fromOracle = (nodes: Node[]): Node[] =>
  nodes.map(c => ({ ...c, body: Math.min(c.body, c.bodyEnd), kids: fromOracle(c.kids) }))

const ALPHABET = ['B', 'I', 'C', 'E', '<', '>', '«', '»', 'x', ' ']
const SCOPES: ScanScope[] = [{}, { allowed: ['B', 'C', 'E'] }, { allowedIn: { C: ['I'] } }, { entityInCode: true }]

const differs = (text: string, scope: ScanScope): boolean =>
  JSON.stringify(fromScan(scanCodes(text, scope).codes)) !== JSON.stringify(fromOracle(oracle(text, scope)))

describe('scanCodes against a second reader of the same definition', () => {
  it('agrees on every input up to five characters', () => {
    let checked = 0
    const failed: string[] = []
    const walk = (prefix: string) => {
      for (const scope of SCOPES) {
        checked++
        if (differs(prefix, scope) && failed.length < 5) failed.push(JSON.stringify([prefix, scope]))
      }
      if (prefix.length < 5) for (const c of ALPHABET) walk(prefix + c)
    }
    walk('')
    expect(failed).toEqual([])
    expect(checked).toBe(SCOPES.length * 111111)
  })

  it('agrees on random inputs of 6 to 24 characters', () => {
    let seed = 2026
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const failed: string[] = []
    for (let k = 0; k < 20000; k++) {
      let text = ''
      const length = 6 + Math.floor(random() * 19)
      for (let i = 0; i < length; i++) text += ALPHABET[Math.floor(random() * ALPHABET.length)]
      const scope = SCOPES[k % SCOPES.length]
      if (differs(text, scope) && failed.length < 5) failed.push(JSON.stringify([text, scope]))
    }
    expect(failed).toEqual([])
  })
})

describe('properties of the boundaries', () => {
  it('nests codes inside their bodies, keeps them apart, and warns about exactly the codes without their bracket', () => {
    let seed = 7
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const broken: string[] = []
    for (let k = 0; k < 20000; k++) {
      let text = ''
      const length = 1 + Math.floor(random() * 40)
      for (let i = 0; i < length; i++) text += ALPHABET[Math.floor(random() * ALPHABET.length)]
      const { codes, issues } = scanCodes(text)
      const unclosed = new Set(issues.filter(x => x.kind === 'unclosed').map(x => (x as any).code))
      const check = (list: CodeSpan[], from: number, to: number) => {
        let last = from
        for (const c of list) {
          const sound =
            c.start >= last &&
            c.start < c.bodyStart &&
            c.bodyStart <= c.bodyEnd &&
            c.end <= to &&
            (c.ending === 'own' ? c.end - c.bodyEnd === c.length : c.end === c.bodyEnd) &&
            unclosed.has(c) === (c.ending !== 'own')
          if (!sound && broken.length < 5) broken.push(JSON.stringify(text))
          check(c.children, c.bodyStart, c.bodyEnd)
          last = c.end
        }
      }
      check(codes, 0, text.length)
    }
    expect(broken).toEqual([])
  })
})
