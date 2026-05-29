// podlite, copyright (c) by Aliaksandr Zahatski
// Distributed under an MIT license: https://github.com/podlite/podlite/blob/main/LICENSE
import { HighlightStyle, LanguageSupport, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { Tag, tags } from '@lezer/highlight'
import { simpleMode } from './simple-mode.js'

const tokenTable = {
  content: tags.content,
  comment: tags.comment,
  identifier: tags.variableName,
  register: Tag.define(),
  number: tags.number,
  string: tags.string,
  label: Tag.define(),
  opcode: Tag.define(),
  directive: tags.directive,
  keyword: tags.keyword,
  operator: tags.operator,
  punctuation: tags.punctuation,
  unassigned: Tag.define(),
  em: tags.emphasis,
  monospace: tags.monospace,
  'variable-3': tags.variableName,
  'variable-2': tags.operator,
  'semantic-block': tags.constant(tags.variableName),
  'custom-block': tags.className,
  pod: Tag.define(),
  header: tags.heading,
  'header-1': tags.heading1,
  'header-2': tags.heading2,
  'header-3': tags.heading3,
  strikethrough: tags.strikethrough,
  underline: Tag.define(),
  link: tags.link,
}

function classifyBlockName(blockName) {
  if (/^[A-Z][A-Z][A-Z0-9_-]*$/.test(blockName)) return 'semantic-block'
  if (/^[A-Z][a-z][a-zA-Z0-9_-]*$/.test(blockName)) return 'custom-block'
  return 'variable-3'
}

function ifBeginAbbrBlock(ifOk) {
  const res = [
    {
      regex:
        /\s*(=)(?=head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include)/,
      token: 'keyword',
      sol: true,
      push: ifOk,
    },
  ]
  return res
}

function getBlockNames() {
  const names = [
    'code',
    'comment',
    'data',
    'data-table',
    'defn',
    'formula',
    'input',
    'markdown',
    'nested',
    'output',
    'para',
    'picture',
    'pod',
    'row',
    'cell',
    'table',
    'toc',
    'include',
  ]
  names.push(...[...Array(10)].map((_, i) => `head${i + 1}`))
  names.push(...[...Array(10)].map((_, i) => `item${i + 1}`).reverse())
  names.push('item', 'head')
  return names
}

function getContentState(token = 'content') {
  return [
    {
      regex: /(?=\s*=\w+)/,
      token: 'content',
      sol: true,
      pop: true,
    },
    ...getDefaultContentState(token),
  ]
}
function getDefaultContentState(token = 'content') {
  const getStateForMarkupCodes = ({ token }) => {
    const allcodes = ['A', 'B', 'C', 'F', 'I', 'L', 'O', 'U', 'Z'].join('|')
    const handler = token => matches => {
      const code = matches?.groups?.code || 'NONEXISTS'
      const mapCodeToToken = {
        A: `variable-3 ${token}`,
        B: `strong ${token}`,
        C: `monospace ${token}`,
        F: `${token}`,
        I: `em ${token}`,
        L: `link ${token}`,
        O: `strikethrough ${token}`,
        U: `underline ${token}`,
        Z: `comment ${token}`,
      }
      const resultToken = matches[1]
      return ['keyword', 'keyword', mapCodeToToken[resultToken] || token, 'keyword']
    }
    return [
      {
        regex: new RegExp(`(?<code>${allcodes})(<)([^>]*)(>)`),
        token: handler(token),
      },
      {
        regex: new RegExp(`(?<code>${allcodes})(«)([^»]*)(»)`),
        token: handler(token),
      },

      {
        regex: new RegExp(`(.+?)(?=\\w[«<])`),
        token: token,
      },
      {
        regex: /(.+)$/,
        token: token,
      },
    ]
  }
  return [
    ...getStateForMarkupCodes({ token }),
    {
      regex: /./,
      token: token,
    },
  ]
}
function getVerbatimContentState(token = 'content') {
  return [
    {
      regex: /(.+)$/,
      token: token,
    },
  ]
}
function isBlankLine(attr = {}) {
  return [
    {
      regex: /^\s*$/,
      token: null,
      sol: true,
      pop: true,
      ...attr,
    },
    {
      regex: /blankline/,
      token: null,
      blankline: true,
      pop: true,
      ...attr,
    },
  ]
}

function getStatesForBlock(blockName, contentToken) {
  if (blockName.match(/^(?:code|comment|data|data-table)$/)) {
    return {
      [`${blockName}_content_Abbr`]: [
        ...isBlankLine({ pop: true }),
        ...ifNextStartAnyBlock({ pop: true }),
        ...getVerbatimContentState(contentToken),
      ],
      [`${blockName}_attr_Para`]: [
        ...ifNextStartAnyBlock({ pop: true }),
        ...attributesContent({ next: `${blockName}_content_Para` }),
      ],
      [`${blockName}_content_Para`]: [...isBlankLine({ pop: true }), ...getVerbatimContentState(contentToken)],

      [`${blockName}_attr_Delim`]: [...attributesContent({ next: `${blockName}_content_Delim` })],
      [`${blockName}_content_Delim`]: [
        {
          regex: new RegExp(`(?=\\s*=end\\s*(?:${blockName}))`),
          token: null,
          sol: true,
          next: 'endDelimBlock',
        },
        ...getVerbatimContentState(contentToken),

        {
          regex: /(.*)$/,
          token: ['content'],
        },
      ],
    }
  }
  return {
    [`${blockName}_content_Abbr`]: [
      ...isBlankLine({ pop: true }),
      ...ifNextStartAnyBlock({ pop: true }),
      ...getContentState(contentToken),
    ],
    [`${blockName}_attr_Para`]: [
      ...ifNextStartAnyBlock({ pop: true }),
      ...attributesContent({ next: `${blockName}_content_Para` }),
    ],
    [`${blockName}_content_Para`]: [
      ...isBlankLine({ pop: true }),
      ...ifNextStartAnyBlock({ pop: true }),
      ...getContentState(contentToken),
    ],

    [`${blockName}_attr_Delim`]: [...attributesContent({ next: `${blockName}_content_Delim` })],

    [`${blockName}_content_Delim`]: [
      ...ifNextAliasDirective('beginAliasDirective'),
      ...ifNextConfigDirective('beginConfigDirective'),
      ...ifNextSetDirective('beginSetDirective'),
      ...ifNextBoundaryDirective('beginBoundaryDirective'),
      ...ifBeginParaBlock('beginParaBlock'),
      ...ifBeginAbbrBlock('beginAbbrBlock'),
      ...ifBeginDelimBlock('beginDelimBlock'),
      ...ifNextEndDelimBlock({ next: 'endDelimBlock' }),
      ...getDefaultContentState(contentToken),
      {
        regex: /.*/,
        token: `content`,
      },
    ],
  }
}

function getContentStates() {
  const names = getBlockNames()
  const getStateForBlock = blockName => {
    const matchRes = blockName.match(/(?<blockname>[^\d]+)(?<level>\d*)/)
    const level = matchRes?.groups?.level || 1
    const blName = matchRes?.groups?.blockname || blockName
    if (blName === 'head') {
      return getStatesForBlock(blockName, `header header-${level}`)
    }
    if (blName === 'comment') {
      return getStatesForBlock(blockName, `comment`)
    }
    return getStatesForBlock(blockName)
  }
  return names.reduce((acc, name) => {
    return { ...acc, ...getStateForBlock(name) }
  }, {})
}

function ifBlockName(ifOk = 'content', attr = {}) {
  const names = getBlockNames()

  if (ifOk === 'Para') {
    const res = {
      regex:
        /(?<blockName>head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include)/,
      token: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return [`variable-2 ${blockName}`]
      },
      next: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return `${blockName}_attr_Para`
      },
    }
    return [res]
  }
  if (ifOk === 'Abbr') {
    const res = {
      regex:
        /(?<blockName>head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include)/,
      token: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return [`variable-2 ${blockName}`]
      },
      next: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return `${blockName}_content_Abbr`
      },
    }
    return [res]
  }
  if (ifOk === 'Delim') {
    const res = {
      regex:
        /(?<blockName>head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include)/,
      token: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return [blockName === 'comment' ? 'comment' : `variable-2 ${blockName}`]
      },
      next: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return `${blockName}_attr_Delim`
      },
    }
    return [res]
  }
  throw new Error('[ifBlockName] Undefined parametr vlue ' + ifOk)
}
function ifNextBeginDelimBlock(attr = {}) {
  return [
    {
      regex:
        /(?=\s*=begin\s*(?:head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include|\w+))/,
      token: null,
      sol: true,
      ...attr,
    },
  ]
}

