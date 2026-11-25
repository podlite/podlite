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

describe('the version of the site and the pictures of its records', () => {
  const imagesPlugin = require('../src/images-plugin').default
  const versionOf = (docs: Array<[string, string]>, ctx: any = tctx) => {
    const state = docs.map(([file, body]) => processFile(file, `=begin pod\n${body}\n=end pod\n`))
    const [afterImages, imagesCtx] = processPlugin({ plugin: imagesPlugin(), includePatterns: '.*' }, state, ctx)
    return processPlugin({ plugin: stateVersionPlugin(), includePatterns: '.*' }, afterImages, imagesCtx)[1]
      .stateVersion
  }
  const remote = (address: string) => `=for picture :src<${address}>\n`
  const data = (key: string) =>
    `=for picture :src<data:${key}>\n\n=begin data :key<One> :mime-type<image/png> :encoding<base64>\nAAAA\n=end data\n\n=begin data :key<Two> :mime-type<image/png> :encoding<base64>\nBBBB\n=end data\n`

  it('moves when only a remote address changes', () => {
    expect(versionOf([['a.podlite', remote('https://x.test/a.png')]])).not.toEqual(
      versionOf([['a.podlite', remote('https://x.test/b.png')]]),
    )
  })

  it('moves when only the key of a data: picture changes', () => {
    expect(versionOf([['a.podlite', data('One')]])).not.toEqual(versionOf([['a.podlite', data('Two')]]))
  })

  it('moves when a remote and a local picture change places', () => {
    const local = '=for picture :src<logo.png>\n'
    const one = remote('https://x.test/a.png')
    expect(versionOf([['a.podlite', `${one}\n${local}`]])).not.toEqual(versionOf([['a.podlite', `${local}\n${one}`]]))
  })

  it('moves when a picture goes to another record', () => {
    // the text of each record is the same either way, so only the picture moves
    const one = remote('https://x.test/a.png')
    const text = '=para Text\n'
    expect(
      versionOf([
        ['a.podlite', `${one}\n${text}`],
        ['b.podlite', text],
      ]),
    ).not.toEqual(
      versionOf([
        ['a.podlite', text],
        ['b.podlite', `${one}\n${text}`],
      ]),
    )
  })

  it('stays the same for the same records, and does not read a directory', () => {
    const docs: Array<[string, string]> = [['a.podlite', '=for picture :src<file:///>\n\n=for picture :src<//tmp>\n']]
    expect(versionOf(docs)).toEqual(versionOf(docs))
  })

  it('gives the same version when called twice with one context', () => {
    const state = [processFile('index.podlite', '=begin pod :favicon<f.ico> :globalStyles<s.css>\n=para A\n=end pod\n')]
    const plugin = () => stateVersionPlugin(undefined, 'index.podlite')
    const ctx = { ...tctx, imageSources: [] }
    const first = processPlugin({ plugin: plugin(), includePatterns: '.*' }, state, ctx)[1].stateVersion
    const second = processPlugin({ plugin: plugin(), includePatterns: '.*' }, state, ctx)[1].stateVersion
    expect(first).toEqual(second)
    expect(ctx.imageSources).toEqual([])
  })
})

it('imagesPlugin: a generated import names a file with a quote in its path whole', () => {
  const dir = fs.mkdtempSync(pathFs.join(os.tmpdir(), 'images-quote-'))
  fs.mkdirSync(pathFs.join(dir, 'built'))
  const png = pathFs.join(dir, 'a"b.png')
  fs.writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const cwd = process.cwd()
  let module = ''
  try {
    // the module of imports goes where the build runs
    process.chdir(dir)
    let plugin: any
    jest.isolateModules(() => {
      plugin = require('../src/images-plugin').default
    })
    const record = processFile(pathFs.join(dir, 'p.podlite'), '=begin pod\n=for picture :src<a"b.png>\n=end pod\n')
    processPlugin({ plugin: plugin(), includePatterns: '.*' }, [record], {})
    module = fs.readFileSync(pathFs.join(dir, 'built', 'images.ts'), 'utf8')
  } finally {
    process.chdir(cwd)
    fs.rmSync(dir, { recursive: true, force: true })
  }
  expect(module).toContain(`from ${JSON.stringify(png)}`)
})

