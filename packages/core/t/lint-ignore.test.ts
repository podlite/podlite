import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFileSync } from 'child_process'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')

describe(':lint-ignore in the document', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-lint-ignore-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  const lint = (body: string) => {
    const file = path.join(dir, 'doc.podlite')
    fs.writeFileSync(file, body)
    try {
      return execFileSync('node', [bin, 'lint', file], { encoding: 'utf-8' })
    } catch (e) {
      return (e as { stdout: string }).stdout
    }
  }

  const duplicated = '=for para :id<A>\none\n\n=for para :id<A>\ntwo\n'

  it('silences a rule for the whole document', () => {
    expect(lint(duplicated)).toContain('1 error')
    expect(lint(`=begin pod :lint-ignore<id-unique>\n${duplicated}=end pod\n`)).toContain('0 errors, 0 warnings')
  })

  it('silences a rule on a single block', () => {
    expect(lint('=head1 One\n\n=head3 Three\n')).toContain('1 warning')
    expect(lint('=head1 One\n\n=for head3 :lint-ignore<heading-hierarchy>\nThree\n')).toContain('0 errors, 0 warnings')
  })

  it('takes the mute from =config', () => {
    const out = lint('=config head3 :lint-ignore<heading-hierarchy>\n\n=head1 One\n\n=head3 Three\n')
    expect(out).toContain('0 errors, 0 warnings')
  })

  it('reports a mute that silenced nothing', () => {
    const out = lint(`=begin pod :lint-ignore<heading-hierarchy>\n${duplicated}=end pod\n`)
    expect(out).toContain('silenced nothing here')
    expect(out).toContain('(lint-ignore)')
    expect(out).toContain('1 error, 1 warning')
  })

  it('counts what it silenced in the summary', () => {
    expect(lint(`=begin pod :lint-ignore<id-unique>\n${duplicated}=end pod\n`)).toContain(
      '0 errors, 0 warnings, 1 silenced',
    )
    expect(lint(duplicated)).not.toContain('silenced')
  })

  it('asks for rule names when the attribute carries none', () => {
    const out = lint('=begin pod :lint-ignore<>\n=para\ntext\n=end pod\n')
    expect(out).toContain('names no rule')
    expect(out).toContain('0 errors, 1 warning')
  })

  it('silences only the rules it names', () => {
    const out = lint(`=begin pod :lint-ignore<heading-hierarchy id-unique>\n${duplicated}=end pod\n`)
    expect(out).toContain('silenced nothing here')
    expect(out).not.toContain('(id-unique)')
  })
})
