import type { Violation } from '../src/lint/types'

// what each scanner returns; a scanner without an entry returns nothing
const fromScan: Record<string, Violation[]> = {}

jest.mock('../src/lint/rules/abbreviated-attrs', () => {
  const actual = jest.requireActual('../src/lint/rules/abbreviated-attrs')
  return { ...actual, scanAbbreviatedAttrs: () => fromScan.abbreviated ?? [] }
})
jest.mock('../src/lint/rules/markdown-in-pod', () => {
  const actual = jest.requireActual('../src/lint/rules/markdown-in-pod')
  return { ...actual, scanMarkdownInPod: () => fromScan.markdown ?? [] }
})
jest.mock('../src/lint/rules/unclosed-markup-code', () => {
  const actual = jest.requireActual('../src/lint/rules/unclosed-markup-code')
  return { ...actual, scanUnclosedMarkupCodes: () => fromScan.codes ?? [] }
})

import { scanSourceRules } from '../src/lint/grammar/scan'

const many = (rule: string, n: number): Violation[] =>
  Array.from({ length: n }, (_, i) => ({ rule, severity: 'warning' as const, message: String(i) }))

afterEach(() => {
  for (const key of Object.keys(fromScan)) delete fromScan[key]
})

describe('a scanner report too large to pass as arguments', () => {
  it.each(['abbreviated', 'markdown', 'codes'])('keeps every message of the %s scanner in order', scanner => {
    fromScan[scanner] = many('x-many', 200_000)
    const found = scanSourceRules('=pod\n\nText.\n', 'podlite')
    expect(found.map(v => v.message)).toEqual(fromScan[scanner].map(v => v.message))
  })

  it('reports in the order of the scanners', () => {
    fromScan.abbreviated = many('x-abbreviated', 1)
    fromScan.markdown = many('x-markdown', 1)
    fromScan.codes = many('x-codes', 1)
    const found = scanSourceRules('=begin pod\nText.\n', 'podlite')
    expect(found.map(v => v.rule)).toEqual(['delimited-block-balance', 'x-abbreviated', 'x-markdown', 'x-codes'])
  })
})
