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
  console.log(JSON.stringify(texts.map(asked.cells ? cellsOf : read)))
})
