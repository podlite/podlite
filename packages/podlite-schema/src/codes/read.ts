/*
=begin pod

=TITLE Reading markup codes

C<readCodes> turns a fragment into text and markup-code nodes. Where a code
begins and ends is decided first, by C<scanCodes>; each code then reads only
the body it was given, and nothing a code reads moves a boundary. A code
whose body cannot be read is written out as it stands, with a warning.

The nodes keep the form the earlier reader gave them, so renderers and other
readers of the tree see the same fields.

=end pod
*/
import { scanCodes, CodeSpan, ScanScope, ScanIssue } from './scan'
import { maskText } from '../helpers/handlers'
import { decodeHTMLStrict } from 'entities'

export type CodeIssueKind =
  | 'markup-code-unclosed'
  | 'markup-code-longer-run'
  | 'markup-code-foreign-closer'
  | 'markup-code-reserved'
  | 'markup-code-unsupported'
  | 'markup-code-unreadable'
  | 'markup-code-too-deep'

// where in the fragment a warning points; the parser turns it into a place in the source
export interface CodeIssue {
  code: CodeIssueKind
  message: string
  start: number
  end: number
}

export interface ReadOptions {
  allowed?: string[]
  allowedIn?: { [code: string]: string[] }
  parseAttributes?: (text: string) => unknown
  issues?: CodeIssue[]
}

type Content = Array<string | { [key: string]: unknown }>

// Codes nested deeper than this are written out as text. The tree walkers after the
// reader recurse, and the depth of an alias expansion adds to the depth of the place
// it stands in, so the limit is set with ALIAS_EXPANSION_DEPTH: 8 expansions of 32
// levels stay well inside what every walker holds.
export const MARKUP_CODE_DEPTH_LIMIT = 32

const RESERVED = ['Q', 'Y']
const HS = /^[   \t\u000C ]+/

// the closing delimiter a code was opened with
const closingOf = (code: CodeSpan): string => (code.bracket === '«' ? '»' : '>'.repeat(code.length))
const openingOf = (code: CodeSpan): string => (code.bracket === '«' ? '«' : '<'.repeat(code.length))