function ifNextEndDelimBlock(attr = {}) {
  return [
    {
      regex:
        /(?=\s*=end\s*(?:head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include|\w+))/,
      token: null,
      sol: true,
      ...attr,
    },
  ]
}

function ifNextBeginAbbrBlock(attr = {}) {
  return [
    {
      regex:
        /(?=\s*=(?:head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include))/,
      token: null,
      sol: true,
      ...attr,
    },
  ]
}

function ifNextBeginParaBlock(attr = {}) {
  return [
    {
      regex:
        /(?=\s*=for\s*(?=head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include|\w+))/,
      token: 'keyword',
      sol: true,
      ...attr,
    },
  ]
}

function ifNextStartAnyBlock(attr = {}) {
  return [...ifNextBeginDelimBlock(attr), ...ifNextBeginAbbrBlock(attr), ...ifNextBeginParaBlock(attr)]
}

function attributesContent(attr = {}) {
  return [
    ...ifEndOfAttributes(attr),
    {
      regex: /(\s*)(=)(\s*)/,
      token: [null, 'keyword', null],
      sol: true,
    },
    {
      regex: /:\w+/,
      token: 'attribute',
    },
    {
      regex: /[<(].*?[>)]/,
      token: 'string',
    },
  ]
}

function ifEndOfAttributes(attr = {}) {
  return [
    {
      regex: /(?!\s*=\s+)/,
      token: null,
      sol: true,
      ...attr,
    },
  ]
}

