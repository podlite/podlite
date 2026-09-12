import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const html = (source: string, props = {}) => renderToStaticMarkup(<Podlite {...props}>{source}</Podlite>)

const test = (id: string) => `=begin test :id<${id}> :caption('${id} caption')
=begin fixture
=head2 Overview
=end fixture

=for assert :absent :caption('no third level')
head3
=end test`

describe('a test on the page', () => {
  it('is open in the server output, anchored by its id', () => {
    const out = html(`=begin pod\nA rule.\n\n${test('v1.2')}\n=end pod\n`)
    expect(out).toContain('<details class="test" id="v12" open="">')
    expect(out).toContain(
      '<summary class="test-summary"><span class="test-label">test</span> <span class="test-caption">v1.2 caption</span></summary>',
    )
  })

  it('shows its fixture as source, not as markup', () => {
    const out = html(`=begin pod\nA rule.\n\n${test('t1')}\n=end pod\n`)
    expect(out).toContain('<div class="test-fixture"><pre><code>=head2 Overview')
    expect(out).not.toContain('<h2')
  })

  it('shows what an assertion expects', () => {
    const out = html(`=begin pod\nA rule.\n\n${test('t1')}\n=end pod\n`)
    expect(out).toContain(
      '<div class="test-assert test-absent"><code class="test-selector">head3\n</code> <span class="test-expect">must find no block</span> <span class="test-assert-caption">no third level</span></div>',
    )
  })

  it('shows a resource by its name', () => {
    const out = html(
      `=begin test\n=begin resource :name<a.podlite>\n=head1 Guide\n=end resource\n=for assert\nhead1\n=end test`,
    )
    expect(out).toContain(
      '<div class="test-resource"><span class="test-resource-name">a.podlite</span><pre><code>=head1 Guide',
    )
  })

  it('starts folded when the author folds it', () => {
    const out = html(`=begin test :id<t1> :folded\n=for assert\npara\n=end test`)
    expect(out).toContain('<details class="test" id="t1"><summary')
  })

  it('hides its words inside masked content', () => {
    const out = html(
      `=begin pod :masked\n=begin test :caption('secret caption')\n=for assert :caption('secret assert')\npara\n=end test\n=end pod`,
    )
    expect(out).not.toContain('secret')
    expect(out).toContain('<span class="test-caption">██████ ███████</span>')
  })
})

describe('a test grouped with the block it stands under', () => {
  it('shares a group with the paragraph above it and with the next test', () => {
    const out = html(`=begin pod\nA rule.\n\n${test('t1')}\n\n${test('t2')}\n\nAnother paragraph.\n=end pod\n`)
    expect(out).toMatch(
      /<div class="test-group"><p>A rule\.\n<\/p><details class="test" id="t1"[^]*<details class="test" id="t2"[^]*<\/details><\/div><p>Another paragraph/,
    )
  })

  it('shares a group with a whole list', () => {
    const out = html(`=begin pod\n=item One\n\n=item Two\n\n${test('t1')}\n=end pod\n`)
    expect(out).toMatch(/<div class="test-group"><ul[^]*<\/ul><details class="test" id="t1"/)
  })

  it('stands alone under a heading', () => {
    const out = html(`=begin pod\n=head1 Title\n\n${test('t1')}\n=end pod\n`)
    expect(out).toContain('<details class="test" id="t1"')
    expect(out).not.toContain('test-group')
  })

  it('stands alone after a directive, which keeps its reach', () => {
    const out = html(`=begin pod\nA rule.\n\n=config test :!folded\n\n${test('t1')}\n=end pod\n`)
    expect(out).toContain('<details class="test" id="t1"')
    expect(out).not.toContain('test-group')
  })

  it('is grouped inside an included file too', () => {
    const includeReader = (path: string) =>
      path === 'part.podlite' ? `=begin pod\nA rule.\n\n${test('t1')}\n=end pod\n` : null
    const out = html(`=begin pod\n=include file:part.podlite\n=end pod\n`, { includeReader })
    expect(out).toMatch(/<div class="test-group"><p>A rule\.\n<\/p><details class="test" id="t1"/)
  })
})