export const readCodes = (text: string, options: ReadOptions = {}): Content => {
  const scope: ScanScope = {
    allowed: options.allowed,
    allowedIn: options.allowedIn,
  }
  const { codes, issues } = scanCodes(text, scope)
  // what reading the codes finds is held until the scanner's warnings are out, which
  // come first, as before
  const found: CodeIssue[] = []
  const report = (code: CodeIssueKind, message: string, start: number, end: number) =>
    found.push({ code, message, start, end })

  // the codes past the depth limit: each is written out as it stands, with all it holds
  const tooDeep: CodeSpan[] = []
  const levels: Array<{ code: CodeSpan; depth: number }> = codes.map(code => ({ code, depth: 1 }))
  while (levels.length) {
    const { code, depth } = levels.pop()!
    if (depth > MARKUP_CODE_DEPTH_LIMIT) {
      tooDeep.push(code)
      continue
    }
    for (const child of code.children) levels.push({ code: child, depth: depth + 1 })
  }
  // A code past the limit is told only when it reaches the tree: a holder that keeps its
  // body as written, such as A<> or an address, drops what its codes read. Each code
  // records the codes it placed, and the cut ones reached from the top are the ones told.
  const cut = new Set(tooDeep)
  const placed = new Map<CodeSpan | null, CodeSpan[]>()
  let holder: CodeSpan | null = null

  // each code is read once, after the codes it holds, so deep nesting needs no recursion
  const built = new Map<CodeSpan, Content>()
  // text between codes, the codes themselves read by their letter
  const contentOf = (list: CodeSpan[], from: number, to: number): Content => {
    const out: Content = []
    let i = from
    for (const code of list) {
      if (code.start > i) out.push(text.slice(i, code.start))
      const kids = placed.get(holder)
      if (kids) kids.push(code)
      else placed.set(holder, [code])
      out.push(...(built.get(code) || []))
      i = code.end
    }
    if (to > i) out.push(text.slice(i, to))
    return out
  }

  // the parts of a body split at a separator standing at its top level: outside its
  // children and outside the literal pairs of its own kind
  const topLevel = (code: CodeSpan, separator: string): number[] => {
    const at: number[] = []
    let depth = 0
    let k = 0
    let i = code.bodyStart
    while (i < code.bodyEnd) {
      const child = code.children[k]
      if (child && i >= child.start) {
        i = child.end
        k++
        continue
      }
      const c = text[i]
      if (code.bracket === '<' && (c === '<' || c === '>')) {
        let j = i
        while (j < code.bodyEnd && text[j] === c) j++
        const run = j - i
        if (c === '<' && run === code.length) depth++
        if (c === '>' && run >= code.length) depth = Math.max(0, depth - Math.floor(run / code.length))
        i = j
        continue
      }
      if (code.bracket === '«' && c === '«') depth++
      else if (code.bracket === '«' && c === '»') depth = Math.max(0, depth - 1)
      else if (c === separator && depth === 0) at.push(i)
      i++
    }
    return at
  }
  // the children and text of a code between two offsets of its body
  const part = (code: CodeSpan, from: number, to: number): Content =>
    contentOf(
      code.children.filter(c => c.start >= from && c.end <= to),
      from,
      to,
    )

  const node = (code: CodeSpan): Content => {
    const name = code.name
    const body = text.slice(code.bodyStart, code.bodyEnd)
    const children = (): Content => contentOf(code.children, code.bodyStart, code.bodyEnd)
    switch (name) {
      case 'A':
        return [{ content: body, type: 'fcode', name }]
      case 'E': {
        // E<> with nothing in it stands for no character, as before
        const items = body.trim() === '' ? [] : readEntities(body)
        // shown as written: its letter and brackets around what it holds, read as anywhere
        // else, so a G<> or Z<> inside stays hidden; the warning does not repeat the body
        if (items === null) {
          report(
            'markup-code-unreadable',
            'E<> holds no entity it can read; it is shown as written',
            code.start,
            code.end,
          )
          return [name + openingOf(code), ...children(), code.ending === 'own' ? closingOf(code) : '']
        }
        return [{ content: items, type: 'fcode', name }]
      }
      case 'D':
      case 'X': {
        const bar = topLevel(code, '|')[0]
        const field = name === 'D' ? 'synonyms' : 'entry'
        if (bar === undefined) return [{ content: children(), type: 'fcode', name, [field]: null }]
        return [
          {
            content: part(code, code.bodyStart, bar),
            type: 'fcode',
            name,
            [field]: splitItems(text.slice(bar + 1, code.bodyEnd)),
          },
        ]
      }
      case 'L':
      case 'W':
        return [readLink(code)]
      case 'M': {
        const bar = topLevel(code, '|')[0]
        const content = bar === undefined ? children() : part(code, code.bodyStart, bar)
        const spec = bar === undefined ? '' : text.slice(bar + 1, code.bodyEnd)
        const configAt = spec.search(/\s+:/)
        const module = (configAt < 0 ? spec : spec.slice(0, configAt)).trim()
        const config = configAt < 0 ? [] : attributes(spec.slice(configAt).replace(/^\s+/, ''))
        report(
          'markup-code-unsupported',
          `M<> names a module this reader cannot run${module ? `: ${module}` : ''}; its text is shown as it is`,
          code.start,
          code.end,
        )
        return [{ content, type: 'fcode', name, module: module || null, config }]
      }
      case 'P': {
        const bar = topLevel(code, '|')[0]
        const altContent = bar === undefined ? undefined : part(code, code.bodyStart, bar)
        const src = (
          bar === undefined ? addressOf(code, code.bodyStart, code.bodyEnd) : addressOf(code, bar + 1, code.bodyEnd)
        ).trim()
        const image: { [key: string]: unknown } = { type: 'image', src }
        if (altContent !== undefined) {
          // an alternative text is a plain string: a comment in it is not written, a hidden
          // word in it is masked, an entity is its character
          image.alt = plain(altContent, true)
        }
        return [{ content: [image], type: 'fcode', name }]
      }
      default:
        if (RESERVED.includes(name)) {
          report('markup-code-reserved', `${name}<> is reserved; it is shown as written`, code.start, code.end)
          return [
            {
              content: children(),
              type: 'fcode',
              name,
              written: [name + openingOf(code), code.ending === 'own' ? closingOf(code) : ''],
            },
          ]
        }
        return [{ content: children(), type: 'fcode', name }]
    }
  }

  const attributes = (spec: string): unknown =>
    typeof options.parseAttributes === 'function' ? options.parseAttributes(spec) : spec

  // L<text|address :config>, L<address :config>, L<address>: the address is what is left
  // between the bar, the first whitespace before a colon, and the end of the code
  const readLink = (code: CodeSpan): { [key: string]: unknown } => {
    const name = code.name
    const bar = topLevel(code, '|')[0]
    const specFrom = bar === undefined ? code.bodyStart : bar + 1
    const spec = text.slice(specFrom, code.bodyEnd)
    const configAt = spec.search(/\s+:/)
    if (bar === undefined) {
      if (configAt < 0)
        return { content: contentOf(code.children, code.bodyStart, code.bodyEnd), type: 'fcode', name, meta: null }
      return {
        content: [unquote(addressOf(code, specFrom, specFrom + configAt))],
        type: 'fcode',
        name,
        meta: null,
        config: attributes(spec.slice(configAt).replace(/^\s+/, '')),
      }
    }
    const content = part(code, code.bodyStart, bar)
    // a specification holding spaces is quoted (Specification 4015); the quotes are not part of the address
    const written = addressOf(code, specFrom, configAt < 0 ? code.bodyEnd : specFrom + configAt)
    const address = configAt < 0 ? written : unquote(written)
    if (configAt < 0) return { content, type: 'fcode', name, meta: address }
    return {
      content,
      type: 'fcode',
      name,
      meta: address,
      config: attributes(spec.slice(configAt).replace(/^\s+/, '')),
    }
  }

  // the address as written, unless a code that hides or is not written stands in it:
  // then a comment is left out and a hidden word is masked, so neither reaches the link
  // An address as written: its text and codes stay as they stand, except that a
  // comment in it is left out and a hidden word masked, at any depth, so neither
  // reaches a link or a picture. Walked without recursion.
  const addressOf = (code: CodeSpan, from: number, to: number): string => {
    const out: string[] = []
    type Step = { span: CodeSpan } | { raw: string }
    const work: Step[] = []
    const visit = (spans: CodeSpan[], start: number, end: number) => {
      const steps: Step[] = []
      let i = start
      for (const span of spans) {
        if (span.start < start || span.end > end) continue
        if (span.start > i) steps.push({ raw: text.slice(i, span.start) })
        steps.push({ span })
        i = span.end
      }
      if (end > i) steps.push({ raw: text.slice(i, end) })
      for (let k = steps.length - 1; k >= 0; k--) work.push(steps[k])
    }
    visit(code.children, from, to)
    while (work.length) {
      const step = work.pop()!
      if ('raw' in step) {
        out.push(step.raw)
        continue
      }
      const span = step.span
      if (span.name === 'Z') continue
      if (span.name === 'G') {
        out.push(maskText(text.slice(span.bodyStart, span.bodyEnd)))
        continue
      }
      // the code itself as written, its body walked for what it holds
      work.push({ raw: text.slice(span.bodyEnd, span.end) })
      const before = work.length
      visit(span.children, span.bodyStart, span.bodyEnd)
      if (work.length === before) work.push({ raw: '' })
      out.push(text.slice(span.start, span.bodyStart))
    }
    return out.join('')
  }

  // read the codes after the codes they hold, without recursion
  const order: CodeSpan[] = []
  // written out as it stands, except that a comment is left out and a hidden word masked,
  // as in an address, so text past the limit shows nothing the codes would hide
  const asWritten = (code: CodeSpan): string =>
    code.name === 'Z'
      ? ''
      : code.name === 'G'
      ? maskText(text.slice(code.bodyStart, code.bodyEnd))
      : text.slice(code.start, code.bodyStart) +
        addressOf(code, code.bodyStart, code.bodyEnd) +
        text.slice(code.bodyEnd, code.end)
  for (const code of tooDeep) built.set(code, [asWritten(code)])
  const stack: Array<{ code: CodeSpan; open: boolean }> = codes.map(code => ({ code, open: false })).reverse()
  while (stack.length) {
    const top = stack.pop()!
    if (cut.has(top.code)) continue
    if (top.open) order.push(top.code)
    else {
      stack.push({ code: top.code, open: true })
      for (let k = top.code.children.length - 1; k >= 0; k--) stack.push({ code: top.code.children[k], open: false })
    }
  }
  for (const code of order) {
    holder = code
    built.set(code, node(code))
  }
  holder = null
  const content = contentOf(codes, 0, text.length)
  const used = new Set<CodeSpan>()
  const reach: Array<CodeSpan | null> = [null]
  while (reach.length) {
    for (const code of placed.get(reach.pop()!) ?? []) {
      if (cut.has(code)) used.add(code)
      else reach.push(code)
    }
  }

  // what the scanner says about text that is no longer read as codes is not said
  const usedCuts = Array.from(used)
  const inCut = (at: number): boolean => usedCuts.some(code => at >= code.start && at < code.end)
  const scanned: CodeIssue[] = []
  for (const issue of issues)
    if (!inCut(issue.kind === 'unclosed' ? issue.code.start : issue.start))
      reportScan(issue, (code, message, start, end) => scanned.push({ code, message, start, end }))
  if (used.size) {
    const first = usedCuts.reduce((a, b) => (b.start < a.start ? b : a))
    found.push({
      code: 'markup-code-too-deep',
      message: `markup codes nest deeper than ${MARKUP_CODE_DEPTH_LIMIT} levels; the deeper ones are written out as text`,
      start: first.start,
      end: first.end,
    })
  }
  if (options.issues) for (const issue of [scanned, found].flat()) options.issues.push(issue)
  return content
}

