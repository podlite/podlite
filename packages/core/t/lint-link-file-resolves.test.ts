import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parseContent } from '../src/lint/loader'
import { linkFileResolvesRule, LINK_FILE_RESOLVES_RULE_ID } from '../src/lint/rules/link-file-resolves'
import { STDIN_NAME } from '../src/lint/types'
import type { LintContext } from '../src/lint/types'

const dir = mkdtempSync(join(tmpdir(), 'podlite-links-'))
writeFileSync(join(dir, 'there.podlite'), '=head1 There\n')
writeFileSync(join(dir, 'there.md'), '# There\n')
mkdirSync(join(dir, 'sub'))
// the document under test has to be on disk: the rule answers relative targets
// from its directory and stays silent when it has none
writeFileSync(join(dir, 'doc.podlite'), '')
writeFileSync(join(dir, 'doc.md'), '')

const check = (src: string, fileType: LintContext['fileType'] = 'podlite', filePath = join(dir, 'doc.podlite')) =>
  linkFileResolvesRule.check(parseContent(src, fileType), { filePath, fileType, config: {} })

describe('link-file-resolves rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(LINK_FILE_RESOLVES_RULE_ID).toBe('link-file-resolves')
    expect(linkFileResolvesRule.id).toBe('link-file-resolves')
    expect(linkFileResolvesRule.severity).toBe('warning')
  })

  describe('reports a target the disk cannot answer for', () => {
    it('catches a missing file named with the file scheme', () => {
      const v = check('See L<there|file:./nowhere.podlite>.\n')
      expect(v).toHaveLength(1)
      expect(v[0].message).toMatch(/nowhere\.podlite/)
      expect(v[0].location).toBeDefined()
    })

    it('catches a missing file named by its shape', () => {
      expect(check('See L<there|./nowhere.podlite>.\n')).toHaveLength(1)
      expect(check('See L<there|../nowhere.podlite>.\n')).toHaveLength(1)
    })

    it('catches a scheme-less target in a markdown file', () => {
      expect(check('[there](nowhere.md)\n', 'md', join(dir, 'doc.md'))).toHaveLength(1)
    })

    it('ignores the part after a hash when asking the disk', () => {
      expect(check('See L<there|file:./there.podlite#Missing>.\n')).toEqual([])
      expect(check('See L<there|file:./nowhere.podlite#Missing>.\n')).toHaveLength(1)
    })

    it('ignores a query string, which belongs to an address and not to a name', () => {
      expect(check('See L<there|file:./there.podlite?v=2>.\n')).toEqual([])
      expect(check('[there](./there.md?v=2)\n', 'md', join(dir, 'doc.md'))).toEqual([])
    })

    it('reads a windows drive as a path rather than a scheme', () => {
      expect(check('[there](C:/nowhere-at-all/x.md)\n', 'md', join(dir, 'doc.md'))).toHaveLength(1)
      expect(check('[there](C:\\nowhere-at-all\\x.md)\n', 'md', join(dir, 'doc.md'))).toHaveLength(1)
    })

    it('reads a drive-relative path, where a backslash says windows', () => {
      expect(check('[there](C:nowhere-at-all\\x.md)\n', 'md', join(dir, 'doc.md'))).toHaveLength(1)
    })
  })

  describe('stays quiet', () => {
    it('on a file that is there', () => {
      expect(check('See L<there|file:./there.podlite>.\n')).toEqual([])
      expect(check('See L<there|./there.podlite>.\n')).toEqual([])
    })

    it('on an anchor, which another rule owns', () => {
      expect(check('=for para :id<A>\nSee L<there|#nowhere>.\n')).toEqual([])
    })

    it('on any scheme that is not file', () => {
      expect(check('See L<there|https://example.com/none>.\n')).toEqual([])
      expect(check('See L<there|mailto:a@example.com>.\n')).toEqual([])
      expect(check('See L<there|ftp://example.com/none>.\n')).toEqual([])
      expect(check('See L<there|doc:Something>.\n')).toEqual([])
    })

    it('on a scheme one letter long, which is a scheme and not a drive', () => {
      expect(check('[there](a:b)\n', 'md', join(dir, 'doc.md'))).toEqual([])
      expect(check('[there](x:)\n', 'md', join(dir, 'doc.md'))).toEqual([])
    })

    it('on a bare word in a podlite document, which declares no path', () => {
      expect(check('See L<there|guide>.\n')).toEqual([])
    })

    it('on a target rooted with a slash, which reads as a site address', () => {
      expect(check('See L<there|/doc/types>.\n')).toEqual([])
      expect(check('[there](/doc/types)\n', 'md', join(dir, 'doc.md'))).toEqual([])
    })

    it('unless the author said file, and then a rooted path is checked', () => {
      expect(check('See L<there|file:/nowhere-at-all/x.podlite>.\n')).toHaveLength(1)
    })

    it('on a home-relative path, which answers differently per machine', () => {
      expect(check('See L<there|file:~/nowhere.podlite>.\n')).toEqual([])
      expect(check('See L<there|~/nowhere.podlite>.\n')).toEqual([])
    })

    it('on a directory that is there, which is a target an author may mean', () => {
      expect(check('See L<there|./sub>.\n')).toEqual([])
    })

    it('on input read from a pipe, where there is no directory to resolve against', () => {
      expect(check('See L<there|./nowhere.podlite>.\n', 'podlite', STDIN_NAME)).toEqual([])
    })

    it('when the caller named the document instead of pointing at one', () => {
      expect(check('See L<there|./nowhere.podlite>.\n', 'podlite', 'not-a-real-document.podlite')).toEqual([])
    })

    it('on a document with no links at all', () => {
      expect(check('=head1 Title\n\nplain prose\n')).toEqual([])
    })
  })
})
