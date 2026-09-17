import { spawn, spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const pkgRoot = path.join(__dirname, '..')
const bin = path.join(pkgRoot, 'bin', 'podlite.js')
const manifest: { version: string } = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf-8'))
const printedVersion = { code: 0, stdout: `${manifest.version}\n`, stderr: '' }

type Run = { code: number | null; stdout: string; stderr: string }

const run = (args: string[], cwd: string): Run => {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf-8', stdio: 'pipe' })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

// stdin is a pipe left open and empty, the way a caller that writes nothing leaves it
const runWithOpenInput = (args: string[], cwd: string, deadline: number): Promise<Run> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout.on('data', chunk => (stdout += chunk))
    child.stderr.on('data', chunk => (stderr += chunk))
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, deadline)
    child.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (timedOut) reject(new Error(`podlite ${args.join(' ')} did not finish in ${deadline} ms`))
      else resolve({ code, stdout, stderr })
    })
  })

describe('podlite --version', () => {
  let dir: string

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-version-'))
  })
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('prints the version of the package', () => {
    expect(run(['--version'], dir)).toEqual(printedVersion)
  })

  it('is listed in the help', () => {
    expect(run(['--help'], dir).stdout).toMatch(/--version\s+Show the version number/)
  })

  it.each([[['lint']], [['convert', '--to', 'md']], [['query', 'head1']]])(
    'prints the version after %j without waiting for input',
    async command => {
      expect(await runWithOpenInput([...command, '--version'], dir, 10000)).toEqual(printedVersion)
    },
    30000,
  )

  it('answers whichever of help and version comes first', () => {
    expect(run(['--version', '--help'], dir)).toEqual(printedVersion)
    const help = run(['--help', '--version'], dir)
    expect(help.code).toBe(0)
    expect(help.stdout).toMatch(/^Usage:/)
    expect(help.stderr).toBe('')
  })

  it('is not taken from the value of an option', () => {
    expect(run(['convert', 'a.podlite', '--to', 'md', '--version'], dir)).toEqual(printedVersion)
    expect(run(['convert', 'a.podlite', '--to', 'md', '-o', '--version'], dir)).toEqual({
      code: 1,
      stdout: '',
      stderr: 'File not found: a.podlite\n',
    })
  })
})
