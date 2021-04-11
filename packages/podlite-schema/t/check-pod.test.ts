import { toTree } from "pod6"
import { validateAst } from "../src"

const fs = require('fs')
const path = require('path')
const glob = require('glob') 
const pathToTests = path.resolve(__dirname, 'fixtures')
const allFixtures = glob.sync(`${pathToTests}/*.txt`).map( f => {
    const testData = fs.readFileSync(f)
    const [ text, json ] = `${testData}`.split('~~~~~~~\n')
    const tree = JSON.parse(json)
    return { text, tree, file: f}
})


describe("run parser tests", () => {
        allFixtures.map(i => test(i.file, ()=>{
        const tree = toTree().parse(i.text)
        const r = validateAst(tree)
        expect(r).toEqual([])
    }
    ))
})

describe("run fixtures saved tree", () => {
    allFixtures.map(i => test(i.file, ()=>{
    const r = validateAst(i.tree)
    expect(r).toEqual([])
}
))
})