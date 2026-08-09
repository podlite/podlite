import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const script = path.resolve(__dirname, '../scripts/extract-changelog.mjs')

// the script reads packages/*/CHANGELOG.podlite under the current directory,
// so a release is staged in a directory of its own
const notesFor = (section: string): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-'))
  const pkgDir = path.join(root, 'packages', 'sample')
  fs.mkdirSync(pkgDir, { recursive: true })
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: '@sample/pkg', version: '1.2.3' }))
  fs.writeFileSync(path.join(pkgDir, 'CHANGELOG.podlite'), `=head1 Upcoming\n\n=head1 1.2.3\n\n${section}\n`)
  try {
    return execFileSync('node', [script, '--summary'], { cwd: root, encoding: 'utf8' })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

describe('release notes built from a changelog section', () => {
  it('keeps a code sample whole when it holds an angle bracket', () => {
    const notes = notesFor('=item render C<< :lang<js> >> here')
    expect(notes).toContain('`')
    expect(notes).toContain(':lang<js>')
    // the delimiters used to leak and cut the sample in half
    expect(notes).not.toContain('>>')
    expect(notes).not.toMatch(/`<\s/)
  })

  it('converts a plain code span', () => {
    expect(notesFor('=item mentions C<plain> once')).toContain('`plain`')
  })

  it('names the package and version', () => {
    expect(notesFor('=item something')).toContain('# @sample/pkg@1.2.3')
  })

  it('writes items as a tight list', () => {
    const notes = notesFor('=item first\n=item second')
    expect(notes).toContain('- first\n- second')
  })
})
