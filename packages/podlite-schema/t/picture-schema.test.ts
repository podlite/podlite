import Ajv from 'ajv'
import * as fs from 'fs'
import * as path from 'path'

const caption = { type: 'block', name: 'caption', content: ['Orbit'] }
const paragraphs = { type: 'block', name: 'caption', content: [{ type: 'para', content: ['One'] }] }
const image = { type: 'image', src: 'orbit.png' }
const location = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 2, column: 1 } }
const picture = (content: unknown[]) => ({ type: 'block', name: 'picture', margin: '', location, content })

// the general check lets any block through as a named block, so a picture is checked by its own definition
describe('the definition of a picture block', () => {
  for (const name of ['AstTree.json', 'PodliteDocument.json']) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../schema', name), 'utf8'))
    const valid = new Ajv({ strict: true, allowUnionTypes: true, strictTuples: false }).compile({
      ...schema,
      $ref: '#/definitions/BlockPicture',
    })

    it(`takes an image, a caption, both or nothing in ${name}`, () => {
      for (const content of [[image, caption], [image], [caption], [paragraphs], [image, paragraphs], []])
        expect(valid(picture(content))).toBe(true)
    })

    it(`refuses a caption ahead of the image in ${name}`, () => {
      expect(valid(picture([caption, image]))).toBe(false)
    })
  }
})
