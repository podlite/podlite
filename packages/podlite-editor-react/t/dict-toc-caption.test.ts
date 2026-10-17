import dictionary from '../src/dict'

// the specification captions a table of contents with :caption; :title on it is going away
describe('the table of contents the editor inserts', () => {
  const tocTexts = dictionary.map((d: any) => String(d.text ?? '')).filter(t => /^=((for|begin) )?toc\b/m.test(t))

  it('captions every table of contents with :caption', () => {
    const tocLines = tocTexts.flatMap(t => t.split('\n')).filter(l => /^=((for|begin) )?toc\b/.test(l))
    expect(tocLines.length).toBeGreaterThanOrEqual(3)
    for (const l of tocLines) expect(l).not.toMatch(/:title/)
  })

  it('writes :caption on the three captioned ones', () => {
    const captions = tocTexts.flatMap(t => [...t.matchAll(/:caption\('([^']*)'\)/g)].map(m => m[1]))
    expect(captions).toEqual(expect.arrayContaining(['Table of contents', 'List of media', 'List of tables']))
  })

  it('names the variant by the attribute it writes', () => {
    expect(dictionary.map((d: any) => d.displayText)).toContain('toc (with :caption) 🏷')
  })
})
