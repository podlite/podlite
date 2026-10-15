/*
=begin pod

=TITLE Where markup codes begin and end

C<scanCodes> finds the boundaries of markup codes in one fragment: a paragraph
body, a code block with C<:allow>, a caption. It does not read what a code
means; it only says where each code opens, where its content ends and how it
ended.

A code ends at its own matching bracket. A code that never meets its own
bracket inside an enclosing code ends at the first bracket that closes the
enclosing code; at the top it runs to the end of the fragment. Whether a code
meets its own bracket does not depend on what surrounds it, so each code is
read once on its own, in isolation, and the result is kept for every place
that meets it again.

=end pod
*/

export type Bracket = '<' | '«'

export interface ScanScope {
  // codes active in this fragment at every depth; empty or absent means all
  allowed?: string[]
  // codes active inside C<> and V<>, from =config C<> :allow<…>
  allowedIn?: { [code: string]: string[] }
  // transition release: E<> works inside C<> without =config, with a warning
  entityInCode?: boolean
}

export type Ending = 'own' | 'cut' | 'fragment'

export interface CodeSpan {
  name: string
  bracket: Bracket
  // length of the opening delimiter: the number of angles, 1 for a guillemet
  length: number
  // offset of the letter
  start: number
  bodyStart: number
  bodyEnd: number
  // after the closing delimiter, or bodyEnd when the code has none
  end: number
  ending: Ending
  children: CodeSpan[]
}

export type ScanIssue =
  | { kind: 'unclosed'; code: CodeSpan; ending: 'cut' | 'fragment' }
  | { kind: 'longer-run'; start: number; end: number; code: CodeSpan }
  // a closing bracket of a code standing unbalanced inside a code it holds, which
  // ends at its own bracket (decision 6.1): the outer code does not end there
  | { kind: 'foreign-closer'; start: number; end: number; code: CodeSpan; inner: string }

export interface ScanResult {
  codes: CodeSpan[]
  issues: ScanIssue[]
}

const CLOSING: { [b in Bracket]: string } = { '<': '>', '«': '»' }
const VERBATIM_CODES = ['C', 'V']

// a bracket the code it stands in did not take: the enclosing code may need it
interface Piece {
  at: number
  char: string
  length: number
}

interface Frame {
  name: string
  bracket: Bracket
  length: number
  start: number
  bodyStart: number
  // depth of literal pairs of this code's own kind
  depth: number
  // inside guillemets: angles opened and not closed yet. They are not pairs; the
  // transition release only asks it, as the earlier reader took <…> there as text
  angles: number
  at: number
  own: Piece[]
  passed: Piece[]
  kids: Array<{ frame: Frame; cut: number | null }>
  // closing brackets of this code left unbalanced inside children closed by their own
  foreign: Array<{ at: number; length: number; inner: string }>
  done: boolean
  closed: boolean
  bodyEnd: number
  end: number
  // a child read on its own whose result is not known yet
  waiting: number
}

const isLetter = (c: string): boolean => c >= 'A' && c <= 'Z'