function ifBeginDelimBlock(ifOk) {
  return [
    {
      regex:
        /\s*(=begin)\s*(?=head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include|\w+)/,
      token: 'keyword',
      sol: true,
      push: ifOk,
    },
  ]
}

function ifBeginParaBlock(ifOk) {
  return [
    {
      regex:
        /\s*(=for)\s*(?=head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include|\w+)/,
      token: 'keyword',
      sol: true,
      push: ifOk,
    },
  ]
}
function ifNextAliasDirective(ifOk) {
  return [
    {
      regex: /(?=\s*=alias)/,
      token: null,
      sol: true,
      push: ifOk,
    },
  ]
}
function ifNextConfigDirective(ifOk) {
  return [
    {
      regex: /(?=\s*=config)/,
      token: null,
      sol: true,
      push: ifOk,
    },
  ]
}
function ifNextSetDirective(ifOk) {
  return [
    {
      regex: /(?=\s*=set\b)/,
      token: null,
      sol: true,
      push: ifOk,
    },
  ]
}
function ifNextBoundaryDirective(ifOk) {
  return [
    {
      regex: /(?=\s*=boundary\b)/,
      token: null,
      sol: true,
      push: ifOk,
    },
  ]
}

export const podlite = simpleMode({
  start: [
    ...ifNextAliasDirective('beginAliasDirective'),
    ...ifNextConfigDirective('beginConfigDirective'),
    ...ifNextSetDirective('beginSetDirective'),
    ...ifNextBoundaryDirective('beginBoundaryDirective'),
    ...ifBeginParaBlock('beginParaBlock'),
    ...ifBeginAbbrBlock('beginAbbrBlock'),
    ...ifBeginDelimBlock('beginDelimBlock'),
    //   added if brocken sequence
    //   ...ifNextEndDelimBlock({ push: 'endDelimBlock' }),
    ...getDefaultContentState(),

    // {
    //     regex: /.*$/,
    //     token: 'error',
    // },
  ],
  beginDelimBlock: [
    ...ifBlockName('Delim'),

    {
      regex: /(?<blockName>[\w-]+)(\s*)/,
      token: function (matches) {
        return [classifyBlockName(matches?.groups?.blockName || ''), null]
      },
      next: 'attributes_delim',
    },
  ],
  attributes_delim: [
    ...ifNextEndDelimBlock({ next: 'endDelimBlock' }),
    ...attributesContent({ next: 'contentDelimBlock' }),
  ],
  contentDelimBlock: [
    ...ifNextSetDirective('beginSetDirective'),
    ...ifNextBoundaryDirective('beginBoundaryDirective'),
    ...ifBeginParaBlock('beginParaBlock'),
    ...ifBeginAbbrBlock('beginAbbrBlock'),
    ...ifBeginDelimBlock('beginDelimBlock'),
    ...ifNextEndDelimBlock({ next: 'endDelimBlock' }),
    ...getDefaultContentState(),
    {
      regex: /.*/,
      token: `content`,
    },
  ],
  endDelimBlock: [
    {
      regex:
        /(\s*)(=end)(\s*)(?<blockName>head\d*|item\d*|code|comment|data-table|data|defn|formula|input|markdown|nested|output|para|picture|pod|row|cell|table|toc|include)/,
      token: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return [null, 'keyword', null, blockName === 'comment' ? 'comment' : `variable-2 ${blockName}`]
      },
      sol: true,
      pop: true,
    },
    {
      regex: /(\s*)(=end)(\s*)(?<blockName>[\w-]+)/,
      token: function (matches) {
        return [null, 'keyword', null, classifyBlockName(matches?.groups?.blockName || '')]
      },
      sol: true,
      pop: true,
    },
  ],
  beginAliasDirective: [
    {
      regex: /(\s*)(=)(\s+)(.*)$/,
      token: [null, 'keyword', null, 'content'],
      sol: true,
    },
    {
      regex: /^(\s*)(=alias)(\s*)(\w*)(.*)$/,
      token: [null, 'keyword', null, 'variable-3', 'content'],
      sol: true,
    },
    {
      regex: /(?!\s*=\s+)/,
      token: null,
      sol: true,
      pop: true,
    },
  ],
  beginConfigDirective: [
    {
      regex: /(\s*)(=\w+)(\s*)/,
      token: [null, 'keyword', null],
      sol: true,
      next: 'config_attr',
    },
  ],
  config_attr: [...ifNextStartAnyBlock({ pop: true }), ...attributesContent({ pop: true })],
  beginSetDirective: [
    {
      regex: /(\s*)(=)(\s+)(.*)$/,
      token: [null, 'keyword', null, 'content'],
      sol: true,
    },
    {
      regex: /^(\s*)(=set)(\s*)(.*)$/,
      token: [null, 'keyword', null, 'content'],
      sol: true,
    },
    {
      regex: /(?!\s*=\s+)/,
      token: null,
      sol: true,
      pop: true,
    },
  ],
  beginBoundaryDirective: [
    {
      regex: /^(\s*)(=boundary)(\s*)/,
      token: [null, 'keyword', null],
      sol: true,
      next: 'boundary_attr',
    },
  ],
  boundary_attr: [...ifNextStartAnyBlock({ pop: true }), ...attributesContent({ pop: true })],
  beginParaBlock: [
    ...ifBlockName('Para'),
    {
      regex: /(?<blockName>[\w-]+)(\s*)/,
      token: function (matches) {
        return [classifyBlockName(matches?.groups?.blockName || ''), null]
      },
      next: 'attributes',
    },
  ],

  attributes: [...ifNextStartAnyBlock({ pop: true }), ...attributesContent({ next: 'content' })],
  beginAbbrBlock: [...ifBlockName('Abbr')],
  content: [...getContentState()],
  ...getContentStates(),
  languageData: {
    name: 'Podlite',
    commentTokens: { line: '#' },
  },
  tokenTable: tokenTable,
})

