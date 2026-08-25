const path = require('path')

const transformIgnores = [
  '.*remark-parse',
  '.*mdast.*',
  '.*micromark.*',
  '.*decode-named-character-reference',
  '.*character-entities',
  '.*unist',
  '.*unified',
  '.*bail',
  '.*is-plain-obj',
  '.*trough',
  '.*vfile',
  'entity-decode',
  '.*remark-gfm',
  '.*remark-math',
  '.*mdast-util-math',
  '.*ccount',
  '.*escape-string-regexp',
  '.*markdown-table',
  '.*longest-streak',
  'remark',
  'zwitch',
  'nanoid',
].join('|')

// Coverage counts what a person wrote and can change. Build output under lib/
// and esm/ duplicates src/, and a generated parser is the generator's product,
// not code anyone edits — counting either turns the figure into a measure of
// the instrument rather than of the tests.
const notWrittenByHand = [
  '/node_modules/',
  '/packages/[^/]+/(lib|esm|dist|built)/',
  '/packages/[^/]+/src/grammar\\.js$',
  '/packages/[^/]+/src/grammarfc\\.js$',
  '/packages/core/src/lint/grammar/lint\\.js$',
  '\\.test\\.(t|j)sx?$',
  '\\.spec\\.(t|j)sx?$',
]

module.exports = {
  moduleDirectories: ['node_modules'],
  coveragePathIgnorePatterns: notWrittenByHand,
  snapshotSerializers: ['jest-serializer-html'],
  snapshotFormat: { printBasicPrototype: true, escapeString: true },
  moduleNameMapper: {
    '\\.css$': path.resolve(__dirname, 'jest-css-stub.js'),
    '^mermaid$': path.resolve(__dirname, 'jest-mermaid-stub.js'),
    '^@podlite/schema/src/(.*)$': path.resolve(__dirname, 'packages/podlite-schema/src/$1'),
  },
  transform: {
    '\\.(t|j)sx?$': 'ts-jest',
    //   "\\.jsx?$": "ts-jest",
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/jest.tsconfig.json',
    },
  },
  transformIgnorePatterns: [`node_modules/(?!${transformIgnores})`],
}
