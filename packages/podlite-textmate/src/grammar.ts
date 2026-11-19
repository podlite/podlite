// A TextMate grammar is a JSON document. It is kept as TypeScript so it is typed and
// can be built from small parts; every pattern is a plain string, so the object
// serialises to JSON as it is.

export interface GrammarCapture {
  name?: string
  patterns?: GrammarRule[]
}

export type GrammarCaptures = Record<string, GrammarCapture>

export interface GrammarRule {
  name?: string
  contentName?: string
  match?: string
  begin?: string
  end?: string
  captures?: GrammarCaptures
  beginCaptures?: GrammarCaptures
  endCaptures?: GrammarCaptures
  patterns?: GrammarRule[]
  include?: string
}

export interface PodliteGrammar {
  name: string
  displayName: string
  scopeName: string
  aliases: string[]
  patterns: GrammarRule[]
  repository: Record<string, GrammarRule>
}

const R = String.raw

// The identifier of the specification: a letter or underscore, then letters, digits
// and underscores; a hyphen or apostrophe only before a letter
const NAME = R`[\p{L}_][\p{L}\p{Nd}_]*(?:['-][\p{L}_][\p{L}\p{Nd}_]*)*`
const AFTER_NAME = R`(?=[ \t]|$)`

// The start of a line where some directive or block marker begins. A table rule such
// as ====|==== does not count: an identifier has to follow the sign
const DIRECTIVE_LINE = R`^(?=[ \t]*=[\p{L}_])`
const BLANK_LINE = R`^(?=[ \t]*$)`

// Shiki never shows the grammar an empty line, so a body that should end at a blank
// line can end only at a line of spaces or at the next directive
const END_PARAGRAPH = `${DIRECTIVE_LINE}|${BLANK_LINE}`

type NameSet = { standard: string; semantic: boolean; custom: string }

const NEVER = '(?!)'
const SEMANTIC_NAME = R`[\p{Lu}_][\p{Lu}\p{Nd}_]*(?:['-][\p{Lu}_][\p{Lu}\p{Nd}_]*)*`
const MIXED_CASE_NAME = R`(?=[\p{L}\p{Nd}_'-]*\p{Ll})(?=[\p{L}\p{Nd}_'-]*\p{Lu})${NAME}`

const RAW_NAMES: NameSet = {
  standard: 'data-table|code|data|formula|markdown',
  semantic: false,
  // the test-suite blocks of the implementation, and named blocks, whose body goes to a plug-in
  custom: `assert|fixture|resource|${MIXED_CASE_NAME}`,
}
const COMMENT_NAMES: NameSet = { standard: 'comment', semantic: false, custom: NEVER }
const TABLE_NAMES: NameSet = { standard: 'table', semantic: false, custom: NEVER }
const PICTURE_NAMES: NameSet = { standard: 'picture', semantic: false, custom: NEVER }
const TEXT_NAMES: NameSet = {
  standard: R`pod|para|nested|defn|input|output|toc|row|cell|item\d*|head\d+`,
  semantic: true,
  custom: NAME,
}

// Groups of a marker line: 1 indent, 2 directive word (or the bare sign), 3 the name,
// 4 to 6 the name by kind, 7 the rest of the line
const marker = (directive: string, names: NameSet): string =>
  R`^([ \t]*)(${directive})` +
  (directive === '=' ? '' : R`[ \t]+`) +
  `((${names.standard})|(${names.semantic ? SEMANTIC_NAME : NEVER})|(${names.custom}))` +
  AFTER_NAME +
  '(.*)$'

const markerCaptures = (keyword: string, rest: GrammarCapture): GrammarCaptures => ({
  2: { name: keyword },
  4: { name: 'entity.name.tag.standard.podlite' },
  5: { name: 'entity.name.tag.semantic.podlite' },
  6: { name: 'entity.name.tag.custom.podlite' },
  7: rest,
})

const DIRECTIVE = 'keyword.control.directive.podlite'
const SIGN = 'punctuation.definition.tag.podlite'
const ATTRIBUTES: GrammarCapture = { patterns: [{ include: '#attributes' }] }

const closerCaptures: GrammarCaptures = {
  2: { name: DIRECTIVE },
  3: { name: 'entity.name.tag.podlite' },
}

