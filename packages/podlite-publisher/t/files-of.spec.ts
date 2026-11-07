import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { filesOf } from '../src/files-of'
import { parseSources } from '../src/node-utils'

const doc = '=begin pod\n=TITLE T\n\nText\n=end pod\n'
let root = ''
let before = ''

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'files-of-'))
  for (const name of [
    'b.podlite',
    'a.podlite',
    'C.podlite',
    'with space (1).podlite',
    'br[1].podlite',
    'sub/deep.podlite',
    'sub/x.pod6',
  ])
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }), fs.writeFileSync(path.join(root, name), doc)
  fs.mkdirSync(path.join(root, 'folder.podlite'))
  for (const name of ['star*.podlite', 'starX.podlite']) fs.writeFileSync(path.join(root, 'sub', name), doc)
  fs.symlinkSync('missing.podlite', path.join(root, 'sub', 'broken.podlite'))
  fs.symlinkSync('sub', path.join(root, 'link'))
  before = process.cwd()
  process.chdir(root)
})

afterAll(() => {
  process.chdir(before)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the files a pattern names', () => {
  it('come sorted by name, capitals among small letters', () => {
    expect(filesOf('*.podlite')).toEqual([
      'a.podlite',
      'b.podlite',
      'br[1].podlite',
      'C.podlite',
      'with space (1).podlite',
    ])
  })

  it('keep ./ when the pattern starts with it, and only then', () => {
    expect(filesOf('./sub/*.pod6')).toEqual(['./sub/x.pod6'])
    expect(filesOf('sub/*.pod6')).toEqual(['sub/x.pod6'])
  })

  it('keep the case of the pattern', () => {
    expect(filesOf('*.PODLITE')).toEqual([])
  })

  it('reach into a linked directory only below the first part, as a shell does', () => {
    expect(filesOf('**/deep.podlite')).toEqual(['sub/deep.podlite'])
    expect(filesOf('./**/deep.podlite')).toEqual(['./link/deep.podlite', './sub/deep.podlite'])
  })

  it('leave directories out, linked or not', () => {
    expect(filesOf('*')).toEqual(['a.podlite', 'b.podlite', 'br[1].podlite', 'C.podlite', 'with space (1).podlite'])
  })

  it('take a written path of a file as written', () => {
    expect(filesOf('with space (1).podlite')).toEqual(['with space (1).podlite'])
    expect(filesOf('sub/../a.podlite')).toEqual(['sub/../a.podlite'])
    expect(filesOf('././b.podlite')).toEqual(['././b.podlite'])
    expect(filesOf('br[1].podlite')).toEqual(['br[1].podlite'])
    expect(filesOf(path.join(root, 'sub/deep.podlite'))).toEqual([path.join(root, 'sub/deep.podlite')])
  })

  it('take a file whose name is also a pattern as that file, and the pattern as a pattern elsewhere', () => {
    expect(filesOf('sub/star*.podlite')).toEqual(['sub/star*.podlite'])
    expect(filesOf('sub/sta?X.podlite')).toEqual(['sub/starX.podlite'])
  })

  it('leave a broken link out', () => {
    expect(filesOf('sub/*.podlite')).toEqual(['sub/deep.podlite', 'sub/star*.podlite', 'sub/starX.podlite'])
  })

  it('want a path or a pattern', () => {
    expect(() => filesOf('')).toThrow(/a path or a pattern/)
  })
})

describe('the sources of a pattern', () => {
  it('skip a directory whose name matches the pattern', () => {
    expect(parseSources('*.podlite').map(record => record.file)).toEqual([
      'a.podlite',
      'b.podlite',
      'br[1].podlite',
      'C.podlite',
      'with space (1).podlite',
    ])
  })
})
