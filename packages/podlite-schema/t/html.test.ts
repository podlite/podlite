import { toHtml } from "../src"
const allFixtures  = require('./load-fextures').allHtmlFixures
const cleanS = (str) => { return str}
const toStr = (tree) =>  JSON.stringify(tree ,null, 2)
const prepare = (str)=>cleanS(str)
describe("run html export tests", () => {
    allFixtures.map(
        i => 
        test(
                i.file, 
                ()=> {
                    const loaded = prepare(i.tree)
                    const exported = prepare( toStr(toHtml({}).run(i.text).toString()) )
                    // expect(exported).toEqual(expect.stringMatching(exported))
                    expect(exported).toEqual(loaded)
                }
            )
)
})