// A verbatim body closes at its name written whole, at an indent no deeper than the
// opener's, as the parser of @podlite/schema decides on the cases it agrees with
const VERBATIM_CLOSER = R`^(?!\1[ \t])([ \t]*)(=end)[ \t]+(\3)(?=[ \t]|$)`
// Other delimited blocks close at their name with any indent, as the parser's general rule
const CLOSER = R`^([ \t]*)(=end)[ \t]+(\3)(?=[ \t]|$)`

const header: GrammarRule = { include: '#header' }
const rawLine: GrammarRule = { match: '.+', name: 'markup.raw.block.podlite' }
const commentLine: GrammarRule = { match: '.+', name: 'comment.block.podlite' }

// --- markup codes ---------------------------------------------------------------

type Delimiter = { open: string; close: string; key: string }

// longest first, so <<< is never read as < followed by <<
const DELIMITERS: Delimiter[] = [
  { key: '4', open: '<<<<', close: '>>>>' },
  { key: '3', open: '<<<', close: '>>>' },
  { key: '2', open: '<<', close: '>>' },
  { key: '1', open: '<', close: '>' },
  { key: 'g', open: '«', close: '»' },
]

const exactOpen = (d: Delimiter): string => (d.key === 'g' ? '«' : R`(?<!<)${d.open}(?!<)`)
const exactClose = (d: Delimiter): string => (d.key === 'g' ? '»' : R`(?<!>)${d.close}(?!>)`)

type Kind = { letters: string; name?: string; content: 'markup' | 'plain' }

const CODE_KINDS: Kind[] = [
  { letters: 'B', name: 'markup.bold.podlite', content: 'markup' },
  { letters: 'I', name: 'markup.italic.podlite', content: 'markup' },
  { letters: 'U', name: 'markup.underline.podlite', content: 'markup' },
  { letters: 'O', name: 'markup.strikethrough.podlite', content: 'markup' },
  { letters: 'KT', name: 'markup.inline.raw.podlite', content: 'markup' },
  { letters: 'C', name: 'markup.inline.raw.podlite', content: 'plain' },
  // V changes how its content is read, not how it looks
  { letters: 'V', content: 'plain' },
  { letters: 'ZG', name: 'comment.block.podlite', content: 'plain' },
  { letters: 'E', name: 'constant.character.entity.podlite', content: 'markup' },
  { letters: 'AR', name: 'variable.other.podlite', content: 'markup' },
  { letters: 'DFHJMNPSXY', name: 'meta.markup.podlite', content: 'markup' },
]

const CODE_SIGN = 'punctuation.definition.markup.podlite'

// The two contexts differ in where an unclosed code gives up: a paragraph also ends at a
// line of spaces, a delimited body only at the next directive
type Context = { key: string; recover: string }
const CONTEXTS: Context[] = [
  { key: 'paragraph', recover: END_PARAGRAPH },
  { key: 'delimited', recover: DIRECTIVE_LINE },
]

const codeRule = (kind: Kind, d: Delimiter, ctx: Context): GrammarRule => ({
  name: kind.name,
  begin: `([${kind.letters}])(${exactOpen(d)})`,
  end: `(${exactClose(d)})|(?:${ctx.recover})`,
  beginCaptures: { 1: { name: CODE_SIGN }, 2: { name: CODE_SIGN } },
  endCaptures: { 1: { name: CODE_SIGN } },
  patterns: [{ include: `#brackets-${d.key}-${ctx.key}` }].concat(
    kind.content === 'markup' ? [{ include: `#inline-${ctx.key}` }] : [],
  ),
})

// Same-width angles inside a code are text, but they have to pair up
const bracketRule = (d: Delimiter, ctx: Context): GrammarRule => ({
  begin: exactOpen(d),
  end: `${exactClose(d)}|(?:${ctx.recover})`,
  patterns: [{ include: `#brackets-${d.key}-${ctx.key}` }],
})

// L and W: the label runs to the first bar outside nested codes, the address to the
// first space followed by a colon, the attributes to the closer
const LINK_LETTERS = 'LW'
const LINK_TARGET = 'markup.underline.link.podlite'
const LINK_LABEL = 'string.other.link.podlite'

