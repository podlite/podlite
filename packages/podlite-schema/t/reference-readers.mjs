// Reads markdown given on stdin with two readers and prints, for every link and picture,
// what each reader takes its address, title and alternative text to be.
import { marked } from 'marked'
import { JSDOM } from 'jsdom'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

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
process.stdin.on('end', () => console.log(JSON.stringify(JSON.parse(input).map(read))))
