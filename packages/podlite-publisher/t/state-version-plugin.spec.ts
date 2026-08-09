import * as fs from 'fs'
import * as os from 'os'
import pathFs from 'path'
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

it('stateVersionPlugin: appVersion appended to stateVersion', () => {
  const state = [processFile('virtual/src.pod6', makeAbstactDocument('test1', 'abstract content'))]
  const getVersion = (appVersion?: string) => {
    const config: PluginConfig = {
      plugin: stateVersionPlugin(appVersion),
      includePatterns: '.*',
    }
    const [, { stateVersion }] = processPlugin(config, state, tctx)
    return stateVersion
  }
  expect(getVersion()).not.toEqual(getVersion('0.10.2'))
  expect(getVersion('0.10.2')).toEqual(getVersion('0.10.2'))
  expect(getVersion('0.10.2')).not.toEqual(getVersion('0.10.3'))
  expect(getVersion('0.10.2')).toMatch(/\+app0\.10\.2$/)
})

describe('stateVersionPlugin: assets', () => {
  let dir: string
  let indexFilePath: string
  let stylesPath: string
  let imagePath: string

  const makeIndexDocument = () => `
=begin pod
= :globalStyles("./page.styles.css")
=TITLE index
=para
content
=end pod
`
  const getVersion = (ctx = {}) => {
    const state = [processFile(indexFilePath, makeIndexDocument())]
    const config: PluginConfig = {
      plugin: stateVersionPlugin(undefined, indexFilePath),
      includePatterns: '.*',
    }
    const [, { stateVersion }] = processPlugin(config, state, { testing: true, ...ctx })
    return stateVersion
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(pathFs.join(os.tmpdir(), 'state-version-'))
    indexFilePath = pathFs.join(dir, 'index.pod6')
    stylesPath = pathFs.join(dir, 'page.styles.css')
    imagePath = pathFs.join(dir, 'photo.png')
    fs.writeFileSync(stylesPath, 'body { margin: 0 }')
    fs.writeFileSync(imagePath, 'first')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('unchanged sources and assets keep stateVersion', () => {
    expect(getVersion()).toEqual(getVersion())
  })

  it('edited global styles change stateVersion', () => {
    const before = getVersion()
    fs.writeFileSync(stylesPath, 'body { margin: 2vw 0 }')
    expect(getVersion()).not.toEqual(before)
  })

  it('edited image changes stateVersion', () => {
    const ctx = { imagesMap: { [imagePath]: 'iphoto_png' } }
    const before = getVersion(ctx)
    fs.writeFileSync(imagePath, 'second')
    expect(getVersion(ctx)).not.toEqual(before)
  })

  it('missing asset file does not break the sum', () => {
    const ctx = { imagesMap: { [pathFs.join(dir, 'absent.png')]: 'iabsent_png' } }
    expect(getVersion(ctx)).toEqual(getVersion(ctx))
    expect(getVersion(ctx)).not.toEqual(getVersion())
  })
})
