import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import stateVersionPlugin from '../src/state-version-plugin'

const makeAbstactDocument = (title: string, content: string) => {
  return `
=begin pod 
=TITLE ${title}
=para
${content}
=end pod
`
}
const tctx = { testing: true }
it('linksPlugin: linking', () => {
  const sate1 = [processFile('virtual/src.pod6', makeAbstactDocument('test1', 'abstract content'))]
  const sate2 = [processFile('virtual/src.pod6', makeAbstactDocument('test1', 'abstract content'))]
  const sate3 = [processFile('virtual/src.pod6', makeAbstactDocument('test1-Change', 'abstract content'))]
  const sate4 = [processFile('virtual/src.pod6', makeAbstactDocument('test1', 'abstract content-Change'))]

  const getVersion = state => {
    const config: PluginConfig = {
      plugin: stateVersionPlugin(),
      includePatterns: '.*',
    }
    const [res, { stateVersion }] = processPlugin(config, state, tctx)
    return stateVersion
  }
  expect(getVersion(sate1)).toEqual(getVersion(sate2))
  expect(getVersion(sate1)).not.toEqual(getVersion(sate3))
  expect(getVersion(sate1)).not.toEqual(getVersion(sate4))
  expect(getVersion(sate3)).not.toEqual(getVersion(sate4))
})
