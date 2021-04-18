
import * as fs  from 'fs'
import * as path from 'path'
const glob = require('glob')
import { mdToPod6 }  from '../src'
const loadTests = (testsPath) => {
    const pathToTests = path.resolve(__dirname, testsPath)
    return glob.sync(pathToTests).map( f => {
        const testData = fs.readFileSync(f)
        const [ src, dst ] = `${testData}`.split('~~~~~~~\n')
        return { src, dst, file: f}
    })
}

const process = (src) => {
    return mdToPod6(src)
}

describe("run markdown to pod6 parser tests", () => {
    loadTests('fixtures-md-to-pod6/*t').map( item => {
        test(item.file, ()=>expect(
            process(item.src)).toEqual(item.dst)
        )
    })
})