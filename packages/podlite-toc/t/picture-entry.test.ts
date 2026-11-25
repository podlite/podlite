import { getContentForToc } from '../src/index'

// a picture as its plugin leaves it: the source, then the caption its body gave
const picture = (config: Array<{ name: string; value: string }>, caption: any[]): any => ({
  type: 'block',
  name: 'picture',
  margin: '',
  config: config.map(item => ({ ...item, type: 'string' })),
  content: [
    { type: 'image', src: 'orbit.png' },
    { type: 'block', name: 'caption', content: caption },
  ],
})
const paragraphs = [
  { type: 'para', content: [{ type: 'text', value: 'First line.' }] },
  { type: 'para', content: [{ type: 'text', value: 'Second line.' }] },
]

describe('the entry of a picture in a table of contents', () => {
  it('is its :caption when the body gives the caption', () => {
    expect(getContentForToc(picture([{ name: 'caption', value: 'Orbit' }], paragraphs))).toBe('Orbit')
  })

  it('is empty for an empty :caption, not the text of the body', () => {
    expect(getContentForToc(picture([{ name: 'caption', value: '' }], paragraphs))).toBe('')
  })

  it('reads a caption of several paragraphs with a space between them', () => {
    expect(getContentForToc(picture([], paragraphs))).toBe('First line. Second line.')
  })

  it('is the caption of one paragraph as before', () => {
    expect(getContentForToc(picture([], [{ type: 'text', value: 'Only line.' }]))).toBe('Only line.')
  })
})