// the text of read content, without recursion: Z<> left out, G<> masked when asked,
// an entity its character, the letters of other codes dropped
const plain = (content: Content, mask: boolean): string => {
  const out: string[] = []
  const work: Array<{ item: Content[number]; masked: boolean }> = content
    .map(item => ({ item, masked: false }))
    .reverse()
  while (work.length) {
    const { item, masked } = work.pop()!
    if (typeof item === 'string') {
      out.push(masked ? maskText(item) : item)
      continue
    }
    if (item.name === 'Z') continue
    if (item.name === 'E' && Array.isArray(item.content)) {
      const chars = (item.content as Array<{ type?: string; value?: unknown }>)
        .map(e =>
          e.type === 'number'
            ? String.fromCodePoint(Number(e.value))
            : e.type === 'html_named'
            ? decodeHTMLStrict(`&${e.value};`)
            : '',
        )
        .join('')
      out.push(masked ? maskText(chars) : chars)
      continue
    }
    const inner = item.content
    const hide = masked || (mask && item.name === 'G')
    if (typeof inner === 'string') out.push(hide ? maskText(inner) : inner)
    else if (Array.isArray(inner))
      for (let k = inner.length - 1; k >= 0; k--) work.push({ item: inner[k] as Content[number], masked: hide })
  }
  return out.join('')
}