const linkRules = (d: Delimiter, ctx: Context): GrammarRule[] => {
  const close = exactClose(d)
  const text = d.key === 'g' ? R`(?:(?![ \t]:)[^«»|])` : R`(?:(?![ \t]:)[^<>|])`
  const nested = d.key === 'g' ? R`(?:«[^«»]*»)` : R`(?:<[^<>]*>)`
  const address: GrammarRule = {
    begin: R`(?<=[^ \t])|^|(?=\S)`,
    end: R`(?=[ \t]+:)|(?=${close})|(?:${ctx.recover})`,
    contentName: LINK_TARGET,
  }
  const tail: GrammarRule = {
    begin: R`(?=[ \t]+:)`,
    end: `(?=${close})|(?:${ctx.recover})`,
    patterns: [{ include: '#attributes' }],
  }
  const inner = (rest: GrammarRule[]): GrammarRule[] => [{ include: `#brackets-${d.key}-${ctx.key}` }, ...rest]
  return [
    {
      // a bar before the closer and before any attribute: the link has a label
      begin: `([${LINK_LETTERS}])(${exactOpen(d)})(?=(?:${text}|${nested})*\\|)`,
      end: `(${close})|(?:${ctx.recover})`,
      beginCaptures: { 1: { name: CODE_SIGN }, 2: { name: CODE_SIGN } },
      endCaptures: { 1: { name: CODE_SIGN } },
      patterns: [
        {
          begin: R`\G`,
          end: R`(\|)|(?=${close})|(?:${ctx.recover})`,
          endCaptures: { 1: { name: 'punctuation.separator.link.podlite' } },
          contentName: LINK_LABEL,
          patterns: inner([{ include: `#inline-${ctx.key}` }]),
        },
        { ...address, begin: R`(?<=\|)`, patterns: inner([]) },
        tail,
      ],
    },
    {
      begin: `([${LINK_LETTERS}])(${exactOpen(d)})`,
      end: `(${close})|(?:${ctx.recover})`,
      beginCaptures: { 1: { name: CODE_SIGN }, 2: { name: CODE_SIGN } },
      endCaptures: { 1: { name: CODE_SIGN } },
      patterns: [{ ...address, begin: R`\G`, patterns: inner([]) }, tail],
    },
  ]
}

const inlineRules = (ctx: Context): GrammarRule => ({
  patterns: DELIMITERS.flatMap(d => [...linkRules(d, ctx), ...CODE_KINDS.map(kind => codeRule(kind, d, ctx))]),
})

// --- attributes -----------------------------------------------------------------

const attributes: GrammarRule = {
  patterns: [
    {
      begin: R`(:)(!)?([\p{L}_][\p{L}\p{Nd}_-]*)`,
      beginCaptures: {
        1: { name: 'entity.other.attribute-name.podlite' },
        2: { name: 'keyword.operator.negation.podlite' },
        3: { name: 'entity.other.attribute-name.podlite' },
      },
      // the value, if any, follows the name with nothing in between
      end: R`(?!\G)|(?=[ \t])|$`,
      patterns: [
        { match: R`\G<[^>]*>`, name: 'string.unquoted.podlite' },
        { match: R`\G«[^»]*»`, name: 'string.unquoted.podlite' },
        { match: R`\G\(\s*[-+]?\d+(?:\.\d+)?\s*\)`, name: 'constant.numeric.podlite' },
        { match: R`\G\(\s*'(?:[^'\\]|\\.)*'\s*\)`, name: 'string.quoted.single.podlite' },
        { match: R`\G\(\s*"(?:[^"\\]|\\.)*"\s*\)`, name: 'string.quoted.double.podlite' },
        { match: R`\G\([^)]*\)`, name: 'meta.structure.list.podlite' },
        { match: R`\G'(?:[^'\\]|\\.)*'`, name: 'string.quoted.single.podlite' },
        { match: R`\G"(?:[^"\\]|\\.)*"`, name: 'string.quoted.double.podlite' },
        { match: R`\G｢[^｣]*｣`, name: 'string.quoted.other.podlite' },
        { match: R`\G\[[^\]]*\]`, name: 'meta.structure.list.podlite' },
        { match: R`\G\{[^}]*\}`, name: 'meta.structure.dictionary.podlite' },
      ],
    },
  ],
}

// --- blocks ---------------------------------------------------------------------

