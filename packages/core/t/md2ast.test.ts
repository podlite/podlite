
import clean_plugin from 'pod6/built/plugin-clean-location'
import {loadSrcFixtures} from './test-api'
import * as path from 'path'
import * as fs  from 'fs'
const glob = require('glob')
import { md2ast }  from '../src/'
const loadTests = (path) => {
    return glob.sync(path).map( f => {
        const testData = fs.readFileSync(f)
        const [ src, dst ] = `${testData}`.split('~~~~~~~\n')
        return { src, dst, file: f}
    })
}

const process = (src) => {
    return clean_plugin()(md2ast(src))
    
}

describe("run parser tests", () => {
    loadTests('t/fixtures/*t').map( item => {
        test(item.file, ()=>expect(
            process(item.src)).toEqual( JSON.parse(item.dst))
        )
    })
})