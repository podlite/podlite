import  * as Image  from '../src';
import * as pod6 from 'pod6'
import { validateAst } from '../src';
// const describe = ( _ , f)=> f()
// const it = (_,  f) => f()
// const expect = (any):any=>{ 
//     const c=(any):any=>{}
//     c.toEqual = ()=>{}
//     return c
// }

describe('Check validateAst', () => {
  it('should ok vor Test.Json', () => {
    const r = validateAst({ters:"1"}, 'Test.json')
    expect(r).toEqual([])
  });
  it('should ok for simple PodNode', () => {
    const test = [
        {
          "type": "block",
          "content": [
                {
                  "type": "blankline"
                },
          ],
          "name": "pod",
          "margin": "",
          "config": [],
          "location": {
            "start": {
              "offset": 0,
              "line": 1,
              "column": 1
            },
            "end": {
              "offset": 82,
              "line": 10,
              "column": 1
            }
          }
        }
      ]
    const r = validateAst(test)
    expect(r).toEqual([])
  });


});