export const scanCodes = (text: string, scope: ScanScope = {}): ScanResult => {
  const n = text.length
  // the end of the run of one bracket each position stands in: a run is measured once
  const runEnd = new Int32Array(n + 1)
  runEnd[n] = n
  for (let i = n - 1; i >= 0; i--) runEnd[i] = i + 1 < n && text[i + 1] === text[i] ? runEnd[i + 1] : i + 1
  const runFrom = (i: number): number => runEnd[i] - i

  const fragmentAllows = (name: string): boolean => !scope.allowed?.length || scope.allowed.includes(name)
  const codeAllows = (outer: string | null, name: string, bracket: string, depth: number): boolean => {
    if (outer === null || !VERBATIM_CODES.includes(outer)) return true
    // the transition reads what the earlier reader read: E<…> with angles, not E«…»,
    // and not inside a literal pair of the code, as in C<G<E<32>>>
    if (outer === 'C' && name === 'E' && scope.entityInCode && bracket === '<' && depth === 0) return true
    return (scope.allowedIn?.[outer] || []).includes(name)
  }
  const openerAt = (
    i: number,
    outer: string | null,
    depth = 0,
  ): { name: string; bracket: Bracket; length: number } | null => {
    const name = text[i]
    if (!isLetter(name) || i + 1 >= n) return null
    const next = text[i + 1]
    if (next !== '<' && next !== '«') return null
    if (!fragmentAllows(name) || !codeAllows(outer, name, next, depth)) return null
    return { name, bracket: next, length: next === '«' ? 1 : runFrom(i + 1) }
  }

  const memo = new Map<number, Frame>()
  const makeFrame = (start: number, opener: { name: string; bracket: Bracket; length: number }): Frame => {
    const bodyStart = start + 1 + opener.length
    return {
      ...opener,
      start,
      bodyStart,
      depth: 0,
      angles: 0,
      at: bodyStart,
      own: [],
      passed: [],
      kids: [],
      foreign: [],
      done: false,
      closed: false,
      bodyEnd: n,
      end: n,
      waiting: -1,
    }
  }
  const finish = (frame: Frame, closed: boolean, bodyEnd: number, end: number) => {
    frame.done = true
    frame.closed = closed
    frame.bodyEnd = bodyEnd
    frame.end = end
  }

  // A child that did not find its own bracket: the brackets it left free count for
  // this code as if they stood in its own text, nearest first (decision 2.1, 6.1).
  // The child ends at the bracket that closes this code.
  const takeOpenChild = (frame: Frame, child: Frame): void => {
    const closing = CLOSING[frame.bracket]
    const kept: Piece[] = []
    const pieces = child.passed.length ? child.own.concat(child.passed) : child.own
    for (let k = 0; k < pieces.length; k++) {
      const piece = pieces[k]
      if (piece.char === frame.bracket && (frame.bracket === '«' || piece.length === frame.length)) {
        frame.depth++
        continue
      }
      if (piece.char === closing) {
        let rest = piece.length
        let at = piece.at
        while (frame.depth > 0 && rest >= frame.length) {
          frame.depth--
          rest -= frame.length
          at += frame.length
        }
        if (frame.depth === 0 && rest >= frame.length) {
          frame.kids.push({ frame: child, cut: at })
          finish(frame, true, at, at + frame.length)
          return
        }
        if (rest > 0) kept.push({ at, char: piece.char, length: rest })
        continue
      }
      kept.push(piece)
    }
    frame.kids.push({ frame: child, cut: n })
    frame.passed = kept
    finish(frame, false, n, n)
  }

  // the brackets a closed child left free, balanced among themselves by this code's kind
  const noteForeign = (frame: Frame, child: Frame): void => {
    const closing = CLOSING[frame.bracket]
    let open = 0
    const pieces = child.passed.length ? child.own.concat(child.passed) : child.own
    for (const piece of pieces) {
      if (piece.char === frame.bracket && (frame.bracket === '«' || piece.length === frame.length)) open++
      else if (piece.char === closing && piece.length >= frame.length) {
        if (open > 0) open--
        else frame.foreign.push({ at: piece.at, length: piece.length, inner: child.name })
      }
    }
  }

  // Reads one code's body until it closes, meets a child not yet read, or the
  // fragment ends. Returns the child to read first, or null when the code is done.
  const step = (frame: Frame): number | null => {
    const closing = CLOSING[frame.bracket]
    let i = frame.at
    while (i < n) {
      const c = text[i]
      const opener = openerAt(i, frame.name, frame.bracket === '«' ? frame.angles : frame.depth)
      if (opener) {
        const child = memo.get(i)
        if (!child || !child.done) {
          frame.at = i
          return i
        }
        if (child.closed) {
          noteForeign(frame, child)
          frame.kids.push({ frame: child, cut: null })
          i = child.end
          continue
        }
        takeOpenChild(frame, child)
        return null
      }
      if (c === '<') {
        const m = runFrom(i)
        if (frame.bracket === '<' && m === frame.length) frame.depth++
        else frame.own.push({ at: i, char: '<', length: m })
        if (frame.bracket === '«') frame.angles += m
        i += m
        continue
      }
      if (c === '>') {
        const m = runFrom(i)
        if (frame.bracket === '<') {
          let rest = m
          let at = i
          while (frame.depth > 0 && rest >= frame.length) {
            frame.depth--
            rest -= frame.length
            at += frame.length
          }
          if (frame.depth === 0 && rest >= frame.length) {
            finish(frame, true, at, at + frame.length)
            return null
          }
          if (rest > 0) frame.own.push({ at, char: '>', length: rest })
        } else {
          frame.own.push({ at: i, char: '>', length: m })
          frame.angles = Math.max(0, frame.angles - m)
        }
        i += m
        continue
      }
      if (c === '«') {
        if (frame.bracket === '«') frame.depth++
        else frame.own.push({ at: i, char: '«', length: 1 })
        i++
        continue
      }
      if (c === '»') {
        if (frame.bracket === '«') {
          if (frame.depth > 0) frame.depth--
          else {
            finish(frame, true, i, i + 1)
            return null
          }
        } else frame.own.push({ at: i, char: '»', length: 1 })
        i++
        continue
      }
      i++
    }
    finish(frame, false, n, n)
    return null
  }

  // reads the code at `start` and every code it needs first, without recursion
  const read = (start: number, outer: string | null): Frame => {
    const known = memo.get(start)
    if (known && known.done) return known
    const first = makeFrame(start, openerAt(start, outer)!)
    memo.set(start, first)
    const stack: Frame[] = [first]
    while (stack.length) {
      const frame = stack[stack.length - 1]
      const need = step(frame)
      if (need === null) {
        stack.pop()
        continue
      }
      const child = makeFrame(need, openerAt(need, frame.name, frame.bracket === '«' ? frame.angles : frame.depth)!)
      memo.set(need, child)
      stack.push(child)
    }
    return first
  }

  // the fragment itself: never closes; a code without its own bracket runs to the end
  const top: Array<{ frame: Frame; cut: number | null }> = []
  let i = 0
  while (i < n) {
    if (openerAt(i, null)) {
      const frame = read(i, null)
      top.push({ frame, cut: frame.closed ? null : n })
      if (!frame.closed) break
      i = frame.end
      continue
    }
    i++
  }

  const issues: ScanIssue[] = []
  // the tree as it ends up: a code cut by its enclosing code keeps what it read up to the cut
  const build = (kid: { frame: Frame; cut: number | null }, limit: number): CodeSpan => {
    const root: CodeSpan = shape(kid.frame, kid.cut, limit)
    const work: Array<{ span: CodeSpan; frame: Frame }> = [{ span: root, frame: kid.frame }]
    while (work.length) {
      const { span, frame } = work.pop()!
      for (const k of frame.kids) {
        if (k.frame.start >= span.bodyEnd) break
        const child = shape(k.frame, k.cut, span.bodyEnd)
        span.children.push(child)
        work.push({ span: child, frame: k.frame })
      }
    }
    return root
  }
  function shape(frame: Frame, cut: number | null, limit: number): CodeSpan {
    const stop = Math.min(cut ?? frame.end, limit)
    const own = frame.closed && frame.end <= stop
    const ending: Ending = own ? 'own' : stop < n ? 'cut' : 'fragment'
    const span: CodeSpan = {
      name: frame.name,
      bracket: frame.bracket,
      length: frame.length,
      start: frame.start,
      bodyStart: Math.min(frame.bodyStart, stop),
      bodyEnd: own ? frame.bodyEnd : stop,
      end: own ? frame.end : stop,
      ending,
      children: [],
    }
    if (ending !== 'own') issues.push({ kind: 'unclosed', code: span, ending })
    for (const f of frame.foreign)
      if (f.at < span.bodyEnd)
        issues.push({ kind: 'foreign-closer', start: f.at, end: f.at + f.length, code: span, inner: f.inner })
    return span
  }
  const codes = top.map(k => build(k, n))
  longerRuns(text, codes, runFrom, issues)
  issues.sort((a, b) => issueAt(a) - issueAt(b))
  return { codes, issues }
}

const issueAt = (issue: ScanIssue): number => (issue.kind === 'unclosed' ? issue.code.start : issue.start)

// Inside angle delimiters a run of opening angles longer than the delimiter is an
// error (Specification 3357–3365); a run of that length is a literal pair. Only
// the code's own text is looked at: what its children hold is theirs.
const longerRuns = (text: string, codes: CodeSpan[], runFrom: (i: number) => number, issues: ScanIssue[]): void => {
  const work = [...codes]
  while (work.length) {
    const code = work.pop()!
    work.push(...code.children)
    if (code.bracket !== '<') continue
    let i = code.bodyStart
    let k = 0
    while (i < code.bodyEnd) {
      const child = code.children[k]
      if (child && i >= child.start) {
        i = child.end
        k++
        continue
      }
      if (text[i] === '<') {
        const m = Math.min(runFrom(i), code.bodyEnd - i)
        if (m > code.length) issues.push({ kind: 'longer-run', start: i, end: i + m, code })
        i += m
        continue
      }
      i++
    }
  }
}
