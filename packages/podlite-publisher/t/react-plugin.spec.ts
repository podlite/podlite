import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import reactPlugin from '../src/react-plugin'

const tctx = { testing: true }
const file1 = `
=begin pod 

=useReact {HeaderCol,LastArticles} from '@Components/service'

=TITLE use React components 

=begin React :component<HeaderCol> :id<header> 
=begin para
=head1 Header
=para
some text
=end para
=begin para
=Image ./photo.png
=end para
=end React
=end pod
`

const fileWithSpaces = `
=begin pod

=useReact {HeaderCol, LastArticles} from '@Components/service'

=TITLE spaces in the component list

=end pod
`

const fileWithRename = `
=begin pod

=useReact {HeaderCol as SiteBar} from '@Components/service'

=TITLE renamed component

=end pod
`

const runPlugin = (src: string) => {
  const rec = processFile('t/react-plugin/virtualFile.podlite', src)
  const config: PluginConfig = {
    plugin: reactPlugin(),
    includePatterns: '.*',
  }
  const [, ctx] = processPlugin(config, [rec], tctx)
  return ctx
}

it('component list separated by comma and space', () => {
  expect(runPlugin(fileWithSpaces).componensMap).toEqual({
    '@Components/service': ['HeaderCol', 'LastArticles'],
  })
})

it('component imported under another name', () => {
  expect(runPlugin(fileWithRename).componensMap).toEqual({
    '@Components/service': ['HeaderCol as SiteBar'],
  })
})

it('reactPlugin: extract images', () => {
  const t1 = processFile('t/image-plugin/virtualFile.podlite', file1)
  const config: PluginConfig = {
    plugin: reactPlugin(),
    includePatterns: '.*',
  }
  const [res, ctx] = processPlugin(config, [t1], tctx)
  expect(ctx).toMatchInlineSnapshot(`
    Object {
      "componensMap": Object {
        "@Components/service": Array [
          "HeaderCol",
          "LastArticles",
        ],
      },
      "testing": true,
    }
  `)
})
