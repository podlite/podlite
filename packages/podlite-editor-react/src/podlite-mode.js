// podlite, copyright (c) by Aliaksandr Zahatski
// Distributed under an MIT license: https://github.com/podlite/podlite/blob/main/LICENSE

import CodeMirror from 'codemirror'
import './simpleplus'
;('use strict')

function ifBeginAbbrBlock(ifOk) {
  const res = [
    {
      regex:
        /\s*(=)(?=head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include)/,
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
    'defn',
    'formula',
    'input',
    'markdown',
    'nested',
    'output',
    'para',
    'picture',
    'pod',
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
    const allcodes = ['A', 'B', 'F', 'I', 'L', 'O', 'Z'].join('|')
    const handler = token => matches => {
      const code = matches?.groups?.code || 'NONEXISTS'
      const mapCodeToToken = {
        A: `variable-3 ${token}`,
        B: `strong ${token}`,
        F: `${token}`,
        I: `em ${token}`,
        L: `link ${token}`,
        O: `strikethrough ${token}`,
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
  if (blockName.match(/^(?:code|comment|data)$/)) {
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
    [`${blockName}_content_Abbr`]: [...isBlankLine({ pop: true }), ...getContentState(contentToken)],
    [`${blockName}_attr_Para`]: [
      ...ifNextStartAnyBlock({ pop: true }),
      ...attributesContent({ next: `${blockName}_content_Para` }),
    ],
    [`${blockName}_content_Para`]: [...isBlankLine({ pop: true }), ...getContentState(contentToken)],

    [`${blockName}_attr_Delim`]: [
      ...ifNextStartAnyBlock({ pop: true }),
      ...attributesContent({ next: `${blockName}_content_Delim` }),
    ],

    [`${blockName}_content_Delim`]: [
      ...ifNextAliasDirective('beginAliasDirective'),
      ...ifNextConfigDirective('beginConfigDirective'),
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
        /(?<blockName>head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include)/,
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
        /(?<blockName>head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include)/,
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
        /(?<blockName>head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include)/,
      token: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return [`variable-2 ${blockName}`]
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
        /(?=\s*=begin\s*(?:head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include|\w+))/,
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
        /(?=\s*=end\s*(?:head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include|\w+))/,
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
        /(?=\s*=(?:head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include))/,
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
        /(?=\s*=for\s*(?=head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include|\w+))/,
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
        /\s*(=begin)\s*(?=head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include|\w+)/,
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
        /\s*(=for)\s*(?=head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include|\w+)/,
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
CodeMirror.defineSimpleModePlus('podlite', {
  start: [
    ...ifNextAliasDirective('beginAliasDirective'),
    ...ifNextConfigDirective('beginConfigDirective'),
    ...ifBeginParaBlock('beginParaBlock'),
    ...ifBeginAbbrBlock('beginAbbrBlock'),
    ...ifBeginDelimBlock('beginDelimBlock'),

    ...getDefaultContentState(),

    // {
    //     regex: /.*$/,
    //     token: 'error',
    // },
  ],
  beginDelimBlock: [
    ...ifBlockName('Delim'),

    {
      regex: /(\w+)(\s*)/,
      token: [`variable-3`, null],
      next: 'attributes_delim',
    },
  ],
  attributes_delim: [
    ...ifNextEndDelimBlock({ next: 'endDelimBlock' }),
    ...attributesContent({ next: 'contentDelimBlock' }),
  ],
  contentDelimBlock: [
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
        /(\s*)(=end)(\s*)(?<blockName>head\d*|item\d*|code|comment|data|defn|formula|input|markdown|nested|output|para|picture|pod|table|toc|include)/,
      token: function (matches) {
        const blockName = matches?.groups?.blockName || 'default'
        return [null, 'keyword', null, blockName === 'comment' ? 'comment' : 'variable-2']
      },
      sol: true,
      pop: true,
    },
    {
      regex: /(\s*)(=end)(\s*)(\w+)/,
      token: [null, 'keyword', null, 'variable-3'],
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
      regex: /^(\s*)(=\w+)(\s*)(\w*)(.*)$/,
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
  beginParaBlock: [
    ...ifBlockName('Para'),
    {
      regex: /(\w+)(\s*)/,
      token: ['variable-3', null],
      next: 'attributes',
    },
  ],

  attributes: [...ifNextStartAnyBlock({ pop: true }), ...attributesContent({ next: 'content' })],
  beginAbbrBlock: [...ifBlockName('Abbr')],
  content: [...getContentState()],
  ...getContentStates(),
})

CodeMirror.defineMIME('text/podlite', 'podlite')