const language = StreamLanguage.define(podlite)

const syntaxHighlighter = syntaxHighlighting(
  HighlightStyle.define([
    // { tag: tokenTable.opcode, class: "text-editor-opcode" /* "text-green-700 dark:text-green-400" */ },
    // { tag: tokenTable.directive, class: "text-editor-directive" /* "text-blue-700 dark:text-blue-400" */ },
    // { tag: tokenTable.label, class: "text-editor-label" /* "text-yellow-700 dark:text-yellow-400" */ },
    // {
    //     tag: tokenTable.comment,
    //     class: "text-editor-comment italic" /* "text-gray-500 dark:text-gray-500 italic" */,
    // },
    // { tag: tokenTable.register, class: "text-editor-register" /* "text-red-700 dark:text-red-400" */ },
    // { tag: tokenTable.number, class: "text-editor-number" /* "text-orange-700 dark:text-orange-400" */ },
    // { tag: tokenTable.string, class: "text-editor-string" /* "text-orange-600 dark:text-orange-600" */ },
    // { tag: tokenTable.operator, class: "text-editor-operator" /* "text-pink-700 dark:text-pink-400" */ },
    // { tag: tokenTable.punctuation, class: "text-editor-punctuation" /* "text-gray-600 dark:text-gray-400" */ },
    { tag: tokenTable.header, class: 'text-editor-punctuation' /* "text-gray-600 dark:text-gray-400" */ },
    { tag: tokenTable.underline, textDecoration: 'underline' },
    { tag: tokenTable.link, class: 'cm-clickable-link' },
  ]),
)
export function podliteLang() {
  return new LanguageSupport(language, [syntaxHighlighter])
}
