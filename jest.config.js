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
].join('|')

module.exports = {
  moduleDirectories: ['node_modules'],
  snapshotSerializers: ['jest-serializer-html'],
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
