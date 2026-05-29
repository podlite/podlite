jest.mock('@codemirror/language', () => ({
  HighlightStyle: { define: () => ({}) },
  LanguageSupport: class {},
  StreamLanguage: { define: () => ({}) },
  syntaxHighlighting: () => ({}),
}))
jest.mock('@lezer/highlight', () => {
  const passthrough = (x: any) => x
  return {
    Tag: { define: () => null },
    tags: new Proxy({}, { get: () => passthrough }),
  }
})

import { podlite } from '../src/podlite'

class TokenStream {
  pos = 0
  string: string

  constructor(line: string) {
    this.string = line
  }

  sol() {
    return this.pos === 0
  }

  eol() {
    return this.pos >= this.string.length
  }

  match(regex: RegExp) {
    const slice = this.string.slice(this.pos)
    const m = slice.match(regex)
    if (m && m.index === 0) {
      this.pos += m[0].length
      return m
    }
    return null
  }

  next() {
    return this.string[this.pos++]
  }

  backUp(n: number) {
    this.pos -= n
  }
}

type TokenSpan = { text: string; token: string | null }

function tokenizeLine(state: any, line: string): TokenSpan[] {
  const stream = new TokenStream(line)
  const tokens: TokenSpan[] = []
  while (!stream.eol()) {
    const start = stream.pos
    const prevState = state.state
    const tok = (podlite as any).token(stream, state)
    const noProgress = stream.pos === start
    const hasPending = state.pending && state.pending.length
    const stateChanged = state.state !== prevState
    if (noProgress && !hasPending && !stateChanged) stream.next()
    const text = stream.string.slice(start, stream.pos)
    if (text) tokens.push({ text, token: tok })
  }
  return tokens
}

function tokenizeDoc(lines: string[]): TokenSpan[][] {
  const state = (podlite as any).startState()
  return lines.map(line => {
    if (line.trim() === '') {
      ;(podlite as any).blankLine(state)
      return []
    }
    return tokenizeLine(state, line)
  })
}

function findText(tokens: TokenSpan[], text: string) {
  return tokens.find(t => t.text === text)
}

it('=begin SYNOPSIS — semantic-block token on block name', () => {
  const [first] = tokenizeDoc(['=begin SYNOPSIS'])
  expect(findText(first, 'SYNOPSIS')?.token).toMatch(/semantic-block/)
})

it('=begin Image — custom-block token on block name', () => {
  const [first] = tokenizeDoc(['=begin Image'])
  expect(findText(first, 'Image')?.token).toMatch(/custom-block/)
})

it('=begin code — standard block keeps variable-2 (regression)', () => {
  const [first] = tokenizeDoc(['=begin code'])
  expect(findText(first, 'code')?.token).toMatch(/variable-2/)
})

it('=end SYNOPSIS — semantic-block token on close', () => {
  const lines = tokenizeDoc(['=begin SYNOPSIS', 'body', '=end SYNOPSIS'])
  expect(findText(lines[2], 'SYNOPSIS')?.token).toMatch(/semantic-block/)
})

it('=for AUTHOR — semantic-block on paragraph form', () => {
  const [first] = tokenizeDoc(['=for AUTHOR'])
  expect(findText(first, 'AUTHOR')?.token).toMatch(/semantic-block/)
})

it('=for Diagram — custom-block on paragraph form', () => {
  const [first] = tokenizeDoc(['=for Diagram'])
  expect(findText(first, 'Diagram')?.token).toMatch(/custom-block/)
})

it('=begin foo — lowercase non-standard keeps variable-3 (fallback regression)', () => {
  const [first] = tokenizeDoc(['=begin foo'])
  expect(findText(first, 'foo')?.token).toMatch(/variable-3/)
})

it('SEE-ALSO with hyphen — semantic-block (hyphen in uppercase ident)', () => {
  const [first] = tokenizeDoc(['=begin SEE-ALSO'])
  expect(findText(first, 'SEE-ALSO')?.token).toMatch(/semantic-block/)
})

it('=begin data-table — recognized as standard block with hyphen', () => {
  const [first] = tokenizeDoc(['=begin data-table'])
  expect(findText(first, 'data-table')?.token).toMatch(/variable-2/)
  expect(findText(first, 'data-table')?.token).toMatch(/data-table/)
})

it('=begin row — recognized as standard block', () => {
  const [first] = tokenizeDoc(['=begin row'])
  expect(findText(first, 'row')?.token).toMatch(/variable-2/)
})

it('=begin cell — recognized as standard block', () => {
  const [first] = tokenizeDoc(['=begin cell'])
  expect(findText(first, 'cell')?.token).toMatch(/variable-2/)
})

it('=end data-table — recognized hyphenated end marker', () => {
  const lines = tokenizeDoc(['=begin data-table', 'a,b', '=end data-table'])
  expect(findText(lines[2], 'data-table')?.token).toMatch(/variable-2/)
})

it('=boundary — keyword highlighted', () => {
  const [first] = tokenizeDoc(['=boundary'])
  expect(findText(first, '=boundary')?.token).toMatch(/keyword/)
})

it('=boundary :caption<End> — keyword + attribute', () => {
  const [first] = tokenizeDoc(['=boundary :caption<End>'])
  expect(findText(first, '=boundary')?.token).toMatch(/keyword/)
  expect(findText(first, ':caption')?.token).toMatch(/attribute/)
})

it('=set :caption<Title> — keyword highlighted', () => {
  const [first] = tokenizeDoc(['=set :caption<Title>'])
  expect(findText(first, '=set')?.token).toMatch(/keyword/)
})

it('=set multiline with continuation — keyword + continuation marker', () => {
  const lines = tokenizeDoc(['=set :caption Multi', '=    line two'])
  expect(findText(lines[0], '=set')?.token).toMatch(/keyword/)
  expect(findText(lines[1], '=')?.token).toMatch(/keyword/)
})

it('=set non-greedy — =head1 after =set pops state', () => {
  const lines = tokenizeDoc(['=set :id<x>', '', '=head1 Title'])
  expect(findText(lines[2], 'head1')?.token).toMatch(/variable-2/)
})
