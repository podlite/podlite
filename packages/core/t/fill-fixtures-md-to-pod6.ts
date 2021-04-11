import * as fs  from 'fs'


import {loadSrcFixtures} from './test-api'
import { mdToPod6 }  from '../src'
const log = (t)=> JSON.stringify(t, null,2)
const  allSrcFixtures  = loadSrcFixtures('t/fixtures-md/*.t', 't/fixtures-md-to-pod6')


const notExistsTests =  allSrcFixtures.filter( r => !fs.existsSync(r.testFile))
const byName =  allSrcFixtures.filter( r => r.testFile === 't/fixtures/00-main_links.txt1')

// get fixture to test
const fixture = byName[0] ? byName[0]  : (notExistsTests && notExistsTests[0]) ? notExistsTests[0] : null
if (1 && fixture) { 
    
    console.log([fixture.testFile, "\n.\n",fixture.text, ".\n"].join(""))
    const test = mdToPod6(fixture.text,{

    })
    if (fixture.testFile === 't/fixtures-md-to-pod6/01-node-api_1.txt') {
        console.log('s')
        const saveTest = (filename, src, tree) =>{
            fs.writeFileSync( filename, [src, tree].join('~~~~~~~\n'))
        }
        // saveTest(fixture.testFile, fixture.text, test) 
        console.log('sadasd') 
    }
    console.log(test)
    // console.log(JSON.stringify(test ,null, 2))
} else {
    console.log("no new fixtures")

}