const holds = (content: Content, name: string): boolean => {
  const work = [...content]
  while (work.length) {
    const item = work.pop()!
    if (typeof item === 'string') continue
    if (item.name === name) return true
    if (Array.isArray(item.content)) work.push(...(item.content as Content))
  }
  return false
}

const reportScan = (
  issue: ScanIssue,
  report: (code: CodeIssueKind, message: string, start: number, end: number) => void,
) => {
  if (issue.kind === 'unclosed') {
    const where = issue.ending === 'cut' ? 'by the bracket of the code around it' : 'by the end of the block'
    report(
      'markup-code-unclosed',
      `${issue.code.name}<> is closed ${where}, not by its own bracket`,
      issue.code.start,
      issue.code.end,
    )
    return
  }
  if (issue.kind === 'foreign-closer') {
    report(
      'markup-code-foreign-closer',
      `a closing bracket of ${issue.code.name}<> stands inside ${issue.inner}<>, which ends at its own bracket; ${issue.code.name}<> does not end there`,
      issue.start,
      issue.end,
    )
    return
  }
  report(
    'markup-code-longer-run',
    `a run of angles longer than the delimiter of ${issue.code.name}<> stands inside it`,
    issue.start,
    issue.end,
  )
}

// entries of D<> and X<> after the bar: split at semicolons, the blanks after one dropped
const splitItems = (spec: string): string[] => {
  if (spec === '') return []
  return spec.split(';').map((item, k) => (k === 0 ? item : item.replace(HS, '')))
}

// E<lt>, E<0xAB>, E<LEFT DOUBLE ANGLE BRACKET>, E<lt;hellip;0xBB>
const readEntities = (body: string): Array<{ type: string; value: unknown }> | null => {
  const items = body.split(';')
  const out: Array<{ type: string; value: unknown }> = []
  for (const raw of items) {
    const item = raw.replace(/^[ \t\u000C]+/, '').replace(/[   \t\u000C ]+$/, '')
    let m: RegExpMatchArray | null
    if ((m = item.match(/^0o([0-9]+)$/))) out.push({ type: 'number', value: parseInt(m[1], 8) })
    else if ((m = item.match(/^0d([0-9]+)$/))) out.push({ type: 'number', value: parseInt(m[1], 10) })
    else if ((m = item.match(/^0b([0-9]+)$/))) out.push({ type: 'number', value: parseInt(m[1], 2) })
    else if ((m = item.match(/^0x[0-9A-Fa-f]+$/))) out.push({ type: 'number', value: parseInt(item) })
    else if ((m = item.match(/^[0-9]+$/))) out.push({ type: 'number', value: parseInt(item, 10) })
    else if (/^[A-Z ]+$/.test(item)) out.push({ type: 'unicode_name', value: item })
    else if (/^[a-z][a-z0-9]+$/.test(item)) out.push({ type: 'html_named', value: item })
    else return null
  }
  return out
}

// quotes around the whole specification are not part of the address
const unquote = (spec: string): string => {
  const quote = spec[0]
  if ((quote === "'" || quote === '"') && spec.length > 1 && spec[spec.length - 1] === quote) return spec.slice(1, -1)
  return spec
}