describe('the version of the site and the order of the pictures in a record', () => {
  const imagesPlugin = require('../src/images-plugin').default
  const versionOf = (records: Array<{ file: string; publishUrl?: string; body: string }>) => {
    const state = records.map(({ file, publishUrl, body }) => ({
      ...processFile(file, `=begin pod\n${body}\n=end pod\n`),
      ...(publishUrl ? { publishUrl } : {}),
    }))
    const [after, ctx] = processPlugin({ plugin: imagesPlugin(), includePatterns: '.*' }, state, tctx)
    return processPlugin({ plugin: stateVersionPlugin(), includePatterns: '.*' }, after, ctx)[1].stateVersion
  }
  const pic = (name: string) => `=for picture :src<https://x.test/${name}.png>\n`

  it('moves when a picture repeats in another place', () => {
    expect(versionOf([{ file: 'a.podlite', body: `${pic('a')}\n${pic('b')}\n${pic('a')}` }])).not.toEqual(
      versionOf([{ file: 'a.podlite', body: `${pic('a')}\n${pic('a')}\n${pic('b')}` }]),
    )
  })

  it('moves when a picture goes to another note of the same file', () => {
    expect(
      versionOf([
        { file: 'j.podlite', publishUrl: '/1', body: `${pic('a')}\n=para Text\n` },
        { file: 'j.podlite', publishUrl: '/2', body: '=para Text\n' },
      ]),
    ).not.toEqual(
      versionOf([
        { file: 'j.podlite', publishUrl: '/1', body: '=para Text\n' },
        { file: 'j.podlite', publishUrl: '/2', body: `${pic('a')}\n=para Text\n` },
      ]),
    )
  })
})

it('imagesPlugin: the module of imports holds only files, a URI with %20 among them, and parses', () => {
  const dir = fs.mkdtempSync(pathFs.join(os.tmpdir(), 'images-files-'))
  fs.mkdirSync(pathFs.join(dir, 'built'))
  fs.mkdirSync(pathFs.join(dir, 'sub'))
  const png = pathFs.join(dir, 'a b.png')
  fs.writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const cwd = process.cwd()
  let module = ''
  try {
    process.chdir(dir)
    let plugin: any
    jest.isolateModules(() => {
      plugin = require('../src/images-plugin').default
    })
    const body = `=for picture :src<file:///>\n\n=for picture :src<sub>\n\n=for picture :src<file://${encodeURI(
      png,
    )}>\n`
    const record = processFile(pathFs.join(dir, 'p.podlite'), `=begin pod\n${body}=end pod\n`)
    processPlugin({ plugin: plugin(), includePatterns: '.*' }, [record], {})
    module = fs.readFileSync(pathFs.join(dir, 'built', 'images.ts'), 'utf8')
  } finally {
    process.chdir(cwd)
    fs.rmSync(dir, { recursive: true, force: true })
  }
  const imports = [...module.matchAll(/^\s*import \S+ from (.+)$/gm)].map(m => JSON.parse(m[1]))
  expect(imports).toEqual([png])
  const { diagnostics } = require('typescript').transpileModule(module, { reportDiagnostics: true })
  expect(diagnostics).toEqual([])
})

it('stateVersionPlugin: a directory among the files the images plugin found does not stop the version', () => {
  const state = [processFile('a.podlite', '=begin pod\n=para A\n=end pod\n')]
  const run = () =>
    processPlugin({ plugin: stateVersionPlugin(), includePatterns: '.*' }, state, {
      ...tctx,
      imagesMap: { [os.tmpdir()]: 'itmp' },
    })[1].stateVersion
  expect(run()).toEqual(run())
})
