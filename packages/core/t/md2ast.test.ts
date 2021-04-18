
import clean_plugin from 'pod6/built/plugin-clean-location'
import * as path from 'path'
import * as fs  from 'fs'
const glob = require('glob')
import { md2ast }  from '../src/'
const loadTests = (testsPath) => {
    const pathToTests = path.resolve(__dirname, testsPath)
    return glob.sync(pathToTests).map( f => {
        const testData = fs.readFileSync(f)
        const [ src, dst ] = `${testData}`.split('~~~~~~~\n')
        return { src, dst, file: f}
    })
}

const process = (src) => {
    return clean_plugin()(md2ast(src))
    
}

describe.skip("run parser tests", () => {
    loadTests('fixtures/*t').map( item => {
        test(item.file, ()=>expect(
            process(item.src)).toEqual( JSON.parse(item.dst))
        )
    })
})