const continuation = (rest: GrammarCapture): GrammarRule => ({
  match: R`^([ \t]*)(=)(?=[ \t])(.*)$`,
  captures: { 2: { name: 'punctuation.definition.continuation.podlite' }, 3: rest },
})

// The lines that go on with the settings of the marker line just above. \G holds only
// right after the marker line, so a later line of the same shape stays body text
const headerRule = (rest: GrammarCapture): GrammarRule => ({
  begin: R`\G`,
  end: R`^(?![ \t]*=[ \t])`,
  patterns: [continuation(rest)],
})

type Form = 'begin' | 'for' | '='

const ending = (form: Form, verbatim: boolean): string =>
  form === 'begin' ? (verbatim ? VERBATIM_CLOSER : CLOSER) : END_PARAGRAPH

const keywordOf = (form: Form): string => (form === '=' ? SIGN : DIRECTIVE)
const directiveOf = (form: Form): string => (form === '=' ? '=' : `=${form}`)

// The rest of an abbreviated line is data, not settings
const restOf = (form: Form, data: GrammarCapture): GrammarCapture => (form === '=' ? data : ATTRIBUTES)

const rawBlock = (form: Form): GrammarRule => ({
  begin: marker(directiveOf(form), RAW_NAMES),
  beginCaptures: markerCaptures(keywordOf(form), restOf(form, { name: 'markup.raw.block.podlite' })),
  end: ending(form, true),
  endCaptures: closerCaptures,
  patterns: form === '=' ? [rawLine] : [header, rawLine],
})

const commentBlock = (form: Form): GrammarRule => ({
  begin: marker(directiveOf(form), COMMENT_NAMES),
  beginCaptures: markerCaptures(keywordOf(form), restOf(form, { name: 'comment.block.podlite' })),
  end: ending(form, true),
  endCaptures: closerCaptures,
  // a delimited comment holds other comments; any other marker inside is comment text
  patterns:
    form === 'begin'
      ? [header, { include: '#comment-begin' }, commentLine]
      : form === 'for'
      ? [header, commentLine]
      : [],
})

const tableRule = (form: Form): GrammarRule => {
  const inside = form === 'begin' ? 'delimited' : 'paragraph'
  return {
    begin: marker(directiveOf(form), TABLE_NAMES),
    beginCaptures: markerCaptures(keywordOf(form), restOf(form, { patterns: [{ include: `#table-row-${inside}` }] })),
    end: ending(form, false),
    endCaptures: closerCaptures,
    patterns: [
      ...(form === '=' ? [] : [header]),
      // rows and cells are recognised as they arrive; one context serves both table forms
      ...(form === 'begin' ? [{ include: '#delimited-blocks' }] : []),
      { include: '#cell-markers' },
      { include: '#stray-end' },
      { include: `#table-row-${inside}` },
    ],
  }
}

const tableRow = (ctx: Context): GrammarRule => ({
  patterns: [
    {
      match: R`^[ \t]*(?=[-=_+|: \t]*[-=_]{2})[-=_+|: \t]+$`,
      name: 'punctuation.separator.table.podlite',
    },
    { match: R`\|`, name: 'punctuation.separator.table.podlite' },
    { include: `#inline-${ctx.key}` },
  ],
})

const SOURCE = 'string.unquoted.source.podlite'

const pictureRule = (form: Form): GrammarRule => {
  const inside = form === 'begin' ? 'delimited' : 'paragraph'
  const stop = form === 'begin' ? R`^(?=[ \t]*=end[ \t])` : END_PARAGRAPH
  return {
    begin: marker(directiveOf(form), PICTURE_NAMES),
    beginCaptures: markerCaptures(keywordOf(form), restOf(form, { name: SOURCE })),
    end: ending(form, false),
    endCaptures: closerCaptures,
    patterns:
      form === '='
        ? [{ include: `#inline-${inside}` }]
        : [
            header,
            // the first line with text is the source; everything after it, up to the end, is the caption
            {
              begin: R`^[ \t]*(\S.*?)[ \t]*$`,
              beginCaptures: { 1: { name: SOURCE } },
              end: stop,
              patterns: [{ include: `#inline-${inside}` }],
            },
          ],
  }
}

