import * as fs  from 'fs'


import cleanplug from 'pod6/built/plugin-clean-location'
import {loadSrcFixtures} from './test-api'
import { md2ast }  from '../src/'
import { mkFomattingCodeL}  from '../src/tools'
const log = (t)=> JSON.stringify(t, null,2)
const cleanTree = (test)=>{ return cleanplug()(test) }
const  allSrcFixtures  = loadSrcFixtures('t/fixtures-md/*.t', 't/fixtures')


const notExistsTests =  allSrcFixtures.filter( r => !fs.existsSync(r.testFile))
const byName =  allSrcFixtures.filter( r => r.testFile === 't/fixtures/00-main_links.txt1')

// get fixture to test
const fixture = byName[0] ? byName[0]  : (notExistsTests && notExistsTests[0]) ? notExistsTests[0] : null
if (1 && fixture) { 
    
    console.log([fixture.testFile, "\n.\n",fixture.text, ".\n"].join(""))
    const test = md2ast(fixture.text,{

    })
    if (fixture.testFile === 't/fixtures/01-node-api_1.txt') {
        console.log('s')
        const saveTest = (filename, src, tree) =>{
            fs.writeFileSync( filename, [src, JSON.stringify(tree ,null, 2)].join('~~~~~~~\n'))
        }
        // saveTest(fixture.testFile, fixture.text, cleanTree(test)) 
        console.log('sadasd') 
    }

    console.log(JSON.stringify(cleanTree(test) ,null, 2))
} else {
    console.log("no new fixtures")

}

