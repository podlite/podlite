import { match } from 'assert'
import { BlockHead, getFromTree, getPodContentFromNode, getTextContentFromNode } from '../src'

var parse = require('..').parse
describe('strict block names ', () => {
  const t1 = `=TITLE CHANGES 

=head1 Upcoming

=head1 0.0.53

# @podlite/editor-react@0.0.39

- enhanced link handling 
- fixed a redraw issue when resizing the application window

# @podlite/to-jsx@0.0.37

- improved code block visibility in CSS

=item1 test

=head1 0.0.52
`
  it('delimited podMode:0', () => {
    const tree = parse(t1, { podMode: 1 })
    const isReleaseExist = (tree: any, release: string) => {
      const headers = getFromTree(tree, 'head') as BlockHead[]
      return null != headers.find(n => [release].includes(getTextContentFromNode(n).trim()))
    }
    expect(isReleaseExist(tree, '0.0.53')).toEqual(true)
    expect(isReleaseExist(tree, '0.0.54')).toEqual(false)
    expect(isReleaseExist(tree, 'Upcoming')).toEqual(true)

    const getReleaseContent = (tree: any, release: string) => {
      const headers = getFromTree(tree, 'head') as BlockHead[]
      // first check if record with needed name already exists
      const first = headers.find(n => [release].includes(getTextContentFromNode(n).trim()))
      const nextHeader = headers
        .slice(headers.indexOf(first) + 1) // ignore this and previous nodes
        .filter(node => node.level <= first.level) // stop then found the same or lower level
        .shift()
      let lastIndexOfArticleNode = !nextHeader ? tree.length : tree.indexOf(nextHeader)
      const articleContent = tree.slice(tree.indexOf(first) + 1, lastIndexOfArticleNode)
      return articleContent
    }
    const isReleaseEmptyContent = (tree: any, release: string) => {
      const re = /\S/
      return !re.test(getTextContentFromNode(getReleaseContent(tree, release)))
    }

    expect(isReleaseEmptyContent(tree, 'Upcoming')).toEqual(true)
    expect(isReleaseEmptyContent(tree, '0.0.53')).toEqual(false)
    expect(isReleaseEmptyContent(tree, '0.0.52')).toEqual(true)

    // Helper functions
    const renameHeaderInPodlite = (src: string, from: string, to: string) => {
      const regex = new RegExp(`^=head1 ${from}$`, 'm')
      return src.replace(regex, `=head1 ${to}`)
    }

    const insertRecordBeforeRelease = (src: string, before: string, newHeader: string) => {
      const regex = new RegExp(`^=head1 ${before}$`, 'm')
      return src.replace(regex, `=head1 ${before}\n\n=head1 ${newHeader}`)
    }

    // Test helper functions
    const t2 = renameHeaderInPodlite(t1, 'Upcoming', '0.0.54')
    const t3 = insertRecordBeforeRelease(t2, '0.0.54', 'Upcoming')

    const tree3 = parse(t3)
    expect(isReleaseExist(tree3, 'Upcoming')).toEqual(true)
    expect(isReleaseExist(tree3, '0.0.54')).toEqual(true)
    expect(isReleaseExist(tree3, '0.0.53')).toEqual(true)

    // AST based helper
    const renameHeaderContent = (tree, from: string, to: string) => {
      const headers = getFromTree(tree, 'head') as BlockHead[]
      const destNode = headers.find(n => [from].includes(getTextContentFromNode(n).trim()))
      if (destNode) {
        const tmpTree = parse(`=head1 ${to}\n`, { podMode: 1 })
        const header = (getFromTree(tmpTree, 'head') as BlockHead[]).shift()
        destNode.content = header.content
      }
      return tree
    }

    const treeres = renameHeaderContent(tree, 'Upcoming', '0.0.54')
    expect(isReleaseExist(treeres, 'Upcoming')).toEqual(false)
    expect(isReleaseExist(treeres, '0.0.54')).toEqual(true)
  })
})
