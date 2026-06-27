import { parseContent } from '../src/lint/loader'
import { mediaAbsoluteFileRule, MEDIA_ABSOLUTE_FILE_RULE_ID } from '../src/lint/rules/media-absolute-file'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (src: string) => mediaAbsoluteFileRule.check(parseContent(src, 'podlite'), ctx)

describe('media-absolute-file rule', () => {
  it('exposes a stable slug and info severity', () => {
    expect(MEDIA_ABSOLUTE_FILE_RULE_ID).toBe('media-absolute-file')
    expect(mediaAbsoluteFileRule.severity).toBe('info')
  })

  it('flags an absolute picture path', () => {
    const v = check('=picture /media/hero.png\n')
    expect(v).toHaveLength(1)
    expect(v[0].severity).toBe('info')
    expect(v[0].message).toContain('/media/hero.png')
  })

  it('flags an absolute file: picture path', () => {
    expect(check('=picture file:/media/hero.png\n')).toHaveLength(1)
  })

  it('flags an absolute path given via the src attribute', () => {
    expect(check('=for picture :src</media/hero.png>\ncaption\n')).toHaveLength(1)
  })

  it('flags an absolute path in an =Image block', () => {
    expect(check('=Image /media/hero.png\n')).toHaveLength(1)
  })

  it('leaves a relative picture path alone', () => {
    expect(check('=picture demo.png\n')).toEqual([])
    expect(check('=picture ../assets/demo.png\n')).toEqual([])
  })

  it('leaves an https picture alone', () => {
    expect(check('=picture https://example.com/i.jpg\n')).toEqual([])
  })

  it('leaves a data picture alone', () => {
    expect(check('=picture data:Logo\n')).toEqual([])
  })
})
