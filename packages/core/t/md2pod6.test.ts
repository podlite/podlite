
import * as fs  from 'fs'
const glob = require('glob')
import { mdToPod6 }  from '../src'
const loadTests = (path) => {
    return glob.sync(path).map( f => {
        const testData = fs.readFileSync(f)
        const [ src, dst ] = `${testData}`.split('~~~~~~~\n')
        return { src, dst, file: f}
    })
}

const process = (src) => {
    return mdToPod6(src)
}

describe("run markdown to pod6 parser tests", () => {
    loadTests('t/fixtures-md-to-pod6/*t').map( item => {
        test(item.file, ()=>expect(
            process(item.src)).toEqual(item.dst)
        )
    })
})