import { podlitePluggable } from '../src/pluggableParser'
import { attachHeadingNumberPrefix } from '../src/helpers/headingNumbering'

const findHeads = (node: any, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findHeads(n, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.type === 'block' && node.name === 'head') out.push(node)
  if (node.content) findHeads(node.content, out)
  return out
}

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

describe('heading numbering pre-pass', () => {
  it('attaches a prefix to a :numbered head', () => {
    const ast = parseToAst(`
=for head1 :numbered
First
`)
    const heads = findHeads(ast)
    expect(heads[0].numberPrefix).toBe('1.')
  })

  it('increments counter at the same level on subsequent numbered heads', () => {
    const ast = parseToAst(`
=for head1 :numbered
A

=for head1 :numbered
B

=for head1 :numbered
C
`)
    const heads = findHeads(ast)
    expect(heads.map(h => h.numberPrefix)).toEqual(['1.', '2.', '3.'])
  })

  it('nests counters across head1 → head2', () => {
    const ast = parseToAst(`
=for head1 :numbered
Top

=for head2 :numbered
Sub

=for head2 :numbered
Sub2

=for head1 :numbered
Top2
`)
    const heads = findHeads(ast)
    expect(heads.map(h => h.numberPrefix)).toEqual(['1.', '1.1.', '1.2.', '2.'])
  })

  it('reproduces the spec example with mixed numbered and plain heads', () => {
    const ast = parseToAst(`
=config head1 :numbered

=config head2 :numbered

=config head3 :!numbered

=head1 The Problem

=head1 The Solution

=head2 Analysis

=head3 Overview

=head3 Details

=head2 Design

=head1 The Implementation
`)
    const heads = findHeads(ast)
    expect(heads.map(h => h.numberPrefix)).toEqual(['1.', '2.', '2.1.', undefined, undefined, '2.2.', '3.'])
  })

  it('own :!numbered overrides inherited :numbered', () => {
    const ast = parseToAst(`
=config head2 :numbered

=for head2 :!numbered
Plain
`)
    const heads = findHeads(ast)
    expect(heads[0].numberPrefix).toBeUndefined()
  })

  it('plain head between numbered same-level heads does not consume a number', () => {
    const ast = parseToAst(`
=for head1 :numbered
A

=head1 B

=for head1 :numbered
C
`)
    const heads = findHeads(ast)
    expect(heads.map(h => h.numberPrefix)).toEqual(['1.', undefined, '2.'])
  })

  it('a head at a deeper level resets counters of even deeper levels for siblings', () => {
    const ast = parseToAst(`
=for head1 :numbered
A

=for head2 :numbered
A1

=for head3 :numbered
A1a

=for head2 :numbered
A2
`)
    const heads = findHeads(ast)
    expect(heads.map(h => h.numberPrefix)).toEqual(['1.', '1.1.', '1.1.1.', '1.2.'])
  })

  it('drops leading zero segments when the heading appears without a numbered ancestor', () => {
    const ast = parseToAst(`
=for head3 :numbered
Orphan
`)
    const heads = findHeads(ast)
    expect(heads[0].numberPrefix).toBe('1.')
  })

  it('is a no-op on an AST without head blocks', () => {
    const ast = parseToAst(`Plain paragraph.`)
    const before = JSON.stringify(ast)
    attachHeadingNumberPrefix(ast)
    expect(JSON.stringify(ast)).toBe(before)
  })
})
