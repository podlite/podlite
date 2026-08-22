import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { readConfig, applyConfig, ConfigError } from '../src/lint/config'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')

describe('lint config file', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-lint-config-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  const write = (name: string, body: string) => {
    const file = path.join(dir, name)
    fs.writeFileSync(file, body)
    return file
  }

  const lint = (args: string[]) => {
    try {
      return { out: execFileSync('node', [bin, 'lint', ...args], { encoding: 'utf-8' }), code: 0 }
    } catch (e) {
      const err = e as { stdout: string; stderr: string; status: number }
      return { out: err.stdout + err.stderr, code: err.status }
    }
  }

  const duplicated = () => write('dup.podlite', '=for para :id<A>\none\n\n=for para :id<A>\ntwo\n')

  it('reads an empty config when no path is given', () => {
    expect(readConfig()).toEqual({})
  })

  it('turns a rule off', () => {
    const file = duplicated()
    expect(lint([file]).out).toContain('1 error')
    expect(lint(['--config', write('off.json', '{"rules":{"id-unique":"off"}}'), file]).out).toContain('0 errors')
  })

  it('lowers the severity of a rule', () => {
    const file = duplicated()
    const out = lint(['--config', write('warn.json', '{"rules":{"id-unique":"warning"}}'), file]).out
    expect(out).toContain('0 errors, 1 warning')
  })

  it('turns off a rule that reads the source', () => {
    const file = write('angle.podlite', '=for para :summary<has < and > inside>\ntext\n')
    expect(lint([file]).out).toContain('attr-nested-angle')
    const off = write('off.json', '{"rules":{"attr-nested-angle":"off"}}')
    expect(lint(['--config', off, file]).out).not.toContain('attr-nested-angle')
  })

  it('rejects a setting outside the vocabulary', () => {
    const file = duplicated()
    const bad = write('bad.json', '{"rules":{"id-unique":"nonsense"}}')
    const result = lint(['--config', bad, file])
    expect(result.code).toBe(2)
    expect(result.out).toContain('use one of off, error, warning, info')
  })

  it('rejects a config that cannot be read', () => {
    const file = duplicated()
    const result = lint(['--config', path.join(dir, 'missing.json'), file])
    expect(result.code).toBe(2)
    expect(result.out).toContain('cannot read config')
  })

  it('rejects rules that are not an object', () => {
    expect(() => readConfig(write('list.json', '{"rules":["id-unique"]}'))).toThrow(ConfigError)
  })

  it('leaves violations untouched without a rules section', () => {
    const violations = [{ rule: 'id-unique', severity: 'error' as const, message: 'duplicate' }]
    expect(applyConfig(violations, {})).toEqual(violations)
  })

  describe('found without a flag', () => {
    it('reads the config sitting next to the file', () => {
      const file = duplicated()
      write('.podlitelintrc.json', '{"rules":{"id-unique":"off"}}')
      expect(lint([file]).out).toContain('0 errors')
    })

    it('reads a config from a directory above', () => {
      write('.podlitelintrc.json', '{"rules":{"id-unique":"off"}}')
      const nested = path.join(dir, 'deep', 'deeper')
      fs.mkdirSync(nested, { recursive: true })
      const file = path.join(nested, 'dup.podlite')
      fs.writeFileSync(file, '=for para :id<A>\none\n\n=for para :id<A>\ntwo\n')
      expect(lint([file]).out).toContain('0 errors')
    })

    it('lets the nearer config win', () => {
      write('.podlitelintrc.json', '{"rules":{"id-unique":"off"}}')
      const nested = path.join(dir, 'deep')
      fs.mkdirSync(nested, { recursive: true })
      fs.writeFileSync(path.join(nested, '.podlitelintrc.json'), '{"rules":{"id-unique":"error"}}')
      const file = path.join(nested, 'dup.podlite')
      fs.writeFileSync(file, '=for para :id<A>\none\n\n=for para :id<A>\ntwo\n')
      expect(lint([file]).out).toContain('1 error')
    })

    it('lets --config win over the found one', () => {
      const file = duplicated()
      write('.podlitelintrc.json', '{"rules":{"id-unique":"off"}}')
      const loud = write('loud.json', '{"rules":{"id-unique":"error"}}')
      expect(lint(['--config', loud, file]).out).toContain('1 error')
    })

    it('reads a js config', () => {
      const file = duplicated()
      write('.podlitelintrc.js', 'module.exports = { rules: { "id-unique": "off" } }\n')
      expect(lint([file]).out).toContain('0 errors')
    })

    it('prefers the json config over the js one', () => {
      const file = duplicated()
      write('.podlitelintrc.json', '{"rules":{"id-unique":"off"}}')
      write('.podlitelintrc.js', 'module.exports = { rules: { "id-unique": "error" } }\n')
      expect(lint([file]).out).toContain('0 errors')
    })
  })

  describe('rules named on the command line', () => {
    it('turns a rule off for this run', () => {
      const file = duplicated()
      expect(lint([file]).out).toContain('1 error')
      expect(lint(['--disable', 'id-unique', file]).out).toContain('0 errors')
    })

    it('brings back a rule the config turned off', () => {
      const file = duplicated()
      const off = write('off.json', '{"rules":{"id-unique":"off"}}')
      expect(lint(['--config', off, file]).out).toContain('0 errors')
      expect(lint(['--config', off, '--enable', 'id-unique', file]).out).toContain('1 error')
    })

    it('takes the flag more than once', () => {
      const file = write('two.podlite', '=for para :id<A>\none\n\n=for para :id<A>\ntwo\n\n=head3 skipped level\n')
      const out = lint(['--disable', 'id-unique', '--disable', 'heading-hierarchy', file]).out
      expect(out).not.toContain('id-unique')
      expect(out).not.toContain('heading-hierarchy')
    })
  })
})
