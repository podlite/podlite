import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { parseContent } from '../src/lint/loader'
import { markupCodeTooDeepRule, MARKUP_CODE_TOO_DEEP_RULE_ID } from '../src/lint/rules/markup-code-too-deep'
import type { LintContext } from '../src/lint/types'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')
const convert = (input: string) => {
  const r = spawnSync('node', [bin, 'convert', '-', '--to', 'html', '-o', '-'], { input, encoding: 'utf-8' })
  return { status: r.status, stdout: r.stdout, stderr: r.stderr }
}
const deep = '=para\n' + 'B<'.repeat(1000) + 'x' + '>'.repeat(1000) + '\n'

describe('convert on the inputs that overflowed the stack', () => {
  it('writes a self-expanding alias as it stands and says why', () => {
    const r = convert('=alias X A<X>\n\nA<X>\n')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('A&lt;X&gt;')
    expect(r.stderr).toContain('alias X expands into itself: X → X')
    expect(r.stderr).not.toContain('RangeError')
  })

  it('writes codes nested past the limit as text and says so', () => {
    const r = convert(deep)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('B&lt;B&lt;')
    expect(r.stderr).toContain('podlite convert: -:2: markup codes nest deeper than 32 levels')
  })
})

describe('markup-code-too-deep rule', () => {
  const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
  it('passes the parser message on', () => {
    expect(MARKUP_CODE_TOO_DEEP_RULE_ID).toBe('markup-code-too-deep')
    const v = markupCodeTooDeepRule.check(parseContent(deep, 'podlite'), ctx)
    expect(v.map(x => [x.rule, x.severity, x.location?.start.line])).toEqual([['markup-code-too-deep', 'warning', 2]])
  })

  it('is reported by podlite lint', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-deep-'))
    try {
      fs.writeFileSync(path.join(dir, 'deep.podlite'), deep)
      const r = spawnSync('node', [bin, 'lint', path.join(dir, 'deep.podlite')], { encoding: 'utf-8' })
      expect(r.stdout).toContain('(markup-code-too-deep)')
      expect(r.stdout).toContain('0 errors, 1 warning')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('says nothing at the limit', () => {
    const src = '=para\n' + 'B<'.repeat(32) + 'x' + '>'.repeat(32) + '\n'
    expect(markupCodeTooDeepRule.check(parseContent(src, 'podlite'), ctx)).toEqual([])
  })
})
