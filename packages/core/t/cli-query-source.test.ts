import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')

describe('podlite query with a selector that names a file', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-query-'))
    fs.writeFileSync(path.join(dir, 'x.podlite'), '=pod\n\nIn x.\n')
  })

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  const query = (args: string[]) => spawnSync('node', [bin, 'query', ...args], { cwd: dir, encoding: 'utf-8' })

  it('reads the file with no input given', () => {
    const r = query(['file:x.podlite | para'])
    expect([r.status, r.stdout.trim()]).toEqual([0, 'In x.'])
  })

  it('does not stop on a file given that is not there, and says it is not read', () => {
    const r = query(['file:x.podlite | para', 'absent.podlite'])
    expect([r.status, r.stdout.trim()]).toEqual([0, 'In x.'])
    expect(r.stderr).toContain('the selector names its own source; not read: absent.podlite')
  })

  it('exits with 1 when the file is not there', () => {
    const r = query(['file:none.podlite | para'])
    expect([r.status, r.stderr]).toEqual([1, expect.stringContaining('the source does not resolve: file:none.podlite')])
  })
})
