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

export type CodeIssueKind =
  | 'markup-code-unclosed'
  | 'markup-code-longer-run'
  | 'markup-code-reserved'
  | 'markup-code-unsupported'
  | 'markup-code-unreadable'
  | 'markup-code-entity-in-code'

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
  // E<> inside C<> without =config: the release that moves documents to the norm reads it, with a warning
  entityInCode?: boolean
  issues?: CodeIssue[]
}

type Content = Array<string | { [key: string]: unknown }>

const RESERVED = ['Q', 'Y']
const HS = /^[   \t\u000C ]+/

// the closing delimiter a code was opened with
const closingOf = (code: CodeSpan): string => (code.bracket === '«' ? '»' : '>'.repeat(code.length))
const openingOf = (code: CodeSpan): string => (code.bracket === '«' ? '«' : '<'.repeat(code.length))

export const readCodes = (text: string, options: ReadOptions = {}): Content => {
  const scope: ScanScope = {
    allowed: options.allowed,
    allowedIn: options.allowedIn,
    entityInCode: options.entityInCode,
  }
  const { codes, issues } = scanCodes(text, scope)
  const report = (code: CodeIssueKind, message: string, start: number, end: number) =>
    options.issues?.push({ code, message, start, end })
  for (const issue of issues) reportScan(issue, report)

  // text between codes, the codes themselves read by their letter
  const contentOf = (list: CodeSpan[], from: number, to: number): Content => {
    const out: Content = []
    let i = from
    for (const code of list) {
      if (code.start > i) out.push(text.slice(i, code.start))
      out.push(...node(code))
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
  const written = (code: CodeSpan): string => text.slice(code.start, code.end)

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
        if (items === null) {
          report('markup-code-unreadable', `E<> holds no entity it can read: ${body}`, code.start, code.end)
          return [written(code)]
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
        const configAt = spec.search(/[   \t\u000C ]+:/)
        const module = (configAt < 0 ? spec : spec.slice(0, configAt)).trim()
        const config = configAt < 0 ? [] : attributes(spec.slice(configAt).replace(HS, ''))
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
        const alt = bar === undefined ? undefined : collect(part(code, code.bodyStart, bar))
        const src = (bar === undefined ? body : text.slice(bar + 1, code.bodyEnd)).trim()
        const image: { [key: string]: unknown } = { type: 'image', src }
        if (alt !== undefined) image.alt = alt
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
        if (name === 'C' && !(options.allowedIn?.C || []).includes('E'))
          for (const child of code.children)
            if (child.name === 'E')
              report(
                'markup-code-entity-in-code',
                'E<> inside C<> reads as an entity only in this release; to keep it, write =config C<> :allow<E>',
                child.start,
                child.end,
              )
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
    const configAt = spec.search(/[   \t\u000C ]+:/)
    if (bar === undefined) {
      if (configAt < 0)
        return { content: contentOf(code.children, code.bodyStart, code.bodyEnd), type: 'fcode', name, meta: null }
      return {
        content: [linkTarget(spec.slice(0, configAt))],
        type: 'fcode',
        name,
        meta: null,
        config: attributes(spec.slice(configAt).replace(HS, '')),
      }
    }
    const content = part(code, code.bodyStart, bar)
    if (configAt < 0) return { content, type: 'fcode', name, meta: spec }
    return {
      content,
      type: 'fcode',
      name,
      meta: linkTarget(spec.slice(0, configAt)),
      config: attributes(spec.slice(configAt).replace(HS, '')),
    }
  }

  return contentOf(codes, 0, text.length)
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
  report(
    'markup-code-longer-run',
    `a run of angles longer than the delimiter of ${issue.code.name}<> stands inside it`,
    issue.start,
    issue.end,
  )
}

const collect = (content: Content): string =>
  content.map(item => (typeof item === 'string' ? item : collect((item.content as Content) || []))).join('')

// quotes around the whole address are not part of it
const linkTarget = (spec: string): string => {
  const trimmed = spec.replace(/\s+$/, '')
  const quote = trimmed[0]
  if ((quote === "'" || quote === '"') && trimmed.length > 1 && trimmed[trimmed.length - 1] === quote)
    return trimmed.slice(1, -1)
  return trimmed
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
