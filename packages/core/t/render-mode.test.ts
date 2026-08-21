import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFileSync } from 'child_process'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')

describe('render mode on the command line', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-render-mode-'))
    file = path.join(dir, 'doc.podlite')
    fs.writeFileSync(file, 'Password G<hunter2> onwards\n')
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  const convert = (args: string[], env: Record<string, string> = {}) =>
    execFileSync('node', [bin, 'convert', file, '--to', 'html', '-o', '-', ...args], {
      encoding: 'utf-8',
      env: { ...process.env, ...env },
    })

  it('masks covered content without a mode given', () => {
    const out = convert([])
    expect(out).not.toContain('hunter2')
    expect(out).toContain('class="masked"')
  })

  it('shows covered content in draft', () => {
    expect(convert(['--render-mode', 'draft'])).toContain('hunter2')
  })

  it('reads the mode from the environment', () => {
    expect(convert([], { PODLITE_RENDER_MODE: 'draft' })).toContain('hunter2')
  })

  it('lets the flag win over the environment', () => {
    expect(convert(['--render-mode', 'production'], { PODLITE_RENDER_MODE: 'draft' })).not.toContain('hunter2')
  })

  it('refuses an unknown mode', () => {
    expect(() => convert(['--render-mode', 'preview'])).toThrow()
    try {
      convert(['--render-mode', 'preview'])
    } catch (e) {
      const err = e as { stderr: string; status: number }
      expect(err.stderr).toContain('Unknown render mode: preview')
      expect(err.status).toBe(1)
    }
  })
})