// Text a block shows: only the marker line carries the block's own scope, so an empty
// line, which shiki never passes on, cannot leave a heading painted over the next paragraph
const markerLine = (name?: string, patterns: GrammarRule[] = []): GrammarRule => ({
  begin: R`\G`,
  end: '$',
  contentName: name,
  patterns,
})

const textBlock = (form: Form): GrammarRule => {
  if (form === 'begin') {
    return {
      begin: marker('=begin', TEXT_NAMES),
      beginCaptures: markerCaptures(DIRECTIVE, ATTRIBUTES),
      end: CLOSER,
      endCaptures: closerCaptures,
      patterns: [header, { include: '#blocks' }, { include: '#inline-delimited' }],
    }
  }
  if (form === 'for') {
    return {
      begin: marker('=for', TEXT_NAMES),
      beginCaptures: markerCaptures(DIRECTIVE, ATTRIBUTES),
      end: END_PARAGRAPH,
      patterns: [header, { include: '#inline-paragraph' }],
    }
  }
  return {
    begin: R`^([ \t]*)(=)((${TEXT_NAMES.standard})|(${SEMANTIC_NAME})|(${NAME}))${AFTER_NAME}`,
    beginCaptures: markerCaptures(SIGN, {}),
    end: END_PARAGRAPH,
    patterns: [{ include: '#inline-paragraph' }],
  }
}

const headingLine: GrammarRule = {
  begin: R`^([ \t]*)(=)(head\d+)${AFTER_NAME}`,
  beginCaptures: { 2: { name: SIGN }, 3: { name: 'entity.name.tag.standard.podlite' } },
  end: END_PARAGRAPH,
  patterns: [
    markerLine('markup.heading.podlite', [{ include: '#inline-paragraph' }]),
    { include: '#inline-paragraph' },
  ],
}

const itemLine: GrammarRule = {
  begin: R`^([ \t]*)(=)(item\d*)${AFTER_NAME}(?:[ \t]+(\[[ xX]\]))?`,
  beginCaptures: {
    2: { name: SIGN },
    3: { name: 'entity.name.tag.standard.podlite' },
    4: { name: 'constant.language.task.podlite' },
  },
  end: END_PARAGRAPH,
  patterns: [{ include: '#inline-paragraph' }],
}

const cellMarkers: GrammarRule = {
  patterns: [
    {
      begin: R`^([ \t]*)(=for)[ \t]+(row|cell)${AFTER_NAME}(.*)$`,
      beginCaptures: { 2: { name: DIRECTIVE }, 3: { name: 'entity.name.tag.standard.podlite' }, 4: ATTRIBUTES },
      end: END_PARAGRAPH,
      patterns: [header, { include: '#inline-paragraph' }],
    },
    {
      // the rest of an abbreviated row or cell is its text
      begin: R`^([ \t]*)(=)(row|cell)${AFTER_NAME}`,
      beginCaptures: { 2: { name: SIGN }, 3: { name: 'entity.name.tag.standard.podlite' } },
      end: END_PARAGRAPH,
      patterns: [{ include: '#inline-paragraph' }],
    },
  ],
}

// =config, =set, =alias, =include, =boundary: directives, not blocks; each goes on over
// its continuation lines in its own way
const standalone = (word: string, operand: string, operandCaptures: GrammarCaptures, rest: GrammarCapture) => ({
  begin: R`^([ \t]*)(=${word})${AFTER_NAME}${operand}`,
  beginCaptures: { 2: { name: DIRECTIVE }, ...operandCaptures },
  end: R`^(?![ \t]*=[ \t])`,
  patterns: [continuation(rest)],
})

const flowing = (word: string, operand: string, operandCaptures: GrammarCaptures, body: GrammarRule[]) => ({
  begin: R`^([ \t]*)(=${word})${AFTER_NAME}${operand}`,
  beginCaptures: { 2: { name: DIRECTIVE }, ...operandCaptures },
  end: R`^(?![ \t]*=[ \t])`,
  patterns: [
    { match: R`^[ \t]*(=)(?=[ \t])`, captures: { 1: { name: 'punctuation.definition.continuation.podlite' } } },
    ...body,
  ],
})

const INCLUDE_SOURCE = R`[A-Za-z][\w+.-]*:[^\s|]*`
// attributes of the source: from a space followed by a colon to a bar outside quotes and brackets
const INCLUDE_ATTRIBUTES = R`(?:[ \t]+:(?:[^|'"(\[]|'[^']*'|"[^"]*"|\([^)]*\)|\[[^\]]*\])*)?`

