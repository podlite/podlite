import * as fs from 'fs'
import * as path from 'path'

describe('podlite bin', () => {
  it('starts with a node shebang so npx and pnpm exec run it without Bun', () => {
    const bin = fs.readFileSync(path.join(__dirname, '..', 'bin', 'podlite.js'), 'utf-8')
    expect(bin.split('\n')[0]).toBe('#!/usr/bin/env node')
  })
})
