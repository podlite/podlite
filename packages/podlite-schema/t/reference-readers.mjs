// Reads markdown given on stdin with two readers and prints, for every link and picture,
// what each reader takes its address, title and alternative text to be.
import { marked } from 'marked'
import { JSDOM } from 'jsdom'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

// the cells of the tables a reader finds, each as the code values it holds
const cellsOf = text => {
  const dom = new JSDOM(marked.parse(text, { gfm: true })).window.document
  const byMarked = [...dom.querySelectorAll('tr')].map(row =>
    [...row.querySelectorAll('td, th')].map(cell => [...cell.querySelectorAll('code')].map(code => code.textContent)),
  )
  const byRemark = []
  const walk = node => {
    if (node.type === 'tableRow')
      byRemark.push(
        node.children.map(cell => {
          const codes = []
          const inner = n => (n.type === 'inlineCode' ? codes.push(n.value) : (n.children || []).forEach(inner))
          inner(cell)
          return codes
        }),
      )
    ;(node.children || []).forEach(walk)
  }
  walk(unified().use(remarkParse).use(remarkGfm).parse(text))
  return { marked: byMarked, remark: byRemark }
}

// the address a reader such as GitHub builds from the text of a heading, repeats numbered
const slugsOf = texts => {
  const seen = new Map()
  return texts.map(text => {
    const base = text
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{Nd}\p{Nl}\-_ ]/gu, '')
      .replace(/ /g, '-')
    let slug = base
    while (seen.has(slug)) {
      const count = (seen.get(base) || 0) + 1
      seen.set(base, count)
      slug = `${base}-${count}`
    }
    seen.set(slug, 0)
    return slug
  })
}

// for each link to a place in the document, the heading a reader takes it to: the number of
// the heading in the page, by a named anchor before it or by the address built from its text.
// Each reader is followed on its own: anchors and headings in the order it reads them. Also
// the addresses the page gives more than once.
const headingsOf = text => {
  const resolveWith = (headings, anchors) => {
    const slugs = slugsOf(headings)
    return href => {
      const target = decodeURIComponent(href.slice(1))
      const places = [...anchors.filter(([name]) => name === target).map(([, at]) => at)]
      const bySlug = slugs.indexOf(target)
      if (bySlug !== -1) places.push(bySlug)
      // a target two places answer is no target
      if (new Set(places).size > 1) return 'ambiguous'
      return places.length ? places[0] : -1
    }
  }
  const dom = new JSDOM(marked.parse(text, { gfm: true })).window.document
  const order = [...dom.querySelectorAll('h1, h2, h3, h4, h5, h6, a[name]')]
  const headings = []
  const anchors = []
  for (const node of order) {
    if (/^H\d$/.test(node.tagName)) headings.push(node.textContent)
    else anchors.push([node.getAttribute('name'), headings.length])
  }
  const links = [...dom.querySelectorAll('a[href^="#"]')].map(node => node.getAttribute('href'))
  const byMarked = links.map(resolveWith(headings, anchors))
  const remarkHeadings = []
  const remarkAnchors = []
  const remarkLinks = []
  const textOf = node =>
    node.type === 'image' || node.type === 'html'
      ? ''
      : node.type === 'footnoteReference'
      ? node.label
      : node.type === 'text' || node.type === 'inlineCode'
      ? node.value
      : (node.children || []).map(textOf).join('')
  const walk = node => {
    if (node.type === 'heading') remarkHeadings.push(textOf(node))
    if (node.type === 'html')
      for (const match of node.value.matchAll(/<a name="([^"]*)">/g))
        remarkAnchors.push([match[1], remarkHeadings.length])
    if (node.type === 'link' && node.url.startsWith('#')) remarkLinks.push(node.url)
    ;(node.children || []).forEach(walk)
  }
  walk(unified().use(remarkParse).use(remarkGfm).parse(text))
  // an address the page gives twice, without regard to case: by two anchors, by an anchor and
  // a heading, or by two headings — even when both stand at one place
  const repeated = (headings, anchors) => {
    const all = [...anchors.map(([name]) => name), ...slugsOf(headings)].map(address => address.toLowerCase())
    return [...new Set(all.filter((address, at) => all.indexOf(address) !== at))]
  }
  return {
    marked: byMarked,
    remark: remarkLinks.map(resolveWith(remarkHeadings, remarkAnchors)),
    repeated: [...new Set([...repeated(headings, anchors), ...repeated(remarkHeadings, remarkAnchors)])],
  }
}

const read = text => {
  const dom = new JSDOM(marked.parse(text, { gfm: true })).window.document
  const byMarked = [...dom.querySelectorAll('a, img')].map(node => ({
    url: node.getAttribute(node.tagName === 'A' ? 'href' : 'src'),
    title: node.getAttribute('title'),
    alt: node.getAttribute('alt'),
  }))
  const byRemark = []
  const walk = node => {
    if (node.type === 'link' || node.type === 'image')
      byRemark.push({ url: node.url, title: node.title ?? null, alt: node.type === 'image' ? node.alt : null })
    ;(node.children || []).forEach(walk)
  }
  walk(unified().use(remarkParse).use(remarkGfm).parse(text))
  return { marked: byMarked, remark: byRemark }
}

let input = ''
process.stdin.on('data', chunk => (input += chunk))
process.stdin.on('end', () => {
  const asked = JSON.parse(input)
  const texts = Array.isArray(asked) ? asked : asked.texts
  console.log(JSON.stringify(texts.map(asked.headings ? headingsOf : asked.cells ? cellsOf : read)))
})