const directives: GrammarRule = {
  patterns: [
    standalone(
      'config',
      R`(?:[ \t]+(?:([A-Z]<>)|(${NAME})))?(.*)$`,
      {
        3: { name: 'entity.name.tag.markup.podlite' },
        4: { name: 'entity.name.tag.podlite' },
        5: ATTRIBUTES,
      },
      ATTRIBUTES,
    ),
    // a continuation of =set either brings more attributes or goes on with a value; a value
    // and the replacement text of =alias may carry a markup code over to the next line, so
    // they are read by the patterns of the directive, not inside a capture of one line
    flowing('set', '', {}, [{ include: '#attributes' }, { include: '#inline-paragraph' }]),
    flowing('alias', R`(?:[ \t]+(${NAME}))?`, { 3: { name: 'variable.other.alias.podlite' } }, [
      { include: '#inline-paragraph' },
    ]),
    standalone(
      'include',
      // with a source scheme the source may carry attributes; without one the whole line is the selection
      R`[ \t]+(?:(${INCLUDE_SOURCE})(${INCLUDE_ATTRIBUTES})(.*)|(.*))$`,
      {
        3: { name: SOURCE },
        4: ATTRIBUTES,
        5: { name: 'string.unquoted.selector.podlite' },
        6: { name: 'string.unquoted.selector.podlite' },
      },
      ATTRIBUTES,
    ),
    standalone('boundary', '(.*)$', { 3: ATTRIBUTES }, ATTRIBUTES),
  ],
}

const strayEnd: GrammarRule = {
  match: R`^([ \t]*)(=end)[ \t]+(${NAME})${AFTER_NAME}`,
  captures: { 2: { name: DIRECTIVE }, 3: { name: 'entity.name.tag.podlite' } },
}

// Delimited blocks, which can sit inside other delimited blocks
const delimitedBlocks: GrammarRule = {
  patterns: [
    { include: '#comment-begin' },
    rawBlock('begin'),
    tableRule('begin'),
    pictureRule('begin'),
    textBlock('begin'),
  ],
}

const blocks: GrammarRule = {
  patterns: [
    { include: '#delimited-blocks' },
    commentBlock('for'),
    rawBlock('for'),
    tableRule('for'),
    pictureRule('for'),
    textBlock('for'),
    { include: '#directives' },
    { include: '#stray-end' },
    commentBlock('='),
    rawBlock('='),
    tableRule('='),
    pictureRule('='),
    headingLine,
    itemLine,
    textBlock('='),
  ],
}

// At the root of a document an indented line opens a code block, unless it goes on with
// a paragraph. The parser runs the code on to a blank line; here it stops at a line
// without the indent too, because shiki hides the blank line and the rule would
// otherwise swallow the paragraph after it
const root: GrammarRule = {
  patterns: [
    { include: '#blocks' },
    {
      begin: R`^(?=[ \t]+\S)`,
      end: R`^(?=\S)|${DIRECTIVE_LINE}|${BLANK_LINE}`,
      patterns: [rawLine],
    },
    {
      begin: R`^(?=\S)`,
      end: END_PARAGRAPH,
      patterns: [{ include: '#inline-paragraph' }],
    },
  ],
}

const repository: Record<string, GrammarRule> = {
  root,
  blocks,
  'delimited-blocks': delimitedBlocks,
  'comment-begin': commentBlock('begin'),
  'cell-markers': cellMarkers,
  directives,
  'stray-end': strayEnd,
  header: headerRule(ATTRIBUTES),
  attributes,
}

for (const ctx of CONTEXTS) {
  repository[`inline-${ctx.key}`] = inlineRules(ctx)
  repository[`table-row-${ctx.key}`] = tableRow(ctx)
  for (const d of DELIMITERS) repository[`brackets-${d.key}-${ctx.key}`] = { patterns: [bracketRule(d, ctx)] }
}

export const podliteGrammar: PodliteGrammar = {
  name: 'podlite',
  displayName: 'Podlite',
  scopeName: 'text.podlite',
  aliases: ['pod6'],
  patterns: [{ include: '#root' }],
  repository,
}
