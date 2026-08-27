import React from 'react'
import { PodliteExport, makeInterator, podlitePluggable } from '@podlite/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import Podlite from '@podlite/to-jsx'
import { PluginRegister } from '../src'
import { md2ast } from '../src/tools'

const collectIds = (src: string, ruleName: string): string[] => {
  const ids: string[] = []
  makeInterator({
    [ruleName]: node => {
      ids.push(node.id)
    },
  })(md2ast(src), {})
  return ids
}

const headingIds = (src: string) => collectIds(src, 'head:block')

const render = (src: string): string => {
  const podlite = podlitePluggable().use({ ...PluginRegister })
  const tree: PodliteExport = podlite.toAstResult(podlite.parse(src))
  return renderToStaticMarkup(<Podlite tree={tree}>{src}</Podlite>)
}

it('[markdown]: heading takes its own text as the id', () => {
  expect(headingIds('# Setup\n')).toEqual(['Setup'])
  expect(headingIds('# Setup\n\n## Install\n')).toEqual(['Setup', 'Install'])
})

it('[markdown]: heading id collapses inner whitespace and drops inline markup', () => {
  expect(headingIds('# Two  spaces\n')).toEqual(['Two spaces'])
  expect(headingIds('#   Padded  \n')).toEqual(['Padded'])
  expect(headingIds('# Some **bold** title\n')).toEqual(['Some bold title'])
})

it('[markdown]: a link written against a heading reaches it in the rendered html', () => {
  const html = render(`=begin markdown
# Setup

[go](#setup)
=end markdown
`)
  const anchor = /<h1 id="([^"]+)">/.exec(html)
  const target = /<a href="#([^"]+)">/.exec(html)
  expect(anchor && anchor[1]).toEqual('Setup')
  expect(target && target[1]).toEqual(anchor && anchor[1])
})

it('[markdown]: a document without headings keeps generated ids', () => {
  const src = 'plain text\n\n- one\n- two\n'
  const generated = /^[A-Za-z0-9_-]{21}$/
  const ids = [...collectIds(src, ':para'), ...collectIds(src, 'item:block')]
  expect(ids.length).toBeGreaterThan(0)
  expect(ids.filter(id => !generated.test(id))).toEqual([])
})

it('[markdown]: a heading with no text of its own keeps a generated id', () => {
  const generated = /^[A-Za-z0-9_-]{21}$/
  const ids = headingIds('# ![Logo](/logo.png)\n\n# ![Other](/other.png)\n')
  expect(ids.filter(id => generated.test(id)).length).toEqual(2)
  expect(new Set(ids).size).toEqual(2)
})

it('[markdown]: two headings with the same text get the same id and separate anchors', () => {
  expect(headingIds('# Setup\n\n## Setup\n')).toEqual(['Setup', 'Setup'])
  const html = render(`=begin markdown
# Setup

## Setup

[go](#setup)
=end markdown
`)
  expect(html).toContain('<h1 id="Setup">')
  expect(html).toContain('<h2 id="Setup-2">')
  expect(html).toContain('<a href="#Setup">')
})
