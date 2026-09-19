import * as fs from 'fs'
import * as path from 'path'

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))
const at = (rel: string) => path.join(__dirname, '..', rel)

describe('the lint entry the package declares', () => {
  it('is reachable under a name that does not spell the build layout', () => {
    expect(pkg.exports['./lint']).toBeDefined()
    expect(Object.keys(pkg.exports)).toContain('./lint')
  })

  it('points at files that exist', () => {
    const entry = pkg.exports['./lint']
    for (const target of [entry.types, entry.require, entry.import]) {
      expect(fs.existsSync(at(target))).toBe(true)
    }
  })

  it('hands over the check and the findings', () => {
    const api = require('podlite/lint')
    for (const name of ['runLint', 'lintFile', 'lintSource', 'resolveConfig', 'reportLint']) {
      expect(typeof api[name]).toBe('function')
    }
  })

  it('reports findings as data, without going through the printed report', () => {
    const file = path.join(__dirname, 'lint-fixtures', 'broken.podlite')
    const { lintFile, resolveConfig } = require('podlite/lint')
    const report = lintFile(file, resolveConfig([file], { strict: false, format: 'json' }))
    expect(report.filePath).toBe(file)
    expect(report.violations.length).toBeGreaterThan(0)
    expect(report.violations.map((v: { rule: string }) => v.rule)).toContain('id-unique')
  })

  it('keeps the check out of the main entry', () => {
    // the check reads the file system; pulling it into the package entry would
    // drag fs into every browser bundle that imports podlite
    const entry = fs.readFileSync(at(pkg.exports['.'].require), 'utf-8')
    expect(entry).not.toMatch(/require\(["']\.\/lint/)
  })
})

describe('the test entry the package declares', () => {
  it('points at files that exist', () => {
    const entry = pkg.exports['./test']
    for (const target of [entry.types, entry.require, entry.import]) {
      expect(fs.existsSync(at(target))).toBe(true)
    }
  })

  it('hands over the run, its parts and the report formats', () => {
    const api = require('podlite/test')
    for (const name of [
      'runTests',
      'collectTests',
      'planRuns',
      'inputsFor',
      'evaluateAssertion',
      'formatText',
      'formatJson',
    ]) {
      expect(typeof api[name]).toBe('function')
    }
    expect([api.coreProfile.name, api.schemaProfile.name]).toEqual(['core', 'schema'])
  })

  it('keeps the runner out of the main entry', () => {
    const entry = fs.readFileSync(at(pkg.exports['.'].require), 'utf-8')
    expect(entry).not.toMatch(/require\(["']\.\/test/)
  })
})
