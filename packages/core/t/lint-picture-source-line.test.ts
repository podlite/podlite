import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { parseContent } from '../src/lint/loader'
import { pictureSourceLineRule, PICTURE_SOURCE_LINE_RULE_ID } from '../src/lint/rules/picture-source-line'
import { DEFAULT_RULES } from '../src/lint/rules'
import { lintSource } from '../src/lint'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (src: string) => pictureSourceLineRule.check(parseContent(src, 'podlite'), ctx)
const message = (address: string) =>
  `=picture takes its source only from :src; if ${address} is the picture source, write it as :src of =for picture or =begin picture`

describe('a picture that writes its source on its first line', () => {
  it('is a warning of its own rule, in the list of rules', () => {
    expect(PICTURE_SOURCE_LINE_RULE_ID).toBe('picture-source-line')
    expect(pictureSourceLineRule.severity).toBe('warning')
    expect(DEFAULT_RULES).toContain(pictureSourceLineRule)
  })

  it('names the address and the forms that take :src', () => {
    const [v] = check('=picture photo.png\n')
    expect(v.message).toBe(message('photo.png'))
    expect(v.location?.start.line).toBe(1)
    expect(check('=picture photo.png')[0].message).toBe(message('photo.png'))
    expect(check('=picture Alt words https://x.test/y.png\n')[0].message).toBe(message('https://x.test/y.png'))
  })

  it.each([
    ['a delimited block with a blank line first', '=begin picture\n\nmedia/clip.MP4\n=end picture\n'],
    ['a block with a caption option', '=for picture :caption<C>\ndata:Logo\n'],
    ['an upper-case scheme', '=picture DATA:Logo\n'],
    ['an extension after a colon', '=picture deploy:staging.png\n'],
    ['a path with a colon', '=picture ./deploy:staging.png\n'],
    ['https without an extension', '=picture https://x.test/y\n'],
    ['http without an extension', '=picture http://x.test/y\n'],
    ['ftp without an extension', '=picture ftp://x.test/y\n'],
    ['file without an extension', '=picture file:/x/y\n'],
  ])('warns on %s', (_, src) => {
    expect(check(src)).toHaveLength(1)
  })

  it('names a long data: URL up to its comma', () => {
    const [v] = check(`=picture data:image/png;base64,${'A'.repeat(100000)}\n`)
    expect(v.message).toBe(message('data:image/png;base64,…'))
    expect(v.message.length).toBeLessThan(200)
  })

  it.each([
    ['a written source', '=for picture :src<a.png>\nb.png\n'],
    ['an empty source', '=for picture :src<>\nb.png\n'],
    ['a negated source', '=for picture :!src\nb.png\n'],
    ['a source that is no string', '=for picture :src(42)\nb.png\n'],
    ['a source =set gives', '=set :src<a.png>\n=picture photo.png\n'],
    ['a source =config gives', '=config picture :src<a.png>\n=picture photo.png\n'],
    ['a caption', '=picture The station at its highest point.\n'],
    ['a scheme without an address', '=picture https:\n'],
    ['a word with a colon', '=picture deploy:staging\n'],
    ['an =Image', '=Image photo.png\n'],
  ])('leaves alone %s', (_, src) => {
    expect(check(src)).toEqual([])
  })

  it('leaves alone a picture written inside a code block', () => {
    expect(check('=begin code\n=picture photo.png\n=end code\n\nA paragraph after.\n')).toEqual([])
  })
})

describe('the rule in the lint command', () => {
  const pkgRoot = path.join(__dirname, '..')
  const bin = path.join(pkgRoot, 'bin', 'podlite.js')
  const lint = (args: string[]) => {
    try {
      return { out: execFileSync('node', [bin, 'lint', ...args], { encoding: 'utf-8', cwd: pkgRoot }), code: 0 }
    } catch (e) {
      const err = e as { stdout: string; stderr: string; status: number }
      return { out: (err.stdout || '') + (err.stderr || ''), code: err.status }
    }
  }
  let dir = ''
  let file = ''
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'picture-source-line-'))
    file = path.join(dir, 'a.podlite')
    fs.writeFileSync(file, '=begin pod\n=picture photo.png\n=end pod\n')
  })
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('warns, fails only under --strict, and is switched off by --disable or :lint-ignore', () => {
    const plain = lint([file])
    expect(plain.code).toBe(0)
    expect(plain.out).toContain('picture-source-line')
    expect(lint(['--strict', file]).code).toBe(1)
    expect(lint(['--disable', 'picture-source-line', file]).out).not.toContain('picture-source-line')
    const report = (src: string) => JSON.stringify(lintSource(src, 'a.podlite', { rules: {} }))
    expect(report('=begin pod\n=for picture\nphoto.png\n=end pod\n')).toContain('picture-source-line')
    expect(report('=begin pod\n=for picture :lint-ignore<picture-source-line>\nphoto.png\n=end pod\n')).not.toContain(
      'picture-source-line',
    )
  })
})
